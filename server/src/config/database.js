const mongoose = require('mongoose');
const config = require('./env');

/**
 * Connect to MongoDB database
 * @param {string} [uri] - Optional connection URI (defaults to config.mongodbUri)
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB(uri) {
  const connectionUri = uri || config.mongodbUri;

  try {
    const conn = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[SentinelAI Database] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`[SentinelAI Database] Connection error: ${err.message}`);
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
};
