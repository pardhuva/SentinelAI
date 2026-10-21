const { Application } = require('../models');

/**
 * Register a new target application
 * POST /api/applications
 */
async function createApplication(req, res, next) {
  try {
    const { name, description, targetConfig } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Field "name" is required and must be a string.' },
      });
    }

    if (!targetConfig?.url || typeof targetConfig.url !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Field "targetConfig.url" is required and must be a valid URL string.' },
      });
    }

    const application = await Application.create({
      name: name.trim(),
      description: (description || '').trim(),
      targetConfig: {
        type: targetConfig.type || 'http',
        url: targetConfig.url.trim(),
        method: targetConfig.method || 'POST',
        headers: targetConfig.headers || {},
        canaryValue: targetConfig.canaryValue || '',
        timeoutMs: targetConfig.timeoutMs || 5000,
      },
    });

    return res.status(201).json({
      success: true,
      data: application,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List registered applications
 * GET /api/applications
 */
async function listApplications(req, res, next) {
  try {
    const applications = await Application.find({ isActive: true }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: applications,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get application details
 * GET /api/applications/:id
 */
async function getApplication(req, res, next) {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APP_NOT_FOUND', message: `Application not found with ID "${req.params.id}".` },
      });
    }

    return res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update application configuration
 * PUT /api/applications/:id
 */
async function updateApplication(req, res, next) {
  try {
    const { name, description, targetConfig, isActive } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APP_NOT_FOUND', message: `Application not found with ID "${req.params.id}".` },
      });
    }

    if (name !== undefined) application.name = name.trim();
    if (description !== undefined) application.description = description.trim();
    if (isActive !== undefined) application.isActive = Boolean(isActive);

    if (targetConfig) {
      if (targetConfig.url) application.targetConfig.url = targetConfig.url.trim();
      if (targetConfig.type) application.targetConfig.type = targetConfig.type;
      if (targetConfig.method) application.targetConfig.method = targetConfig.method;
      if (targetConfig.headers !== undefined) application.targetConfig.headers = targetConfig.headers;
      if (targetConfig.canaryValue !== undefined) application.targetConfig.canaryValue = targetConfig.canaryValue;
      if (targetConfig.timeoutMs) application.targetConfig.timeoutMs = targetConfig.timeoutMs;
    }

    await application.save();

    return res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete application
 * DELETE /api/applications/:id
 */
async function deleteApplication(req, res, next) {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APP_NOT_FOUND', message: `Application not found with ID "${req.params.id}".` },
      });
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Application deleted successfully.' },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createApplication,
  listApplications,
  getApplication,
  updateApplication,
  deleteApplication,
};
