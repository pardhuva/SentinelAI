const request = require('supertest');
const app = require('../src/app');
const demoApp = require('../../demo-target/src/app');
const demoConfig = require('../../demo-target/src/config');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setupMongo');

jest.setTimeout(30000);

describe('Scan Execution & Persistence Engine', () => {
  let demoServer;
  let demoServerUrl;

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
  }, 60000); // 60s timeout for first-time binary download if needed

  afterAll(async () => {
    if (demoServer) {
      await new Promise((resolve) => demoServer.close(resolve));
    }
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('Application Registration API', () => {
    it('should register a new application and retrieve its configuration', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          name: 'Acme HR Assistant',
          description: 'Internal HR Chatbot target for security testing',
          targetConfig: {
            type: 'http',
            url: demoServerUrl,
            canaryValue: demoConfig.syntheticCanary,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.name).toBe('Acme HR Assistant');
      expect(res.body.data.targetConfig.url).toBe(demoServerUrl);

      // Verify list endpoint
      const listRes = await request(app).get('/api/applications');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
    });

    it('should reject application registration with invalid URL or missing name', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          description: 'No name provided',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('End-to-End Scan Execution Flow', () => {
    it('should scan vulnerable target, persist results, and record findings', async () => {
      // 1. Register vulnerable application
      const appRes = await request(app)
        .post('/api/applications')
        .send({
          name: 'Vulnerable Acme App',
          targetConfig: {
            type: 'http',
            url: demoServerUrl,
            canaryValue: demoConfig.syntheticCanary,
          },
        });

      const appId = appRes.body.data._id;

      // 2. Trigger scan synchronously
      const scanRes = await request(app)
        .post('/api/scans')
        .send({ applicationId: appId, sync: true });

      expect(scanRes.status).toBe(201);
      expect(scanRes.body.success).toBe(true);
      expect(scanRes.body.data.status).toBe('completed');
      expect(scanRes.body.data.totalTests).toBeGreaterThanOrEqual(4);
      expect(scanRes.body.data.failedCount).toBeGreaterThan(0);
      expect(typeof scanRes.body.data.durationMs).toBe('number');

      const scanId = scanRes.body.data._id;

      // 3. Inspect persisted test results
      const resultsRes = await request(app).get(`/api/scans/${scanId}/results`);
      expect(resultsRes.status).toBe(200);
      expect(resultsRes.body.success).toBe(true);
      expect(resultsRes.body.data.length).toBe(scanRes.body.data.totalTests);

      // Verify at least one test failed with canary evidence
      const failedResult = resultsRes.body.data.find((r) => r.verdict === 'failed');
      expect(failedResult).toBeDefined();
      expect(failedResult.evidence).toBeTruthy();

      // 4. Inspect recorded findings
      const findingsRes = await request(app).get(`/api/scans/${scanId}/findings`);
      expect(findingsRes.status).toBe(200);
      expect(findingsRes.body.success).toBe(true);
      expect(findingsRes.body.data.length).toBe(scanRes.body.data.failedCount);
      expect(findingsRes.body.data[0]).toHaveProperty('remediation');
      expect(findingsRes.body.data[0].status).toBe('open');
    });

    it('should verify that applying mitigation resolves the vulnerabilities', async () => {
      // 1. Register application configured with mitigation header
      const appRes = await request(app)
        .post('/api/applications')
        .send({
          name: 'Mitigated Acme App',
          targetConfig: {
            type: 'http',
            url: demoServerUrl,
            headers: {
              'x-sentinel-mitigation': 'true',
            },
            canaryValue: demoConfig.syntheticCanary,
          },
        });

      const appId = appRes.body.data._id;

      // 2. Trigger scan synchronously
      const scanRes = await request(app)
        .post('/api/scans')
        .send({ applicationId: appId, sync: true });

      expect(scanRes.status).toBe(201);
      expect(scanRes.body.data.status).toBe('completed');
      expect(scanRes.body.data.failedCount).toBe(0);
      expect(scanRes.body.data.passedCount).toBe(scanRes.body.data.totalTests);

      const scanId = scanRes.body.data._id;

      // 3. Verify zero findings are generated
      const findingsRes = await request(app).get(`/api/scans/${scanId}/findings`);
      expect(findingsRes.status).toBe(200);
      expect(findingsRes.body.data.length).toBe(0);
    });
  });
});
