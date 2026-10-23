const mongoose = require('mongoose');
const config = require('./env');
const { sanitizeUri } = require('./validateEnv');

/**
 * Validates production database connection security.
 *
 * @param {string} uri
 */
function validateProductionMongoUri(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('[SentinelAI Database] MONGODB_URI is required.');
  }

  const isLocalhost =
    uri.includes('localhost:27017') ||
    uri.includes('127.0.0.1:27017') ||
    uri.startsWith('mongodb://localhost') ||
    uri.startsWith('mongodb://127.0.0.1');

  const hasCredentials = uri.includes('@');
  if (isLocalhost && !hasCredentials) {
    throw new Error(
      '[SentinelAI Database] Accidental use of an unauthenticated local MongoDB instance in production is rejected. Please configure an authenticated production database with TLS.'
    );
  }

  const hasTls =
    uri.startsWith('mongodb+srv://') ||
    /[?&]ssl=true/i.test(uri) ||
    /[?&]tls=true/i.test(uri);

  if (!hasTls) {
    throw new Error(
      '[SentinelAI Database] Production MongoDB connection requires TLS encryption (e.g. mongodb+srv:// or ?tls=true).'
    );
  }
}

/**
 * Connect to MongoDB database
 * @param {string} [uri] - Optional connection URI (defaults to config.mongodbUri)
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB(uri) {
  const connectionUri = uri || config.mongodbUri;

  if (config.isProduction) {
    validateProductionMongoUri(connectionUri);
  }

  try {
    const conn = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(
      `[SentinelAI Database] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`
    );
    return conn;
  } catch (err) {
    // Clean any accidental credentials from error messages before logging
    const safeErrorMsg = sanitizeUri(err.message);
    console.error(`[SentinelAI Database] Connection error: ${safeErrorMsg}`);
    throw err;
  }
}

/**
 * Disconnect from MongoDB database
 * @returns {Promise<void>}
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[SentinelAI Database] Disconnected from MongoDB.');
  } catch (err) {
    console.error(`[SentinelAI Database] Disconnect error: ${err.message}`);
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  validateProductionMongoUri,
  sanitizeMongoUri: sanitizeUri,
};
