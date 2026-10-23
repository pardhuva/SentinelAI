const request = require('supertest');
const http = require('http');
const express = require('express');
const app = require('../src/app');
const config = require('../src/config/env');
const {
  validateEnv,
  sanitizeUri,
  KNOWN_DEV_KEYS,
} = require('../src/config/validateEnv');
const {
  normalizeIp,
  isProhibitedIp,
  isProhibitedHostname,
  validateTargetDestination,
} = require('../src/providers/ssrfValidator');
const HttpTargetAdapter = require('../src/providers/HttpTargetAdapter');
const { authenticateApi, constantTimeCompare } = require('../src/middleware/auth');
const { validateProductionMongoUri } = require('../src/config/database');

describe('P0 Security Remediation Test Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // 1. API Authentication & Fail-Closed Behavior
  // =========================================================================
  describe('API Authentication & Fail-Closed Invariants', () => {
    it('should fail closed in production if SENTINEL_API_KEY is not set', () => {
      delete process.env.SENTINEL_API_KEY;
      delete process.env.API_KEY;
      config.nodeEnv = 'production';

      const req = {
        path: '/api/applications',
        headers: { 'x-api-key': 'some-random-key' },
      };
      let statusCode = null;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };
      const next = jest.fn();

      authenticateApi(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(jsonPayload.error.code).toBe('UNAUTHORIZED');
      expect(jsonPayload.error.message).toMatch(/fail closed|unconfigured/i);
    });

    it('should reject known development keys in production mode', () => {
      for (const devKey of KNOWN_DEV_KEYS) {
        process.env.SENTINEL_API_KEY = devKey;
        config.nodeEnv = 'production';

        const req = {
          path: '/api/applications',
          headers: { 'x-api-key': devKey },
        };
        let statusCode = null;
        let jsonPayload = null;
        const res = {
          status: (code) => {
            statusCode = code;
            return {
              json: (payload) => {
                jsonPayload = payload;
              },
            };
          },
        };
        const next = jest.fn();

        authenticateApi(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(statusCode).toBe(401);
        expect(jsonPayload.error.message).toMatch(/known development/i);
      }
    });

    it('should authenticate successfully in production when valid 256-bit key is supplied', () => {
      const strongKey = 'a-very-strong-production-secret-key-32chars!!';
      process.env.SENTINEL_API_KEY = strongKey;
      config.nodeEnv = 'production';

      const req = {
        path: '/api/applications',
        headers: { 'x-api-key': strongKey },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      authenticateApi(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.auth.authenticated).toBe(true);
    });

    it('should reject invalid keys in production with 401', () => {
      const strongKey = 'a-very-strong-production-secret-key-32chars!!';
      process.env.SENTINEL_API_KEY = strongKey;
      config.nodeEnv = 'production';

      const req = {
        path: '/api/applications',
        headers: { 'x-api-key': 'attacker-wrong-key' },
      };
      let statusCode = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: jest.fn() };
        },
      };
      const next = jest.fn();

      authenticateApi(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
    });

    it('should perform timing-safe comparison without errors', () => {
      expect(constantTimeCompare('secret-key-123', 'secret-key-123')).toBe(true);
      expect(constantTimeCompare('secret-key-123', 'secret-key-124')).toBe(false);
      expect(constantTimeCompare('secret-key-123', 'secret')).toBe(false);
      expect(constantTimeCompare(null, 'secret')).toBe(false);
      expect(constantTimeCompare('secret', undefined)).toBe(false);
    });
  });

  // =========================================================================
  // 2. SSRF Protections & Network Restrictions
  // =========================================================================
  describe('SSRF Protections & Destination Validation', () => {
    it('should strictly block all cloud metadata endpoints across providers', () => {
      // AWS / GCP / Azure IPv4 link-local metadata
      expect(isProhibitedIp('169.254.169.254')).toBe(true);
      expect(isProhibitedIp('169.254.1.1')).toBe(true);
      expect(isProhibitedIp('169.254.254.254')).toBe(true);
      // Alibaba Cloud metadata IP
      expect(isProhibitedIp('100.100.100.200')).toBe(true);
      // AWS IMDSv2 IPv6 metadata
      expect(isProhibitedIp('fd00:ec2::254')).toBe(true);
    });

    it('should strictly block cloud metadata hostnames', () => {
      expect(isProhibitedHostname('metadata.google.internal')).toBe(true);
      expect(isProhibitedHostname('instance-data')).toBe(true);
      expect(isProhibitedHostname('metadata.internal')).toBe(true);
    });

    it('should block IPv6 Link-Local and ULA private addresses', () => {
      // Link-local (fe80::/10) - ALWAYS blocked
      expect(isProhibitedIp('fe80::1')).toBe(true);
      expect(isProhibitedIp('fe80::200:5aee:feaa:20a2')).toBe(true);
      expect(isProhibitedIp('feb0::1')).toBe(true);

      // ULA (fc00::/7) - blocked in strict mode
      expect(isProhibitedIp('fc00::1')).toBe(true);
      expect(isProhibitedIp('fd12:3456:789a:1::1')).toBe(true);

      // Site-local deprecated (fec0::/10)
      expect(isProhibitedIp('fec0::1')).toBe(true);
    });

    it('should detect and block IPv4-mapped IPv6 addresses', () => {
      // Dot-decimal mapped
      expect(isProhibitedIp('::ffff:127.0.0.1')).toBe(true);
      expect(isProhibitedIp('::ffff:169.254.169.254')).toBe(true);
      expect(isProhibitedIp('::ffff:10.0.0.1')).toBe(true);
      expect(isProhibitedIp('::ffff:192.168.1.50')).toBe(true);

      // Hex pair mapped (e.g. 7f00:1 = 127.0.0.1, a9fe:a9fe = 169.254.169.254)
      expect(isProhibitedIp('::ffff:7f00:1')).toBe(true);
      expect(isProhibitedIp('::ffff:a9fe:a9fe')).toBe(true);
      expect(isProhibitedIp('::ffff:0a00:0001')).toBe(true);
    });

    it('should block localhost and internal domain names in strict mode', () => {
      expect(isProhibitedHostname('localhost')).toBe(true);
      expect(isProhibitedHostname('sub.localhost')).toBe(true);
      expect(isProhibitedHostname('api.internal')).toBe(true);
      expect(isProhibitedHostname('db.local')).toBe(true);
      expect(isProhibitedHostname('vault.corp')).toBe(true);
      expect(isProhibitedHostname('server.lan')).toBe(true);
    });

    it('should permit public domains and public IPs in strict mode', () => {
      expect(isProhibitedHostname('api.openai.com')).toBe(false);
      expect(isProhibitedHostname('anthropic.com')).toBe(false);
      expect(isProhibitedIp('8.8.8.8')).toBe(false);
      expect(isProhibitedIp('1.1.1.1')).toBe(false);
      expect(isProhibitedIp('2606:4700:4700::1111')).toBe(false); // Cloudflare public IPv6
    });

    it('should reject URLs resolving to prohibited destinations before and at connection time', async () => {
      await expect(
        validateTargetDestination('http://169.254.169.254/latest/meta-data/')
      ).rejects.toThrow(/SSRF Protection Violation/i);

      await expect(
        validateTargetDestination('http://127.0.0.1:8080/admin')
      ).rejects.toThrow(/SSRF Protection Violation/i);

      await expect(
        validateTargetDestination('http://[::1]:8080/admin')
      ).rejects.toThrow(/SSRF Protection Violation/i);

      await expect(
        validateTargetDestination('http://[::ffff:169.254.169.254]/')
      ).rejects.toThrow(/SSRF Protection Violation/i);
    });

    it('should force allowPrivateTargets to false in HttpTargetAdapter when in production', () => {
      process.env.NODE_ENV = 'production';
      const adapter = new HttpTargetAdapter({
        url: 'https://example.com/api',
        allowPrivateTargets: true, // Should be ignored in production
      });

      expect(adapter.allowPrivateTargets).toBe(false);
    });

    it('should block redirects to private or metadata IP destinations', async () => {
      // Spin up test server that redirects to 169.254.169.254
      const redirectApp = express();
      redirectApp.post('/api/evil-redirect', (req, res) => {
        res.redirect(302, 'http://169.254.169.254/latest/meta-data/');
      });

      const server = redirectApp.listen(0);
      const port = server.address().port;

      try {
        const adapter = new HttpTargetAdapter({
          url: `http://127.0.0.1:${port}/api/evil-redirect`,
          allowPrivateTargets: true, // Allow initial hit to test server
        });

        // But redirect target is metadata (which is ALWAYS blocked regardless of flag)
        const response = await adapter.execute({ prompt: 'test' });
        expect(response.success).toBe(false);
        expect(response.error.code).toBe('SSRF_BLOCKED');
        expect(response.error.message).toMatch(/SSRF/i);
      } finally {
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections();
        }
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });

  // =========================================================================
  // 3. Startup Configuration & Production Guardrails
  // =========================================================================
  describe('Startup Environment Validation & Credential Safety', () => {
    it('should reject production startup when SENTINEL_API_KEY is missing', () => {
      expect(() => {
        validateEnv({
          nodeEnv: 'production',
          apiKey: '',
          mongodbUri: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          clientUrl: 'https://sentinelai.example.com',
        });
      }).toThrow(/SENTINEL_API_KEY must be configured/i);
    });

    it('should reject production startup when SENTINEL_API_KEY is a known dev key', () => {
      expect(() => {
        validateEnv({
          nodeEnv: 'production',
          apiKey: 'sentinel-dev-key',
          mongodbUri: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          clientUrl: 'https://sentinelai.example.com',
        });
      }).toThrow(/known development key/i);
    });

    it('should reject production startup when SENTINEL_API_KEY is shorter than 32 chars', () => {
      expect(() => {
        validateEnv({
          nodeEnv: 'production',
          apiKey: 'too-short-secret',
          mongodbUri: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          clientUrl: 'https://sentinelai.example.com',
        });
      }).toThrow(/at least 32 characters/i);
    });

    it('should reject production startup when MONGODB_URI is unauthenticated localhost', () => {
      expect(() => {
        validateEnv({
          nodeEnv: 'production',
          apiKey: 'strong-production-api-key-with-32-chars-plus!!',
          mongodbUri: 'mongodb://localhost:27017/sentinelai',
          clientUrl: 'https://sentinelai.example.com',
        });
      }).toThrow(/unauthenticated local MongoDB/i);
    });

    it('should reject production startup when MONGODB_URI lacks TLS encryption', () => {
      expect(() => {
        validateEnv({
          nodeEnv: 'production',
          apiKey: 'strong-production-api-key-with-32-chars-plus!!',
          mongodbUri: 'mongodb://user:pass@db.example.com:27017/sentinelai',
          clientUrl: 'https://sentinelai.example.com',
        });
      }).toThrow(/TLS encryption/i);
    });

    it('should reject production startup when USE_MOCK_REDIS is true', () => {
      expect(() => {
        validateEnv({
          nodeEnv: 'production',
          apiKey: 'strong-production-api-key-with-32-chars-plus!!',
          mongodbUri: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          clientUrl: 'https://sentinelai.example.com',
          useMockRedis: true,
        });
      }).toThrow(/USE_MOCK_REDIS/i);
    });

    it('should reject production startup when CLIENT_URL is default localhost or wildcard', () => {
      expect(() => {
        validateEnv({
          nodeEnv: 'production',
          apiKey: 'strong-production-api-key-with-32-chars-plus!!',
          mongodbUri: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          clientUrl: 'http://localhost:5173',
          useMockRedis: false,
          redis: { host: 'redis.example.com', password: 'pass' },
        });
      }).toThrow(/CLIENT_URL must be explicitly configured/i);
    });

    it('should reject production startup when ALLOW_PRIVATE_TARGETS is true', () => {
      expect(() => {
        validateEnv({
          nodeEnv: 'production',
          apiKey: 'strong-production-api-key-with-32-chars-plus!!',
          mongodbUri: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          clientUrl: 'https://sentinelai.example.com',
          useMockRedis: false,
          redis: { host: 'redis.example.com', password: 'pass' },
          allowPrivateTargets: true,
        });
      }).toThrow(/ALLOW_PRIVATE_TARGETS cannot be enabled in production/i);
    });

    it('should pass production startup validation with valid secure configuration', () => {
      const result = validateEnv({
        nodeEnv: 'production',
        apiKey: 'strong-production-api-key-with-32-chars-plus!!',
        mongodbUri: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
        clientUrl: 'https://sentinelai.example.com',
        redis: { host: 'redis.example.com', password: 'redis-auth-pass' },
        allowPrivateTargets: false,
        useMockRedis: false,
      });

      expect(result.valid).toBe(true);
    });

    it('should sanitize credentials from logged URIs leaving no passwords in logs', () => {
      const sensitiveMongoUri = 'mongodb+srv://app_user:SuperSecretPassword123@cluster0.abcde.mongodb.net/sentinelai';
      const sanitized = sanitizeUri(sensitiveMongoUri);

      expect(sanitized).not.toContain('SuperSecretPassword123');
      expect(sanitized).toBe('mongodb+srv://app_user:***@cluster0.abcde.mongodb.net/sentinelai');

      const sensitiveRedisUri = 'rediss://default:redisSecretPassword456@redis.example.com:6380';
      const sanitizedRedis = sanitizeUri(sensitiveRedisUri);

      expect(sanitizedRedis).not.toContain('redisSecretPassword456');
      expect(sanitizedRedis).toBe('rediss://default:***@redis.example.com:6380');
    });

    it('should validate production MongoDB URI and reject unauthenticated instances', () => {
      expect(() => {
        validateProductionMongoUri('mongodb://127.0.0.1:27017/sentinelai');
      }).toThrow(/unauthenticated local MongoDB/i);

      expect(() => {
        validateProductionMongoUri('mongodb://user:pass@127.0.0.1:27017/sentinelai');
      }).toThrow(/requires TLS/i);

      expect(() => {
        validateProductionMongoUri('mongodb+srv://user:pass@cluster0.mongodb.net/sentinelai');
      }).not.toThrow();
    });
  });
});
