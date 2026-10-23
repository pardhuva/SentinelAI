const mongoose = require('mongoose');

/**
 * Middleware to validate MongoDB ObjectId parameters in route URLs.
 * Prevents CastError crashes and validates input parameters.
 * 
 * @param {string[]} [paramNames=['id']] - Array of parameter names to validate
 */
function validateObjectId(paramNames = ['id']) {
  return (req, res, next) => {
    for (const param of paramNames) {
      const val = req.params[param];
      if (val && !mongoose.Types.ObjectId.isValid(val)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_IDENTIFIER',
            message: `Invalid format for parameter "${param}". Must be a 24-character hexadecimal MongoDB ObjectId.`,
          },
        });
      }
    }
    next();
  };
}

/**
 * Sanitizes and bounds query pagination parameters.
 */
function sanitizePagination(req, res, next) {
  if (req.query.page) {
    const parsedPage = parseInt(req.query.page, 10);
    req.query.page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  }
  if (req.query.limit) {
    const parsedLimit = parseInt(req.query.limit, 10);
    req.query.limit = isNaN(parsedLimit) || parsedLimit < 1 ? 20 : Math.min(100, parsedLimit);
  }
  next();
}

module.exports = {
  validateObjectId,
  sanitizePagination,
};
