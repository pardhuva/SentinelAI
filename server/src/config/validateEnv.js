const KNOWN_DEV_KEYS = new Set([
  'sentinel-dev-key',
  'sentinel-dev-api-key-2026',
  'dev-key',
  'default-key',
  'secret',
  'password',
  '123456',
  'admin',
]);

/**
 * Sanitizes a connection URI by masking any embedded username:password credentials.
 *
 * @param {string} uri
 * @returns {string}
 */
function sanitizeUri(uri) {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.+)/i, '$1***$2')
    .replace(/(rediss?:\/\/[^:]+:)[^@]+(@.+)/i, '$1***$2');
}

/**
 * Validates environment configuration at startup.
 * Throws actionable errors with clear guidance if required production configurations are missing or insecure.
 * NEVER prints secret values in error messages or logs.
 *
 * @param {Object} [cfg] - Configuration object (defaults to current env)
 */
function validateEnv(cfg) {
  const nodeEnv = cfg?.nodeEnv || process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  if (!isProduction) {
    // In development or test, allow lenient local defaults
    return { valid: true };
  }

  // ==========================================
  // Strict Production Validations
  // ==========================================

  // 1. API Authentication Key
  const apiKey = cfg?.apiKey || process.env.SENTINEL_API_KEY || process.env.API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new Error(
      '[SentinelAI Configuration Error] In production, SENTINEL_API_KEY must be configured with a strong secret. Server will fail closed.'
    );
  }

  const cleanApiKey = apiKey.trim();
  if (KNOWN_DEV_KEYS.has(cleanApiKey.toLowerCase())) {
    throw new Error(
      '[SentinelAI Configuration Error] In production, SENTINEL_API_KEY cannot be a known development key. Please generate a cryptographically strong 256-bit secret.'
    );
  }

  if (cleanApiKey.length < 32) {
    throw new Error(
      '[SentinelAI Configuration Error] In production, SENTINEL_API_KEY must be at least 32 characters long for cryptographic security.'
    );
  }

  // 2. Database (MongoDB) Configuration
  const mongodbUri = cfg?.mongodbUri || process.env.MONGODB_URI;
  if (!mongodbUri || typeof mongodbUri !== 'string') {
    throw new Error(
      '[SentinelAI Configuration Error] In production, MONGODB_URI must be provided.'
    );
  }

  // Check for unauthenticated local database
  const isLocalhostMongo =
    mongodbUri.includes('localhost:27017') ||
    mongodbUri.includes('127.0.0.1:27017') ||
    mongodbUri.startsWith('mongodb://localhost') ||
    mongodbUri.startsWith('mongodb://127.0.0.1');

  const hasCredentials = mongodbUri.includes('@');
  if (isLocalhostMongo && !hasCredentials) {
    throw new Error(
      '[SentinelAI Configuration Error] In production, MONGODB_URI cannot point to an unauthenticated local MongoDB instance. An authenticated database with TLS encryption is required.'
    );
  }

  // Require TLS / SSL where supported
  const hasTls =
    mongodbUri.startsWith('mongodb+srv://') ||
    /[?&]ssl=true/i.test(mongodbUri) ||
    /[?&]tls=true/i.test(mongodbUri);

  if (!hasTls) {
    throw new Error(
      '[SentinelAI Configuration Error] In production, MONGODB_URI must use TLS encryption (e.g. mongodb+srv:// or ?tls=true).'
    );
  }

  // 3. Queue & Redis Configuration
  const useMockRedis =
    cfg?.useMockRedis !== undefined
      ? Boolean(cfg.useMockRedis)
      : process.env.USE_MOCK_REDIS === 'true';
  if (useMockRedis) {
    throw new Error(
      '[SentinelAI Configuration Error] In-memory mock Redis (USE_MOCK_REDIS=true) cannot be enabled in production. A production-ready Redis instance with authentication and TLS is required for BullMQ.'
    );
  }

  const redisUrl = cfg?.redis?.url !== undefined ? cfg.redis.url : process.env.REDIS_URL;
  const redisHost = cfg?.redis?.host !== undefined ? cfg.redis.host : process.env.REDIS_HOST;
  const redisPassword = cfg?.redis?.password !== undefined ? cfg.redis.password : process.env.REDIS_PASSWORD;
  const hasRedisAuth = Boolean(redisPassword || (redisUrl && redisUrl.includes('@')));

  if (!hasRedisAuth && (!redisHost || redisHost === 'localhost' || redisHost === '127.0.0.1')) {
    throw new Error(
      '[SentinelAI Configuration Error] In production, Redis configuration cannot use unauthenticated default localhost. Please configure REDIS_URL or REDIS_HOST with authentication credentials.'
    );
  }

  // 4. CORS Client URL Configuration
  const clientUrl = cfg?.clientUrl !== undefined ? cfg.clientUrl : (process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL);
  if (!clientUrl || clientUrl === '*' || clientUrl === 'http://localhost:5173') {
    throw new Error(
      '[SentinelAI Configuration Error] In production, CLIENT_URL must be explicitly configured to the exact deployed frontend origin (e.g. https://sentinelai.example.com) and cannot be wildcard "*" or default localhost.'
    );
  }

  // 5. Target Probing Security
  const allowPrivateTargets =
    cfg?.allowPrivateTargets !== undefined
      ? Boolean(cfg.allowPrivateTargets)
      : process.env.ALLOW_PRIVATE_TARGETS === 'true';
  if (allowPrivateTargets) {
    throw new Error(
      '[SentinelAI Configuration Error] ALLOW_PRIVATE_TARGETS cannot be enabled in production. Access to loopback and private networks is strictly prohibited in production mode.'
    );
  }

  return { valid: true };
}

module.exports = {
  KNOWN_DEV_KEYS,
  sanitizeUri,
  validateEnv,
};
