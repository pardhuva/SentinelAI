/**
 * SentinelAI Standalone Queue Worker Service
 * Runs independently from the REST API server process for production container deployments.
 */

const config = require('./config/env');
const { validateEnv } = require('./config/validateEnv');
const { connectDB, disconnectDB } = require('./config/database');
const { createScanWorker, closeScanWorker } = require('./workers/scan.worker');
const { closeScanQueue } = require('./queues/scan.queue');

let isShuttingDown = false;

async function startWorker() {
  try {
    // 0. Validate environment configuration
    validateEnv(config);

    // 1. Connect to database
    await connectDB();

    // 2. Start worker
    createScanWorker();
    console.log(`[SentinelAI Worker Service] Scan worker successfully initialized in ${config.nodeEnv} mode.`);
  } catch (err) {
    console.error(`[SentinelAI Worker Service] Startup failure: ${err.message}`);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[SentinelAI Worker Service] Received ${signal}. Shutting down gracefully...`);
  try {
    await closeScanWorker();
    await closeScanQueue();
    await disconnectDB();
    console.log('[SentinelAI Worker Service] All worker resources cleaned up.');
    process.exit(0);
  } catch (err) {
    console.error('[SentinelAI Worker Service] Error during shutdown:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startWorker();
