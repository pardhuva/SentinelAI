const request = require('supertest');
const app = require('../src/app');

describe('Health and System Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return 200 OK with health status and metadata', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toMatchObject({
        status: 'ok',
        service: 'SentinelAI Core API',
        version: '0.1.0',
      });
      expect(typeof response.body.data.uptime).toBe('number');
      expect(response.body.data).toHaveProperty('timestamp');
    });
  });

  describe('404 Route Handling', () => {
    it('should return 404 with standardized error structure for non-existent routes', async () => {
      const response = await request(app).get('/api/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(response.body.error.message).toContain('Cannot GET /api/does-not-exist');
    });
  });
});
