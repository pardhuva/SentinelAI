const scanService = require('../services/scan.service');

/**
 * Trigger a new security scan
 * POST /api/scans
 */
async function startScan(req, res, next) {
  try {
    const { applicationId, triggerSource, baselineScanId, sync } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Field "applicationId" is required.' },
      });
    }

    const isSync = sync === true || req.query.sync === 'true';

    const scan = await scanService.triggerScan({
      applicationId,
      triggerSource,
      baselineScanId,
      sync: isSync,
    });

    return res.status(201).json({
      success: true,
      data: scan,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List all scans with pagination
 * GET /api/scans
 */
async function listScans(req, res, next) {
  try {
    const { applicationId, page, limit } = req.query;
    const result = await scanService.listScans({ applicationId, page, limit });

    return res.status(200).json({
      success: true,
      data: result.scans,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get scan details
 * GET /api/scans/:id
 */
async function getScan(req, res, next) {
  try {
    const scan = await scanService.getScanById(req.params.id);

    return res.status(200).json({
      success: true,
      data: scan,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get test results for a scan
 * GET /api/scans/:id/results
 */
async function getScanResults(req, res, next) {
  try {
    const { verdict, page, limit } = req.query;
    const result = await scanService.getScanResults(req.params.id, { verdict, page, limit });

    return res.status(200).json({
      success: true,
      data: result.results,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get findings for a scan
 * GET /api/scans/:id/findings
 */
async function getScanFindings(req, res, next) {
  try {
    const { severity, page, limit } = req.query;
    const result = await scanService.getScanFindings(req.params.id, { severity, page, limit });

    return res.status(200).json({
      success: true,
      data: result.findings,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startScan,
  listScans,
  getScan,
  getScanResults,
  getScanFindings,
};
