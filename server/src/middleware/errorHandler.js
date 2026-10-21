const config = require('../config/env');

/**
 * Centralized Error Handling Middleware
 * Ensures all API errors return a consistent JSON response.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isServerFault = statusCode >= 500;

  // Log server errors for internal monitoring
  if (isServerFault) {
    console.error(`[Internal Error] ${req.method} ${req.originalUrl}:`, err);
  }

  const response = {
    success: false,
    error: {
      code: err.code || (isServerFault ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
      message: isServerFault && config.isProduction ? 'An unexpected error occurred' : err.message,
    },
  };

  if (err.details) {
    response.error.details = err.details;
  }

  if (!config.isProduction && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
