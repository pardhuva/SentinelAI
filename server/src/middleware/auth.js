const crypto = require('crypto');
const config = require('../config/env');
const { KNOWN_DEV_KEYS } = require('../config/validateEnv');

/**
 * Constant-time string comparison to defend against timing attacks on authentication keys.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * API Authentication & Authorization Middleware
 * Validates request credentials via `x-api-key` header or `Authorization: Bearer <token>`.
 *
 * Security Invariants:
 * - In production: Strict fail-closed behavior. Server fails closed if API key is missing,
 *   unconfigured, or matches any known development key.
 * - Timing-attack resistant constant-time comparison.
 * - In development: Permits unauthenticated development access only when REQUIRE_AUTH is not 'true'.
 */
function authenticateApi(req, res, next) {
  // Public health check is always exempt
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const isProduction = config.nodeEnv === 'production';
  const rawExpectedKey = process.env.SENTINEL_API_KEY || process.env.API_KEY || null;

  // Extract key from x-api-key header or Authorization: Bearer <token>
  const headerKey = req.headers['x-api-key'];
  let bearerToken = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.slice(7).trim();
  }

  const providedKey = (headerKey || bearerToken || '').trim();

  // ==========================================
  // Production Execution Path (Fail-Closed)
  // ==========================================
  if (isProduction) {
    // 1. Production must fail closed if no server secret is configured
    if (!rawExpectedKey || rawExpectedKey.trim().length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed. Production server secret is unconfigured. All requests fail closed.',
        },
      });
    }

    const expectedKey = rawExpectedKey.trim();

    // 2. Production must reject known development keys
    if (KNOWN_DEV_KEYS.has(expectedKey.toLowerCase())) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed. Production cannot operate with a known development API key.',
        },
      });
    }

    // 3. Strict authentication verification
    if (!providedKey || !constantTimeCompare(providedKey, expectedKey)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed. A valid API key must be supplied via "x-api-key" header or "Authorization: Bearer <key>".',
        },
      });
    }

    req.auth = { authenticated: true, key: providedKey };
    return next();
  }

  // ==========================================
  // Development / Test Execution Path
  // ==========================================
  const devExpectedKey = rawExpectedKey || 'sentinel-dev-key';
  const requireAuth = process.env.REQUIRE_AUTH === 'true';

  // If auth is not required in dev and no key was supplied, allow in dev mode
  if (!requireAuth && !providedKey) {
    req.auth = { authenticated: false, mode: 'unauthenticated_dev' };
    return next();
  }

  // If a key was provided or requireAuth is active, validate it
  if (!providedKey || !constantTimeCompare(providedKey, devExpectedKey)) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed. A valid API key must be supplied via "x-api-key" header or "Authorization: Bearer <key>".',
      },
    });
  }

  req.auth = { authenticated: true, key: providedKey };
  return next();
}

module.exports = {
  authenticateApi,
  constantTimeCompare,
};
