const { Queue } = require('bullmq');
const config = require('../config/env');
const { createRedisConnection } = require('../config/redis');
const { InMemoryQueue } = require('./in-memory-queue');

const QUEUE_NAME = 'security-scans';

const isMockMode = config.nodeEnv === 'test' || process.env.USE_MOCK_REDIS === 'true';

let scanQueue;

if (isMockMode) {
  scanQueue = new InMemoryQueue(QUEUE_NAME);
} else {
  const connection = createRedisConnection();
  scanQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
}

/**
 * Adds a security scan execution job to the queue.
 * 
 * @param {Object} payload
 * @param {string} payload.scanId - The MongoDB ID of the Scan
 * @param {string} payload.applicationId - The MongoDB ID of the Application
 * @param {Object} [payload.options] - Optional execution parameters (e.g., custom test cases)
 * @returns {Promise<import('bullmq').Job|import('./in-memory-queue').InMemoryJob>}
 */
async function addScanJob({ scanId, applicationId, options = {} }) {
  if (!scanId) {
    throw new Error('Cannot enqueue scan job: "scanId" is required.');
  }
  if (!applicationId) {
    throw new Error('Cannot enqueue scan job: "applicationId" is required.');
  }

  const job = await scanQueue.add(
    'execute-scan',
    {
      scanId: String(scanId),
      applicationId: String(applicationId),
      options,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  );

  return job;
}

/**
 * Gracefully shuts down the scan queue.
 */
async function closeScanQueue() {
  if (scanQueue && typeof scanQueue.close === 'function') {
    await scanQueue.close();
  }
}

module.exports = {
  QUEUE_NAME,
  scanQueue,
  addScanJob,
  closeScanQueue,
};
