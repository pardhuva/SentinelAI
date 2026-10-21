const app = require('./app');
const config = require('./config/env');

const server = app.listen(config.port, () => {
  console.log(`[SentinelAI] Server running in ${config.nodeEnv} mode on port ${config.port}`);
  console.log(`[SentinelAI] Health endpoint available at http://localhost:${config.port}/api/health`);
});

// Graceful shutdown handling
function shutdown(signal) {
  console.log(`\n[SentinelAI] Received ${signal}. Closing HTTP server gracefully...`);
  server.close(() => {
    console.log('[SentinelAI] HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown after timeout if pending requests hang
  setTimeout(() => {
    console.error('[SentinelAI] Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
