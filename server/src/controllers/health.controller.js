const config = require('../config/env');

/**
 * Health check handler
 * Returns system readiness, uptime, and metadata.
 */
function getHealth(req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'SentinelAI Core API',
      version: '0.1.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    },
  });
}

module.exports = {
  getHealth,
};
