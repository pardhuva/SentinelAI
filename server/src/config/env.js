const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sentinelai',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    tls: process.env.REDIS_TLS === 'true',
    url: process.env.REDIS_URL || null,
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  apiKey: process.env.SENTINEL_API_KEY || process.env.API_KEY || null,
  requireAuth: process.env.REQUIRE_AUTH === 'true' || process.env.NODE_ENV === 'production',
  allowPrivateTargets: process.env.ALLOW_PRIVATE_TARGETS === 'true',
  useMockRedis: process.env.USE_MOCK_REDIS === 'true',
  startWorker: process.env.START_WORKER !== 'false',
};

module.exports = config;

