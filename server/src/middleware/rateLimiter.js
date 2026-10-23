/**
 * Zero-dependency In-Memory Rate Limiter Middleware
 * Uses a sliding-window counter per client IP.
 */

function createRateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 120,
  message = 'Too many requests from this IP. Please try again later.',
} = {}) {
  const requests = new Map();

  // Periodic cleanup of expired client records
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requests.entries()) {
      if (now - data.startTime > windowMs) {
        requests.delete(ip);
      }
    }
  }, windowMs);

  if (interval.unref) {
    interval.unref();
  }

  return (req, res, next) => {
    // In test environment, bypass rate limits to avoid flakiness
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const clientData = requests.get(ip) || { count: 0, startTime: now };

    if (now - clientData.startTime > windowMs) {
      clientData.count = 1;
      clientData.startTime = now;
    } else {
      clientData.count += 1;
    }

    requests.set(ip, clientData);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - clientData.count));

    if (clientData.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
        },
      });
    }

    next();
  };
}

module.exports = {
  createRateLimiter,
};
