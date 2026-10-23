const { Worker } = require('bullmq');
const config = require('../config/env');
const { createRedisConnection } = require('../config/redis');
const { InMemoryWorker } = require('../queues/in-memory-queue');
const { QUEUE_NAME } = require('../queues/scan.queue');
const { Scan } = require('../models');
const ScanEngine = require('../test-engine/ScanEngine');

const scanEngine = new ScanEngine();

/**
 * Core processor for executing security scan jobs.
 * 
 * @param {import('bullmq').Job|import('../queues/in-memory-queue').InMemoryJob} job
 * @returns {Promise<Object>}
 */
async function processScanJob(job) {
  const { scanId, options = {} } = job.data;
  console.log(`[ScanWorker] Starting scan job #${job.id} for scanId: ${scanId}`);

  // Wire progress callback to job.updateProgress
  const completedScan = await scanEngine.executeScan(scanId, {
    ...options,
    onProgress: async (progressData) => {
      await job.updateProgress(progressData);
    },
  });

  console.log(
    `[ScanWorker] Scan #${scanId} finished with status: ${completedScan.status} (Tests: ${completedScan.totalTests}, Failed: ${completedScan.failedCount})`
  );

  return {
    scanId: completedScan._id.toString(),
    status: completedScan.status,
    totalTests: completedScan.totalTests,
    passedCount: completedScan.passedCount,
    failedCount: completedScan.failedCount,
  };
}

let scanWorker = null;

/**
 * Initializes and starts the background scan worker.
 * 
 * @param {Object} [overrideOptions]
 * @returns {Worker|InMemoryWorker}
 */
function createScanWorker(overrideOptions = {}) {
  if (config.nodeEnv === 'production' && process.env.USE_MOCK_REDIS === 'true') {
    throw new Error('[SentinelAI Worker] Production cannot silently fall back to an in-memory worker. Authenticated Redis is required.');
  }

  const isMockMode = config.nodeEnv === 'test' || (process.env.USE_MOCK_REDIS === 'true' && config.nodeEnv !== 'production');

  if (scanWorker) {
    return scanWorker;
  }

  if (isMockMode) {
    scanWorker = new InMemoryWorker(QUEUE_NAME, processScanJob, {
      concurrency: 2,
      ...overrideOptions,
    });
  } else {
    const connection = createRedisConnection();
    scanWorker = new Worker(QUEUE_NAME, processScanJob, {
      connection,
      concurrency: 2,
      ...overrideOptions,
    });
  }

  scanWorker.on('completed', (job, result) => {
    console.log(`[ScanWorker] Job #${job.id} successfully completed:`, result);
  });

  scanWorker.on('failed', async (job, err) => {
    console.error(
      `[ScanWorker] Job #${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts || 1}): ${err.message}`
    );

    // If all retries are exhausted, update the database record
    if (job && job.attemptsMade >= (job.opts?.attempts || 1)) {
      try {
        const scan = await Scan.findById(job.data.scanId);
        if (scan && scan.status !== 'completed') {
          scan.status = 'failed';
          scan.error = {
            code: 'SCAN_RETRIES_EXHAUSTED',
            message: err.message || 'Scan job failed and exhausted all retry attempts.',
          };
          scan.completedAt = new Date();
          await scan.save();
        }
      } catch (dbErr) {
        console.error('[ScanWorker] Failed to mark scan as failed in DB:', dbErr.message);
      }
    }
  });

  return scanWorker;
}

/**
 * Gracefully shuts down the background scan worker.
 */
async function closeScanWorker() {
  if (scanWorker && typeof scanWorker.close === 'function') {
    await scanWorker.close();
    scanWorker = null;
  }
}

module.exports = {
  createScanWorker,
  closeScanWorker,
  processScanJob,
};
