const { Application, Scan, TestResult, Finding } = require('../models');
const ScanEngine = require('../test-engine/ScanEngine');

const scanEngine = new ScanEngine();

/**
 * Creates and immediately starts a new scan for an application.
 * 
 * @param {Object} params
 * @param {string} params.applicationId
 * @param {string} [params.triggerSource='manual']
 * @param {string} [params.baselineScanId]
 * @returns {Promise<import('../models/Scan')>}
 */
async function triggerScan({ applicationId, triggerSource = 'manual', baselineScanId = null }) {
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
    triggerSource,
    baselineScanId: baselineScanId || null,
  });

  // For Milestone 4, we execute the scan synchronously via ScanEngine.
  // In Milestone 5, this will be enqueued to BullMQ background worker!
  const executedScan = await scanEngine.executeScan(scan._id);
  return executedScan;
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

module.exports = {
  triggerScan,
  listScans,
  getScanById,
  getScanResults,
  getScanFindings,
};
