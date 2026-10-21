const regressionService = require('../services/regression.service');

/**
 * Set a scan as application baseline
 * POST /api/applications/:id/baseline
 */
async function setBaseline(req, res, next) {
  try {
    const { scanId } = req.body;
    if (!scanId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Field "scanId" is required.' },
      });
    }

    const result = await regressionService.setApplicationBaseline(req.params.id, scanId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get regression analysis for a scan
 * GET /api/scans/:id/regression
 */
async function getRegression(req, res, next) {
  try {
    const diff = await regressionService.getScanRegression(req.params.id);

    return res.status(200).json({
      success: true,
      data: diff,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Compare any two scans
 * POST /api/scans/:id/compare/:baselineId
 */
async function compareTwoScans(req, res, next) {
  try {
    const diff = await regressionService.compareScans(req.params.id, req.params.baselineId);

    return res.status(200).json({
      success: true,
      data: diff,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  setBaseline,
  getRegression,
  compareTwoScans,
};
