const request = require('supertest');
const app = require('../src/app');
const demoApp = require('../../demo-target/src/app');
const demoConfig = require('../../demo-target/src/config');
const { Application, Scan, TestResult, Finding } = require('../src/models');
const { addScanJob, closeScanQueue } = require('../src/queues/scan.queue');
const { createScanWorker, closeScanWorker } = require('../src/workers/scan.worker');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setupMongo');

jest.setTimeout(30000);

describe('BullMQ Asynchronous Scan Processing & Worker Pipeline', () => {
  let demoServer;
  let demoServerUrl;
  let worker;

  beforeAll(async () => {
    // 1. Initialize in-memory MongoDB
    await setupTestDB();

    // 2. Spin up demo target on an ephemeral port
    await new Promise((resolve) => {
      demoServer = demoApp.listen(0, () => {
        const port = demoServer.address().port;
        demoServerUrl = `http://127.0.0.1:${port}/api/chat`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (worker) {
      await closeScanWorker();
    }
    await closeScanQueue();
    if (demoServer) {
      await new Promise((resolve) => demoServer.close(resolve));
    }
    await teardownTestDB();
  });

  afterEach(async () => {
    if (worker) {
      await closeScanWorker();
      worker = null;
    }
    await clearTestDB();
  });

  describe('Queue Producer (addScanJob)', () => {
    it('should validate required fields before adding to queue', async () => {
      await expect(addScanJob({})).rejects.toThrow('Cannot enqueue scan job: "scanId" is required.');
      await expect(addScanJob({ scanId: '123' })).rejects.toThrow('Cannot enqueue scan job: "applicationId" is required.');
    });

    it('should configure job with 3 retry attempts and exponential backoff', async () => {
      const job = await addScanJob({
        scanId: 'mock-scan-id',
        applicationId: 'mock-app-id',
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data.scanId).toBe('mock-scan-id');
      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      });
    });
  });

  describe('Worker Processing & Progress Tracking', () => {
    it('should pick up queued scan, update progress, and mark scan completed in MongoDB', async () => {
      // 1. Create Application
      const application = await Application.create({
        name: 'Async Target App',
        targetConfig: {
          type: 'http',
          url: demoServerUrl,
          canaryValue: demoConfig.syntheticCanary,
        },
      });

      // 2. Create Scan in pending state
      const scan = await Scan.create({
        applicationId: application._id,
        status: 'pending',
        progress: 0,
      });

      // 3. Initialize background worker
      worker = createScanWorker();

      // 4. Track completion via worker event
      const jobCompletedPromise = new Promise((resolve, reject) => {
        worker.once('completed', (job, result) => {
          resolve({ job, result });
        });
        worker.once('failed', (job, err) => {
          reject(err);
        });
      });

      // 5. Enqueue scan
      const job = await addScanJob({
        scanId: scan._id.toString(),
        applicationId: application._id.toString(),
      });

      expect(job.id).toBeDefined();

      // 6. Await worker completion
      const { result } = await jobCompletedPromise;
      expect(result.status).toBe('completed');
      expect(result.totalTests).toBeGreaterThanOrEqual(4);

      // 7. Verify persisted scan in DB
      const updatedScan = await Scan.findById(scan._id);
      expect(updatedScan.status).toBe('completed');
      expect(updatedScan.progress).toBe(100);
      expect(updatedScan.completedAt).toBeDefined();
      expect(updatedScan.failedCount).toBeGreaterThan(0);
    });

    it('should mark scan as failed when scan retries are exhausted on fatal error', async () => {
      const nonExistentScanId = '507f1f77bcf86cd799439011';

      worker = createScanWorker();

      const jobFailedPromise = new Promise((resolve) => {
        worker.once('failed', (job, err) => {
          resolve({ job, err });
        });
      });

      await addScanJob({
        scanId: nonExistentScanId,
        applicationId: '507f1f77bcf86cd799439012',
      });

      const { err } = await jobFailedPromise;
      expect(err).toBeDefined();
      expect(err.message).toMatch(/Scan not found/);
    });
  });

  describe('End-to-End Async HTTP Trigger & Polling', () => {
    it('should trigger scan via POST /api/scans, return pending with jobId, and complete in background', async () => {
      // 1. Register application
      const appRes = await request(app)
        .post('/api/applications')
        .send({
          name: 'Acme E2E Async App',
          targetConfig: {
            type: 'http',
            url: demoServerUrl,
            canaryValue: demoConfig.syntheticCanary,
          },
        });

      const appId = appRes.body.data._id;

      // 2. Start worker
      worker = createScanWorker();

      // 3. Trigger asynchronous scan via API (default: sync=false)
      const triggerRes = await request(app)
        .post('/api/scans')
        .send({ applicationId: appId });

      expect(triggerRes.status).toBe(201);
      expect(triggerRes.body.success).toBe(true);
      expect(triggerRes.body.data.status).toBe('pending');
      expect(triggerRes.body.data.jobId).toBeDefined();
      expect(triggerRes.body.data.progress).toBe(0);

      const scanId = triggerRes.body.data._id;

      // 4. Poll until scan completes
      let isCompleted = false;
      let pollAttempts = 0;
      let finalScan;

      while (!isCompleted && pollAttempts < 20) {
        await new Promise((r) => setTimeout(r, 200));
        pollAttempts += 1;

        const pollRes = await request(app).get(`/api/scans/${scanId}`);
        expect(pollRes.status).toBe(200);

        if (pollRes.body.data.status === 'completed') {
          isCompleted = true;
          finalScan = pollRes.body.data;
        }
      }

      expect(isCompleted).toBe(true);
      expect(finalScan.status).toBe('completed');
      expect(finalScan.progress).toBe(100);
      expect(finalScan.totalTests).toBeGreaterThanOrEqual(4);
      expect(finalScan.failedCount).toBeGreaterThan(0);

      // Verify findings were recorded
      const findingsRes = await request(app).get(`/api/scans/${scanId}/findings`);
      expect(findingsRes.status).toBe(200);
      expect(findingsRes.body.data.length).toBe(finalScan.failedCount);
    });
  });
});
