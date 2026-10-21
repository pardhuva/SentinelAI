const IORedis = require('ioredis');
const config = require('./env');

/**
 * BullMQ requires specific Redis configuration:
 * - maxRetriesPerRequest must be null
 * - enableReadyCheck must be false
 */
const defaultRedisOptions = {
  host: config.redis.host || 'localhost',
  port: config.redis.port || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
};

/**
 * Factory to create Redis connections for BullMQ.
 * When in test mode or when USE_MOCK_REDIS is enabled, uses in-memory ioredis-mock.
 * 
 * @param {Object} [overrideOptions]
 * @returns {IORedis}
 */
function createRedisConnection(overrideOptions = {}) {
  const isTest = config.nodeEnv === 'test' || process.env.USE_MOCK_REDIS === 'true';

  if (isTest) {
    const RedisMock = require('ioredis-mock');
    return new RedisMock();
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
