const { Application, Scan, TestResult, Finding } = require('../models');
const ScanEngine = require('../test-engine/ScanEngine');
const { addScanJob } = require('../queues/scan.queue');

const scanEngine = new ScanEngine();

/**
 * Creates and triggers a new scan for an application.
 * By default, enqueues to BullMQ background worker.
 * If sync=true, runs synchronously with ScanEngine.
 * 
 * @param {Object} params
 * @param {string} params.applicationId
 * @param {string} [params.triggerSource='manual']
 * @param {string} [params.baselineScanId]
 * @param {boolean} [params.sync=false]
 * @param {Array<Object>} [params.testCases]
 * @returns {Promise<import('../models/Scan')>}
 */
async function triggerScan({
  applicationId,
  triggerSource = 'manual',
  baselineScanId = null,
  sync = false,
  testCases = null,
}) {
  const application = await Application.findById(applicationId);
  if (!application) {
    const error = new Error(`Application with ID "${applicationId}" not found.`);
    error.statusCode = 404;
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  // Create scan record in pending state
  const scan = await Scan.create({
    applicationId: application._id,
    status: 'pending',
    progress: 0,
    triggerSource,
    baselineScanId: baselineScanId || null,
  });

  if (sync) {
    const executedScan = await scanEngine.executeScan(scan._id, { testCases });
    return executedScan;
  }

  // Enqueue job to background queue
  const job = await addScanJob({
    scanId: scan._id.toString(),
    applicationId: application._id.toString(),
    options: testCases ? { testCases } : {},
  });

  scan.jobId = String(job.id);
  await scan.save();

  return scan;
}

/**
 * Lists scans with pagination and filtering.
 */
async function listScans({ applicationId, page = 1, limit = 20 } = {}) {
  const query = {};
  if (applicationId) {
    query.applicationId = applicationId;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [scans, total] = await Promise.all([
    Scan.find(query)
      .populate('applicationId', 'name targetConfig.url')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take),
    Scan.countDocuments(query),
  ]);

  return {
    scans,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Retrieves a single scan by ID.
 */
async function getScanById(scanId) {
  const scan = await Scan.findById(scanId).populate('applicationId', 'name description targetConfig');
  if (!scan) {
    const error = new Error(`Scan with ID "${scanId}" not found.`);
    error.statusCode = 404;
    error.code = 'SCAN_NOT_FOUND';
    throw error;
  }
  return scan;
}

/**
 * Retrieves test results for a scan with optional verdict filter and pagination.
 */
async function getScanResults(scanId, { verdict, page = 1, limit = 50 } = {}) {
  const query = { scanId };
  if (verdict) {
    query.verdict = verdict;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [results, total] = await Promise.all([
    TestResult.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(take),
    TestResult.countDocuments(query),
  ]);

  return {
    results,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Retrieves findings for a scan with optional severity filter and pagination.
 */
async function getScanFindings(scanId, { severity, page = 1, limit = 50 } = {}) {
  const query = { scanId };
  if (severity) {
    query.severity = severity;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [findings, total] = await Promise.all([
    Finding.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(take),
    Finding.countDocuments(query),
  ]);

  return {
    findings,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Executes a side-by-side comparison between the vulnerable baseline and mitigated demo modes.
 * Automates:
 * 1. Ensures Demo application exists.
 * 2. Runs Scan 1 (Unmitigated) and assigns it as official baseline.
 * 3. Runs Scan 2 (Mitigated with x-sentinel-mitigation).
 * 4. Computes and returns the differential regression analysis.
 * 
 * @returns {Promise<Object>}
 */
async function runDemoAssessment() {
  const RegressionEngine = require('../test-engine/RegressionEngine');
  const regressionEngine = new RegressionEngine();

  // 1. Locate or create Acme HR Demo application
  let demoApp = await Application.findOne({ name: 'Acme HR Assistant (Demo Target)' });
  if (!demoApp) {
    demoApp = await Application.create({
      name: 'Acme HR Assistant (Demo Target)',
      description: 'Simulated AI application with vulnerable baseline and mitigated defense modes.',
      securityProfile: 'general',
      targetConfig: {
        type: 'http',
        url: 'http://127.0.0.1:5001/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        canaryValue: 'CANARY_SECRET_HR_9941_RESTRICTED',
        timeoutMs: 5000,
      },
    });
  }

  // 2. Scan 1: Vulnerable Run (Unmitigated)
  const vulnerableScanRecord = await Scan.create({
    applicationId: demoApp._id,
    status: 'pending',
    triggerSource: 'manual',
  });
  const vulnerableScan = await scanEngine.executeScan(vulnerableScanRecord._id);

  // Set vulnerable scan as baseline
  await Scan.updateMany({ applicationId: demoApp._id, isBaseline: true }, { isBaseline: false });
  vulnerableScan.isBaseline = true;
  await vulnerableScan.save();
  demoApp.currentBaselineScanId = vulnerableScan._id;
  await demoApp.save();

  // 3. Scan 2: Mitigated Run
  const mitigatedScanRecord = await Scan.create({
    applicationId: demoApp._id,
    status: 'pending',
    triggerSource: 'manual',
    baselineScanId: vulnerableScan._id,
  });

  // Temporarily set mitigation header on application targetConfig
  const prevHeaders = demoApp.targetConfig.headers;
  demoApp.targetConfig.headers = new Map([
    ...Array.from(prevHeaders ? (prevHeaders instanceof Map ? prevHeaders.entries() : Object.entries(prevHeaders)) : []),
    ['x-sentinel-mitigation', 'true'],
  ]);
  await demoApp.save();

  let mitigatedScan;
  try {
    mitigatedScan = await scanEngine.executeScan(mitigatedScanRecord._id);
  } finally {
    // Restore original headers
    demoApp.targetConfig.headers = prevHeaders;
    await demoApp.save();
  }

  // 4. Compare Scans
  const regressionDiff = await regressionEngine.compareScans(mitigatedScan._id, vulnerableScan._id);

  return {
    application: demoApp,
    vulnerableScan,
    mitigatedScan,
    regressionDiff,
    disclaimer: 'This assessment was executed against a simulated deterministic target to demonstrate the SentinelAI regression pipeline. It does not certify the security of a commercial third-party LLM.',
  };
}

module.exports = {
  triggerScan,
  listScans,
  getScanById,
  getScanResults,
  getScanFindings,
  runDemoAssessment,
};
