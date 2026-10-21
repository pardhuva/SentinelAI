const findingService = require('../services/finding.service');

/**
 * List findings with pagination and filtering
 * GET /api/findings
 */
async function listFindings(req, res, next) {
  try {
    const { applicationId, scanId, severity, status, category, page, limit } = req.query;
    const result = await findingService.listFindings({
      applicationId,
      scanId,
      severity,
      status,
      category,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.findings,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get findings metrics summary
 * GET /api/findings/summary
 */
async function getSummary(req, res, next) {
  try {
    const { applicationId } = req.query;
    const summary = await findingService.getFindingsSummary({ applicationId });

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single finding by ID
 * GET /api/findings/:id
 */
async function getFinding(req, res, next) {
  try {
    const finding = await findingService.getFindingById(req.params.id);

    return res.status(200).json({
      success: true,
      data: finding,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update finding status and triage notes
 * PATCH /api/findings/:id
 */
async function updateFinding(req, res, next) {
  try {
    const { status, notes } = req.body;
    const updated = await findingService.updateFinding(req.params.id, { status, notes });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listFindings,
  getSummary,
  getFinding,
  updateFinding,
};
