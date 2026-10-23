const { Scan, TestResult } = require('../models');

class RegressionEngine {
  /**
   * Compares a target scan against a baseline scan and computes security regressions,
   * fixes, and an overall regression verdict.
   * 
   * @param {string|import('mongoose').Types.ObjectId} targetScanId
   * @param {string|import('mongoose').Types.ObjectId} baselineScanId
   * @returns {Promise<Object>} Detailed regression analysis
   */
  async compareScans(targetScanId, baselineScanId) {
    if (!targetScanId) {
      throw new Error('targetScanId is required for regression comparison.');
    }
    if (!baselineScanId) {
      throw new Error('baselineScanId is required for regression comparison.');
    }

    const [targetScan, baselineScan] = await Promise.all([
      Scan.findById(targetScanId),
      Scan.findById(baselineScanId),
    ]);

    if (!targetScan) {
      const err = new Error(`Target scan with ID "${targetScanId}" not found.`);
      err.statusCode = 404;
      err.code = 'TARGET_SCAN_NOT_FOUND';
      throw err;
    }

    if (!baselineScan) {
      const err = new Error(`Baseline scan with ID "${baselineScanId}" not found.`);
      err.statusCode = 404;
      err.code = 'BASELINE_SCAN_NOT_FOUND';
      throw err;
    }

    const [targetResults, baselineResults] = await Promise.all([
      TestResult.find({ scanId: targetScan._id }).sort({ testCaseId: 1 }),
      TestResult.find({ scanId: baselineScan._id }).sort({ testCaseId: 1 }),
    ]);

    // Map baseline results by testCaseId
    const baselineMap = new Map();
    for (const bRes of baselineResults) {
      baselineMap.set(bRes.testCaseId, bRes);
    }

    const regressions = [];
    const fixes = [];
    const unresolved = [];
    const consistentPassed = [];
    const details = [];

    for (const tRes of targetResults) {
      const bRes = baselineMap.get(tRes.testCaseId);

      let diffType = 'NEW_TEST';
      const baselineVerdict = bRes ? bRes.verdict : 'not_in_baseline';

      if (bRes) {
        if (bRes.verdict === 'passed' && tRes.verdict === 'failed') {
          diffType = 'REGRESSION';
          regressions.push({
            testCaseId: tRes.testCaseId,
            testCaseName: tRes.testCaseName,
            category: tRes.category,
            severity: tRes.severity,
            baselineVerdict: bRes.verdict,
            targetVerdict: tRes.verdict,
            evidence: tRes.evidence,
          });
        } else if (bRes.verdict === 'failed' && tRes.verdict === 'passed') {
          diffType = 'FIX';
          fixes.push({
            testCaseId: tRes.testCaseId,
            testCaseName: tRes.testCaseName,
            category: tRes.category,
            severity: tRes.severity,
            baselineVerdict: bRes.verdict,
            targetVerdict: tRes.verdict,
          });
        } else if (bRes.verdict === 'failed' && tRes.verdict === 'failed') {
          diffType = 'UNRESOLVED';
          unresolved.push({
            testCaseId: tRes.testCaseId,
            testCaseName: tRes.testCaseName,
            category: tRes.category,
            severity: tRes.severity,
            baselineVerdict: bRes.verdict,
            targetVerdict: tRes.verdict,
          });
        } else if (bRes.verdict === 'passed' && tRes.verdict === 'passed') {
          diffType = 'CONSISTENT_PASS';
          consistentPassed.push({
            testCaseId: tRes.testCaseId,
            testCaseName: tRes.testCaseName,
            category: tRes.category,
          });
        }
      }

        details.push({
          testCaseId: tRes.testCaseId,
          testCaseName: tRes.testCaseName,
          testCaseVersion: tRes.testCaseVersion || '1.0.0',
          baselineVersion: bRes ? (bRes.testCaseVersion || '1.0.0') : null,
          isVersionChanged: bRes && tRes.testCaseVersion && bRes.testCaseVersion && tRes.testCaseVersion !== bRes.testCaseVersion,
          category: tRes.category,
          severity: tRes.severity,
          baselineVerdict,
          targetVerdict: tRes.verdict,
          diffType,
          evidence: tRes.evidence || null,
          latencyDeltaMs: bRes ? (tRes.latencyMs || 0) - (bRes.latencyMs || 0) : 0,
        });
      }

      // Check for test cases present in baseline but missing from target scan
      const targetIds = new Set(targetResults.map((r) => r.testCaseId));
      const removedTests = [];
      for (const bRes of baselineResults) {
        if (!targetIds.has(bRes.testCaseId)) {
          const removedItem = {
            testCaseId: bRes.testCaseId,
            testCaseName: bRes.testCaseName,
            testCaseVersion: bRes.testCaseVersion || '1.0.0',
            category: bRes.category,
            severity: bRes.severity,
            baselineVerdict: bRes.verdict,
            targetVerdict: 'not_in_target',
            diffType: 'REMOVED_TEST',
          };
          removedTests.push(removedItem);
          details.push(removedItem);
        }
      }

      // Determine overall regression verdict
      let verdict = 'UNCHANGED';
      if (regressions.length > 0) {
        verdict = 'REGRESSED';
      } else if (fixes.length > 0) {
        verdict = 'IMPROVED';
      }

      const baselinePassRate = baselineScan.totalTests > 0
        ? (baselineScan.passedCount / baselineScan.totalTests) * 100
        : 0;

      const targetPassRate = targetScan.totalTests > 0
        ? (targetScan.passedCount / targetScan.totalTests) * 100
        : 0;

      const passRateDelta = Math.round((targetPassRate - baselinePassRate) * 10) / 10;

      return {
        verdict,
        targetScanId: targetScan._id.toString(),
        baselineScanId: baselineScan._id.toString(),
        applicationId: targetScan.applicationId.toString(),
        summary: {
          totalEvaluated: targetResults.length,
          regressionsCount: regressions.length,
          fixesCount: fixes.length,
          unresolvedCount: unresolved.length,
          consistentPassedCount: consistentPassed.length,
          removedTestsCount: removedTests.length,
          baselinePassRate: Math.round(baselinePassRate * 10) / 10,
          targetPassRate: Math.round(targetPassRate * 10) / 10,
          passRateDelta,
        },
        regressions,
        fixes,
        unresolved,
        removedTests,
        details,
      };
  }
}

module.exports = RegressionEngine;
