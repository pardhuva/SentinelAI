const config = require('../config/env');

/**
 * API Authentication & Authorization Middleware
 * Validates request credentials via `x-api-key` header or `Authorization: Bearer <token>`.
 * 
 * Rules:
 * - In production: Strict enforcement of configured API key.
 * - In development/test: If no API key is defined in environment, defaults to 'sentinel-dev-api-key-2026'
 *   while permitting unauthenticated requests with a dev warning if REQUIRE_AUTH is not explicitly 'true'.
 */
function authenticateApi(req, res, next) {
  // Public health check is always exempt
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const expectedKey = process.env.SENTINEL_API_KEY || process.env.API_KEY || (config.nodeEnv !== 'production' ? 'sentinel-dev-key' : null);
  const requireAuth = process.env.REQUIRE_AUTH === 'true' || config.nodeEnv === 'production';

  // Extract key from header or Bearer token
  const headerKey = req.headers['x-api-key'];
  let bearerToken = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.slice(7).trim();
  }

  const providedKey = headerKey || bearerToken;

  // If no auth required in dev and no key provided, allow with warning
  if (!requireAuth && !providedKey) {
    req.auth = { authenticated: false, mode: 'unauthenticated_dev' };
    return next();
  }

  // If key is expected and provided, validate it
  if (expectedKey) {
    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed. A valid API key must be supplied via "x-api-key" header or "Authorization: Bearer <key>".',
        },
      });
    }
  }

  req.auth = { authenticated: true, key: providedKey };
  next();
}

module.exports = {
  authenticateApi,
};
