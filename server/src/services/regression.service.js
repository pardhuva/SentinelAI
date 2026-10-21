const { Application, Scan } = require('../models');
const RegressionEngine = require('../test-engine/RegressionEngine');

const regressionEngine = new RegressionEngine();

/**
 * Sets a specific scan as the official baseline for an application.
 * 
 * @param {string} applicationId
 * @param {string} scanId
 * @returns {Promise<Object>}
 */
async function setApplicationBaseline(applicationId, scanId) {
  const application = await Application.findById(applicationId);
  if (!application) {
    const err = new Error(`Application with ID "${applicationId}" not found.`);
    err.statusCode = 404;
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  const scan = await Scan.findOne({ _id: scanId, applicationId });
  if (!scan) {
    const err = new Error(`Scan with ID "${scanId}" not found for this application.`);
    err.statusCode = 404;
    err.code = 'SCAN_NOT_FOUND';
    throw err;
  }

  if (scan.status !== 'completed') {
    const err = new Error(`Cannot set an incomplete scan (status: ${scan.status}) as baseline.`);
    err.statusCode = 400;
    err.code = 'INVALID_BASELINE_SCAN';
    throw err;
  }

  // Unmark previous baseline scans for this application
  await Scan.updateMany({ applicationId, isBaseline: true }, { isBaseline: false });

  // Mark this scan as baseline
  scan.isBaseline = true;
  await scan.save();

  // Update application pointer
  application.currentBaselineScanId = scan._id;
  await application.save();

  return {
    applicationId: application._id,
    currentBaselineScanId: scan._id,
    scan,
  };
}

/**
 * Computes regression diff for a scan against its linked baseline or application default baseline.
 * 
 * @param {string} scanId
 * @returns {Promise<Object>}
 */
async function getScanRegression(scanId) {
  const scan = await Scan.findById(scanId);
  if (!scan) {
    const err = new Error(`Scan with ID "${scanId}" not found.`);
    err.statusCode = 404;
    err.code = 'SCAN_NOT_FOUND';
    throw err;
  }

  let baselineId = scan.baselineScanId;

  if (!baselineId) {
    const application = await Application.findById(scan.applicationId);
    if (application && application.currentBaselineScanId) {
      baselineId = application.currentBaselineScanId;
    }
  }

  if (!baselineId || String(baselineId) === String(scan._id)) {
    return {
      verdict: 'NO_BASELINE',
      message: 'No distinct baseline scan configured to compare against.',
      scanId: scan._id.toString(),
      summary: {
        totalEvaluated: scan.totalTests || 0,
        regressionsCount: 0,
        fixesCount: 0,
        unresolvedCount: scan.failedCount || 0,
        consistentPassedCount: scan.passedCount || 0,
      },
      regressions: [],
      fixes: [],
      unresolved: [],
      details: [],
    };
  }

  return await regressionEngine.compareScans(scan._id, baselineId);
}

/**
 * Compares any two arbitrary scans.
 * 
 * @param {string} targetScanId
 * @param {string} baselineScanId
 * @returns {Promise<Object>}
 */
async function compareScans(targetScanId, baselineScanId) {
  return await regressionEngine.compareScans(targetScanId, baselineScanId);
}

module.exports = {
  setApplicationBaseline,
  getScanRegression,
  compareScans,
};
