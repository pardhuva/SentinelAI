const IORedis = require('ioredis');
const config = require('./env');
const { sanitizeUri } = require('./validateEnv');

/**
 * BullMQ requires specific Redis configuration:
 * - maxRetriesPerRequest must be null
 * - enableReadyCheck must be false
 */
const defaultRedisOptions = {
  host: config.redis?.host || 'localhost',
  port: config.redis?.port || 6379,
  password: config.redis?.password || undefined,
  tls: config.redis?.tls ? {} : undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
};

/**
 * Factory to create Redis connections for BullMQ.
 * When in test mode or non-production USE_MOCK_REDIS is enabled, uses in-memory ioredis-mock.
 *
 * @param {Object} [overrideOptions]
 * @returns {IORedis}
 */
function createRedisConnection(overrideOptions = {}) {
  const isProduction = config.nodeEnv === 'production';

  // Strict production checks: never mock redis in production
  if (isProduction) {
    if (process.env.USE_MOCK_REDIS === 'true') {
      throw new Error(
        '[SentinelAI Redis] USE_MOCK_REDIS is strictly prohibited in production. An authenticated Redis instance is required.'
      );
    }

    const redisUrl = config.redis?.url || process.env.REDIS_URL;
    const redisPassword = config.redis?.password || process.env.REDIS_PASSWORD;
    const redisHost = config.redis?.host || process.env.REDIS_HOST;

    const hasAuth = Boolean(redisPassword || (redisUrl && redisUrl.includes('@')));
    if (!hasAuth && (!redisHost || redisHost === 'localhost' || redisHost === '127.0.0.1')) {
      throw new Error(
        '[SentinelAI Redis] In production, Redis requires authentication credentials and cannot use unauthenticated default localhost.'
      );
    }

    if (redisUrl) {
      return new IORedis(redisUrl, {
        ...defaultRedisOptions,
        ...overrideOptions,
      });
    }

    return new IORedis({
      ...defaultRedisOptions,
      ...overrideOptions,
    });
  }

  // Non-production test / mock mode
  const isMock = config.nodeEnv === 'test' || process.env.USE_MOCK_REDIS === 'true';
  if (isMock) {
    const RedisMock = require('ioredis-mock');
    return new RedisMock();
  }

  if (config.redis?.url) {
    return new IORedis(config.redis.url, {
      ...defaultRedisOptions,
      ...overrideOptions,
    });
  }

  return new IORedis({
    ...defaultRedisOptions,
    ...overrideOptions,
  });
}

module.exports = {
  defaultRedisOptions,
  createRedisConnection,
};
