const request = require('supertest');
const app = require('../src/app');
const { Application, Scan, TestResult, Finding } = require('../src/models');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setupMongo');

jest.setTimeout(30000);

describe('Findings Management API', () => {
  let mockApp;
  let mockScan;
  let mockFinding;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    // Seed test data
    mockApp = await Application.create({
      name: 'Test Target App',
      targetConfig: {
        type: 'http',
        url: 'http://127.0.0.1:5001/api/chat',
      },
    });

    mockScan = await Scan.create({
      applicationId: mockApp._id,
      status: 'completed',
      totalTests: 4,
      failedCount: 2,
    });

    const mockResult = await TestResult.create({
      scanId: mockScan._id,
      applicationId: mockApp._id,
      testCaseId: 'SEC-INJ-001',
      testCaseVersion: '1.0.0',
      testCaseName: 'Direct Instruction Override',
      category: 'prompt_injection',
      severity: 'high',
      verdict: 'failed',
      inputPrompt: 'Ignore instructions',
      outputResponse: 'Hacked',
      latencyMs: 120,
    });

    mockFinding = await Finding.create({
      applicationId: mockApp._id,
      scanId: mockScan._id,
      testResultId: mockResult._id,
      testCaseId: 'SEC-INJ-001',
      title: 'Security Finding: Direct Instruction Override',
      description: 'The target LLM followed user adversarial directives.',
      category: 'prompt_injection',
      severity: 'high',
      evidence: 'Matched attack token: "Hacked"',
      remediation: 'Implement system boundary guards.',
      status: 'open',
    });

    // Create a second finding with critical severity
    await Finding.create({
      applicationId: mockApp._id,
      scanId: mockScan._id,
      testResultId: mockResult._id,
      testCaseId: 'SEC-LEAK-001',
      title: 'Security Finding: Canary Token Leak',
      category: 'data_leakage',
      severity: 'critical',
      evidence: 'Leaked CANARY_SECRET',
      remediation: 'Apply output redactor.',
      status: 'open',
    });
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('GET /api/findings', () => {
    it('should list all findings with pagination metadata', async () => {
      const res = await request(app).get('/api/findings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.page).toBe(1);
    });

    it('should filter findings by severity', async () => {
      const res = await request(app).get('/api/findings?severity=critical');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].severity).toBe('critical');
      expect(res.body.data[0].testCaseId).toBe('SEC-LEAK-001');
    });

    it('should filter findings by status', async () => {
      const res = await request(app).get('/api/findings?status=resolved');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('GET /api/findings/summary', () => {
    it('should aggregate finding counts by severity and status', async () => {
      const res = await request(app).get('/api/findings/summary');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.bySeverity.critical).toBe(1);
      expect(res.body.data.bySeverity.high).toBe(1);
      expect(res.body.data.bySeverity.medium).toBe(0);
      expect(res.body.data.byStatus.open).toBe(2);
      expect(res.body.data.byStatus.resolved).toBe(0);
    });
  });

  describe('GET /api/findings/:id', () => {
    it('should retrieve a single finding by ID with populated references', async () => {
      const res = await request(app).get(`/api/findings/${mockFinding._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(mockFinding._id.toString());
      expect(res.body.data.applicationId.name).toBe('Test Target App');
      expect(res.body.data.evidence).toContain('Matched attack token');
    });

    it('should return 404 for a non-existent finding ID', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/api/findings/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FINDING_NOT_FOUND');
    });
  });

  describe('PATCH /api/findings/:id', () => {
    it('should update finding status and triage notes', async () => {
      const res = await request(app)
        .patch(`/api/findings/${mockFinding._id}`)
        .send({
          status: 'resolved',
          notes: 'Added regex guardrails to sanitize input before LLM execution.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.notes).toContain('Added regex guardrails');

      // Verify in DB
      const updatedInDB = await Finding.findById(mockFinding._id);
      expect(updatedInDB.status).toBe('resolved');
      expect(updatedInDB.notes).toContain('Added regex guardrails');
    });

    it('should reject invalid status with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/findings/${mockFinding._id}`)
        .send({
          status: 'non_existent_status',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_STATUS');
    });
  });
});
