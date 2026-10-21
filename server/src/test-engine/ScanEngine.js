const { Scan, TestResult, Finding, Application } = require('../models');
const { createTargetAdapter } = require('../providers');
const { defaultEvaluator } = require('../evaluators');
const { getAllTestCases } = require('./test-library');
const RegressionEngine = require('./RegressionEngine');

/**
 * Returns prescriptive remediation advice based on the security category.
 * @param {string} category
 * @returns {string}
 */
function getRemediationAdvice(category) {
  switch (category) {
    case 'prompt_injection':
    case 'instruction_override':
      return 'Implement strict input delimitation, system instruction boundaries, and pre-execution adversarial input classifiers. Do not allow untrusted user input to directly control execution directives.';
    case 'data_leakage':
      return 'Ensure system instructions, confidential tokens, and database credentials are removed from prompts or protected with post-generation redaction filters. Use canary token monitoring to detect leakage.';
    default:
      return 'Review prompt structure and apply defense-in-depth output validation guards.';
  }
}

class ScanEngine {
  /**
   * @param {Object} [dependencies]
   * @param {import('../evaluators/DeterministicEvaluator')} [dependencies.evaluator]
   * @param {RegressionEngine} [dependencies.regressionEngine]
   */
  constructor({ evaluator, regressionEngine } = {}) {
    this.evaluator = evaluator || defaultEvaluator;
    this.regressionEngine = regressionEngine || new RegressionEngine();
  }

  /**
   * Executes a full scan against an application.
   * 
   * @param {string|import('mongoose').Types.ObjectId} scanId - The ID of the Scan document to execute
   * @param {Object} [options]
   * @param {Array<Object>} [options.testCases] - Optional test cases override (defaults to full test library)
   * @returns {Promise<import('../models/Scan')>} The updated Scan document
   */
  async executeScan(scanId, options = {}) {
    const scan = await Scan.findById(scanId);
    if (!scan) {
      throw new Error(`Scan not found with ID: ${scanId}`);
    }

    const application = await Application.findById(scan.applicationId);
    if (!application) {
      scan.status = 'failed';
      scan.error = { code: 'APP_NOT_FOUND', message: 'Associated application does not exist.' };
      await scan.save();
      throw new Error(`Application not found for scan ID: ${scanId}`);
    }

    // Associate active baseline if not already defined
    if (!scan.baselineScanId && application.currentBaselineScanId) {
      scan.baselineScanId = application.currentBaselineScanId;
    }

    // Mark scan as running
    scan.status = 'running';
    scan.startedAt = new Date();
    await scan.save();

    const testCases = options.testCases || getAllTestCases();
    scan.totalTests = testCases.length;
    await scan.save();

    // Prepare target adapter
    let adapter;
    try {
      const adapterConfig = {
        type: application.targetConfig.type || 'http',
        url: application.targetConfig.url,
        method: application.targetConfig.method || 'POST',
        headers: application.targetConfig.headers ? Object.fromEntries(application.targetConfig.headers) : {},
        timeoutMs: application.targetConfig.timeoutMs || 5000,
      };
      adapter = createTargetAdapter(adapterConfig);
    } catch (adapterErr) {
      scan.status = 'failed';
      scan.error = { code: 'ADAPTER_CONFIG_ERROR', message: adapterErr.message };
      scan.completedAt = new Date();
      scan.durationMs = scan.completedAt - scan.startedAt;
      await scan.save();
      return scan;
    }

    const canaryValue = application.targetConfig.canaryValue || '';

    // Execute each test case sequentially
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      let targetResponse;

      try {
        targetResponse = await adapter.execute({
          prompt: testCase.input,
        });
      } catch (err) {
        targetResponse = {
          success: false,
          output: '',
          latencyMs: 0,
          rawResponse: null,
          metadata: {},
          error: { code: 'UNEXPECTED_TARGET_ERROR', message: err.message, isRetryable: false },
        };
      }

      // Evaluate the response
      const evalResult = this.evaluator.evaluate({
        targetResponse,
        testCase,
        options: { canaryValue },
      });

      // Persist the TestResult
      const testResult = await TestResult.create({
        scanId: scan._id,
        applicationId: application._id,
        testCaseId: testCase.id,
        testCaseVersion: testCase.version,
        testCaseName: testCase.name,
        category: testCase.category,
        severity: testCase.severity,
        verdict: evalResult.verdict,
        inputPrompt: testCase.input,
        outputResponse: targetResponse.output || '',
        latencyMs: targetResponse.latencyMs || 0,
        assertionResults: evalResult.assertionResults,
        evidence: evalResult.evidence,
        error: evalResult.error,
      });

      // If failed, generate a Finding
      if (evalResult.verdict === 'failed') {
        scan.failedCount += 1;
        await Finding.create({
          applicationId: application._id,
          scanId: scan._id,
          testResultId: testResult._id,
          testCaseId: testCase.id,
          title: `Security Finding: ${testCase.name}`,
          description: testCase.description,
          category: testCase.category,
          severity: testCase.severity,
          evidence: evalResult.evidence || 'Vulnerability detected during assertion evaluation.',
          remediation: getRemediationAdvice(testCase.category),
          status: 'open',
        });
      } else if (evalResult.verdict === 'passed') {
        scan.passedCount += 1;
      } else if (evalResult.verdict === 'error') {
        scan.errorCount += 1;
      } else if (evalResult.verdict === 'needs_review') {
        scan.needsReviewCount += 1;
      }

      // Progressive progress and count update
      const percentage = Math.round(((i + 1) / testCases.length) * 100);
      scan.progress = percentage;
      await scan.save();

      if (options.onProgress && typeof options.onProgress === 'function') {
        try {
          await options.onProgress({
            completed: i + 1,
            total: testCases.length,
            percentage,
            testCaseId: testCase.id,
          });
        } catch (progressErr) {
          console.warn('[ScanEngine] onProgress callback error:', progressErr.message);
        }
      }
    }

    // Complete scan
    scan.status = 'completed';
    scan.progress = 100;
    scan.completedAt = new Date();
    scan.durationMs = scan.completedAt.getTime() - scan.startedAt.getTime();

    // Auto-compute regression against baseline if available
    if (scan.baselineScanId) {
      try {
        const diff = await this.regressionEngine.compareScans(scan._id, scan.baselineScanId);
        scan.regressionSummary = {
          verdict: diff.verdict,
          regressionsCount: diff.summary.regressionsCount,
          fixesCount: diff.summary.fixesCount,
          unresolvedCount: diff.summary.unresolvedCount,
          consistentPassedCount: diff.summary.consistentPassedCount,
        };
      } catch (diffErr) {
        console.warn('[ScanEngine] Failed to auto-compute regression diff:', diffErr.message);
      }
    } else {
      scan.regressionSummary = {
        verdict: 'NO_BASELINE',
        regressionsCount: 0,
        fixesCount: 0,
        unresolvedCount: scan.failedCount,
        consistentPassedCount: scan.passedCount,
      };
    }

    await scan.save();

    return scan;
  }
}

module.exports = ScanEngine;
