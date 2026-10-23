const request = require('supertest');
const app = require('../src/app');
const demoApp = require('../../demo-target/src/app');
const demoConfig = require('../../demo-target/src/config');
const { Application, Scan, TestResult } = require('../src/models');
const ScanEngine = require('../src/test-engine/ScanEngine');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setupMongo');

jest.setTimeout(60000);

describe('Application Management & Dynamic Profile Scan Selection', () => {
  let demoServer;
  let demoServerUrl;
  const apiKey = process.env.SENTINEL_API_KEY || 'sentinel-dev-key';

  beforeAll(async () => {
    await setupTestDB();

    await new Promise((resolve) => {
      demoServer = demoApp.listen(0, () => {
        const port = demoServer.address().port;
        demoServerUrl = `http://127.0.0.1:${port}/api/chat`;
        resolve();
      });
    });
  }, 60000);

  afterAll(async () => {
    if (demoServer) {
      await new Promise((resolve) => demoServer.close(resolve));
    }
    await teardownTestDB();
  }, 60000);

  afterEach(async () => {
    await clearTestDB();
  });

  describe('1. Profile Persistence on Registration', () => {
    it('should persist the specified security profile when registering an application', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('x-api-key', apiKey)
        .send({
          name: 'Apex Healthcare Assistant',
          description: 'Clinical chat assistant with PHI protections',
          securityProfile: 'healthcare',
          targetConfig: {
            url: demoServerUrl,
            canaryValue: demoConfig.syntheticCanary,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.securityProfile).toBe('healthcare');

      const saved = await Application.findById(res.body.data._id);
      expect(saved).not.toBeNull();
      expect(saved.securityProfile).toBe('healthcare');
    });

    it('should default to "general" profile when no security profile is specified', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('x-api-key', apiKey)
        .send({
          name: 'Default Test Assistant',
          targetConfig: {
            url: demoServerUrl,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.securityProfile).toBe('general');
    });

    it('should reject registration with an unsupported security profile', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('x-api-key', apiKey)
        .send({
          name: 'Crypto Assistant',
          securityProfile: 'crypto_finance',
          targetConfig: {
            url: demoServerUrl,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_PROFILE');
    });
  });

  describe('2. Backend Update Validation & Rejection of Unsupported Fields', () => {
    let testApp;

    beforeEach(async () => {
      testApp = await Application.create({
        name: 'Original Target Name',
        description: 'Original description',
        securityProfile: 'general',
        targetConfig: {
          url: demoServerUrl,
          canaryValue: 'CANARY_ORIGINAL',
          timeoutMs: 5000,
        },
      });
    });

    it('should safely update name, description, profile, and categories via PUT', async () => {
      const res = await request(app)
        .put(`/api/applications/${testApp._id}`)
        .set('x-api-key', apiKey)
        .send({
          name: 'Updated Target Name',
          description: 'Updated description',
          securityProfile: 'banking',
          enabledCategories: ['prompt_injection', 'data_leakage', 'unauthorized_disclosure'],
          disabledTestIds: ['SEC-INJ-002'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(String(testApp._id)); // Existing ID preserved
      expect(res.body.data.name).toBe('Updated Target Name');
      expect(res.body.data.securityProfile).toBe('banking');
      expect(res.body.data.enabledCategories).toEqual(['prompt_injection', 'data_leakage', 'unauthorized_disclosure']);
      expect(res.body.data.disabledTestIds).toEqual(['SEC-INJ-002']);

      // Verify no duplicate applications created
      const count = await Application.countDocuments();
      expect(count).toBe(1);
    });

    it('should also support updates via PATCH', async () => {
      const res = await request(app)
        .patch(`/api/applications/${testApp._id}`)
        .set('x-api-key', apiKey)
        .send({
          name: 'Patched Target Name',
          securityProfile: 'hr',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Patched Target Name');
      expect(res.body.data.securityProfile).toBe('hr');
    });

    it('should reject modification of unsupported or protected fields (e.g. _id, currentBaselineScanId)', async () => {
      const res = await request(app)
        .put(`/api/applications/${testApp._id}`)
        .set('x-api-key', apiKey)
        .send({
          name: 'Valid Name',
          _id: '507f1f77bcf86cd799439011',
          currentBaselineScanId: '507f1f77bcf86cd799439022',
          unknownField: 'malicious_payload',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNSUPPORTED_FIELDS');

      // Verify document was not mutated
      const appInDb = await Application.findById(testApp._id);
      expect(appInDb.name).toBe('Original Target Name');
    });

    it('should reject invalid profile updates with 400 Bad Request', async () => {
      const res = await request(app)
        .put(`/api/applications/${testApp._id}`)
        .set('x-api-key', apiKey)
        .send({
          securityProfile: 'invalid_domain_profile',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PROFILE');
    });

    it('should reject empty application name with 400 Bad Request', async () => {
      const res = await request(app)
        .put(`/api/applications/${testApp._id}`)
        .set('x-api-key', apiKey)
        .send({
          name: '   ',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
    });

    it('should reject invalid timeout values in targetConfig', async () => {
      const res = await request(app)
        .put(`/api/applications/${testApp._id}`)
        .set('x-api-key', apiKey)
        .send({
          targetConfig: {
            timeoutMs: 999999, // Exceeds max 30000ms
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('3. Dynamic Scan Test Selection & Historical Record Integrity', () => {
    it('should select profile tests dynamically and preserve past scan records intact across profile revisions', async () => {
      const scanEngine = new ScanEngine();

      // Step A: Register application with 'general' profile (5 common tests)
      const targetApp = await Application.create({
        name: 'Enterprise Advisory Bot',
        description: 'Multi-domain chatbot undergoing security posture evaluation',
        securityProfile: 'general',
        targetConfig: {
          url: demoServerUrl,
          canaryValue: demoConfig.syntheticCanary,
        },
      });

      // Step B: Create and run Scan 1 under 'general' profile
      const scan1 = await Scan.create({
        applicationId: targetApp._id,
        triggerSource: 'manual',
        status: 'pending',
      });

      const completedScan1 = await scanEngine.executeScan(scan1._id);
      expect(completedScan1.status).toBe('completed');
      expect(completedScan1.totalTests).toBe(5); // General profile has 5 common tests

      // Verify TestResult records for scan 1
      const scan1Results = await TestResult.find({ scanId: scan1._id });
      expect(scan1Results.length).toBe(5);
      const scan1TestIds = scan1Results.map((r) => r.testCaseId);
      expect(scan1TestIds).toContain('SEC-INJ-001');
      expect(scan1TestIds).toContain('SEC-LEAK-001');
      expect(scan1TestIds).not.toContain('SEC-BANK-001');

      // Set Scan 1 as baseline
      targetApp.currentBaselineScanId = scan1._id;
      await targetApp.save();

      // Step C: Update application to 'banking' profile (5 common + 2 banking = 7 tests)
      const updateRes = await request(app)
        .put(`/api/applications/${targetApp._id}`)
        .set('x-api-key', apiKey)
        .send({
          securityProfile: 'banking',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.securityProfile).toBe('banking');

      // Verify baseline reference was not corrupted
      const appAfterUpdate = await Application.findById(targetApp._id);
      expect(String(appAfterUpdate.currentBaselineScanId)).toBe(String(scan1._id));

      // Step D: Create and run Scan 2 under 'banking' profile
      const scan2 = await Scan.create({
        applicationId: targetApp._id,
        triggerSource: 'manual',
        status: 'pending',
      });

      const completedScan2 = await scanEngine.executeScan(scan2._id);
      expect(completedScan2.status).toBe('completed');
      expect(completedScan2.totalTests).toBe(7); // 5 common + 2 banking tests

      // Verify TestResult records for scan 2
      const scan2Results = await TestResult.find({ scanId: scan2._id });
      expect(scan2Results.length).toBe(7);
      const scan2TestIds = scan2Results.map((r) => r.testCaseId);
      expect(scan2TestIds).toContain('SEC-BANK-001');
      expect(scan2TestIds).toContain('SEC-BANK-002');
      expect(scan2TestIds).toContain('SEC-INJ-001');

      // Step E: VERIFY SCAN 1 WAS NOT CORRUPTED OR OVERWRITTEN
      const scan1Check = await Scan.findById(scan1._id);
      expect(scan1Check.totalTests).toBe(5);
      expect(scan1Check.status).toBe('completed');
      expect(scan1Check.startedAt.getTime()).toBe(completedScan1.startedAt.getTime());
      const scan1ResultsAfter = await TestResult.find({ scanId: scan1._id });
      expect(scan1ResultsAfter.length).toBe(5);

      // Step F: Test disabling specific test IDs on the banking profile
      await request(app)
        .put(`/api/applications/${targetApp._id}`)
        .set('x-api-key', apiKey)
        .send({
          disabledTestIds: ['SEC-INJ-002'],
        });

      const scan3 = await Scan.create({
        applicationId: targetApp._id,
        triggerSource: 'manual',
        status: 'pending',
      });

      const completedScan3 = await scanEngine.executeScan(scan3._id);
      expect(completedScan3.totalTests).toBe(6); // 7 banking tests - 1 disabled = 6

      const scan3Results = await TestResult.find({ scanId: scan3._id });
      const scan3TestIds = scan3Results.map((r) => r.testCaseId);
      expect(scan3TestIds).not.toContain('SEC-INJ-002');
      expect(scan3TestIds).toContain('SEC-BANK-001');

      // Verify database contains only 1 application document (zero duplication)
      const totalApps = await Application.countDocuments();
      expect(totalApps).toBe(1);
    });
  });
});
