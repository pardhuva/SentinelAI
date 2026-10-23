const app = require('./app');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');
const { createScanWorker, closeScanWorker } = require('./workers/scan.worker');
const { closeScanQueue } = require('./queues/scan.queue');

let server;

async function startServer() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Start background scan worker
    createScanWorker();
    console.log('[SentinelAI] Background scan worker started.');

    // 3. Start HTTP server
    server = app.listen(config.port, () => {
      console.log(`[SentinelAI] Server running in ${config.nodeEnv} mode on port ${config.port}`);
      console.log(`[SentinelAI] Health endpoint available at http://localhost:${config.port}/api/health`);
    });
  } catch (err) {
    console.error(`[SentinelAI] Startup failure: ${err.message}`);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function shutdown(signal) {
  console.log(`\n[SentinelAI] Received ${signal}. Closing gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('[SentinelAI] HTTP server closed.');
      try {
        await closeScanWorker();
        await closeScanQueue();
        await disconnectDB();
        console.log('[SentinelAI] All resources cleaned up.');
        process.exit(0);
      } catch (err) {
        console.error('[SentinelAI] Error during shutdown:', err.message);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // Force shutdown after timeout if pending requests hang
  setTimeout(() => {
    console.error('[SentinelAI] Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

module.exports = server;

