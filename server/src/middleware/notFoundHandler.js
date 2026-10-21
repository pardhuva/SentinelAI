/**
 * 404 Not Found Middleware
 * Catches unmatched routes and forwards a consistent error format.
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
}

module.exports = notFoundHandler;
