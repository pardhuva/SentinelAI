const { Application } = require('../models');
const { getAvailableProfiles } = require('../test-engine/test-library');
const { validateTestCase } = require('../test-engine/testCaseValidator');

const VALID_PROFILES = ['general', 'hr', 'banking', 'healthcare', 'customer_support', 'custom'];

/**
 * Register a new target application
 * POST /api/applications
 */
async function createApplication(req, res, next) {
  try {
    const {
      name,
      description,
      targetConfig,
      securityProfile = 'general',
      enabledCategories = [],
      disabledTestIds = [],
      customTestCases = [],
    } = req.body;

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

    if (securityProfile && !VALID_PROFILES.includes(securityProfile)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PROFILE',
          message: `Invalid security profile "${securityProfile}". Allowed: ${VALID_PROFILES.join(', ')}`,
        },
      });
    }

    // Validate any submitted custom test cases
    if (Array.isArray(customTestCases) && customTestCases.length > 0) {
      for (const customCase of customTestCases) {
        try {
          validateTestCase(customCase);
        } catch (valErr) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TEST_CASE',
              message: `Custom test case validation failed: ${valErr.message}`,
            },
          });
        }
      }
    }

    const application = await Application.create({
      name: name.trim(),
      description: (description || '').trim(),
      securityProfile,
      enabledCategories: Array.isArray(enabledCategories) ? enabledCategories : [],
      disabledTestIds: Array.isArray(disabledTestIds) ? disabledTestIds : [],
      customTestCases: Array.isArray(customTestCases) ? customTestCases : [],
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
 * Get available testing profiles
 * GET /api/applications/profiles
 */
function getProfiles(req, res) {
  const profiles = getAvailableProfiles();
  return res.status(200).json({
    success: true,
    data: profiles,
  });
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
 * PUT/PATCH /api/applications/:id
 */
async function updateApplication(req, res, next) {
  try {
    const ALLOWED_UPDATE_FIELDS = [
      'name',
      'description',
      'targetConfig',
      'securityProfile',
      'enabledCategories',
      'disabledTestIds',
      'customTestCases',
      'isActive',
    ];

    const disallowedFields = Object.keys(req.body).filter(
      (key) => !ALLOWED_UPDATE_FIELDS.includes(key)
    );

    if (disallowedFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_FIELDS',
          message: `The following fields cannot be modified or are not supported: ${disallowedFields.join(', ')}`,
        },
      });
    }

    const {
      name,
      description,
      targetConfig,
      securityProfile,
      enabledCategories,
      disabledTestIds,
      customTestCases,
      isActive,
    } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APP_NOT_FOUND', message: `Application not found with ID "${req.params.id}".` },
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Field "name" must be a non-empty string.' },
        });
      }
      application.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Field "description" must be a string.' },
        });
      }
      application.description = description.trim();
    }

    if (isActive !== undefined) {
      application.isActive = Boolean(isActive);
    }

    if (securityProfile !== undefined) {
      if (!VALID_PROFILES.includes(securityProfile)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PROFILE',
            message: `Invalid security profile "${securityProfile}". Allowed: ${VALID_PROFILES.join(', ')}`,
          },
        });
      }
      application.securityProfile = securityProfile;
    }

    if (enabledCategories !== undefined) {
      if (!Array.isArray(enabledCategories)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Field "enabledCategories" must be an array of strings.' },
        });
      }
      application.enabledCategories = enabledCategories.filter((c) => typeof c === 'string' && c.trim());
    }

    if (disabledTestIds !== undefined) {
      if (!Array.isArray(disabledTestIds)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Field "disabledTestIds" must be an array of strings.' },
        });
      }
      application.disabledTestIds = disabledTestIds.filter((id) => typeof id === 'string' && id.trim());
    }

    if (customTestCases !== undefined) {
      if (!Array.isArray(customTestCases)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Field "customTestCases" must be an array.' },
        });
      }
      for (const tc of customTestCases) {
        try {
          validateTestCase(tc);
        } catch (valErr) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TEST_CASE',
              message: `Custom test case validation failed: ${valErr.message}`,
            },
          });
        }
      }
      application.customTestCases = customTestCases;
    }

    if (targetConfig !== undefined) {
      if (typeof targetConfig !== 'object' || targetConfig === null || Array.isArray(targetConfig)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Field "targetConfig" must be an object.' },
        });
      }
      if (targetConfig.url !== undefined) {
        if (typeof targetConfig.url !== 'string' || !targetConfig.url.trim()) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'Field "targetConfig.url" must be a non-empty string.' },
          });
        }
        application.targetConfig.url = targetConfig.url.trim();
      }
      if (targetConfig.type !== undefined) {
        if (!['http', 'demo'].includes(targetConfig.type)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'Field "targetConfig.type" must be "http" or "demo".' },
          });
        }
        application.targetConfig.type = targetConfig.type;
      }
      if (targetConfig.method !== undefined) {
        if (!['POST', 'GET'].includes(targetConfig.method)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'Field "targetConfig.method" must be "POST" or "GET".' },
          });
        }
        application.targetConfig.method = targetConfig.method;
      }
      if (targetConfig.headers !== undefined) {
        if (typeof targetConfig.headers !== 'object' || targetConfig.headers === null || Array.isArray(targetConfig.headers)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'Field "targetConfig.headers" must be an object.' },
          });
        }
        application.targetConfig.headers = targetConfig.headers;
      }
      if (targetConfig.canaryValue !== undefined) {
        application.targetConfig.canaryValue = String(targetConfig.canaryValue).trim();
      }
      if (targetConfig.timeoutMs !== undefined) {
        const timeout = Number(targetConfig.timeoutMs);
        if (isNaN(timeout) || timeout < 500 || timeout > 30000) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'Field "targetConfig.timeoutMs" must be a number between 500 and 30000.' },
          });
        }
        application.targetConfig.timeoutMs = timeout;
      }
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
  getProfiles,
  getApplication,
  updateApplication,
  deleteApplication,
};
