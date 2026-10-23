const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Initializes and connects Mongoose to an in-memory MongoDB instance.
 */
async function setupTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '7.0.24',
      },
      instance: {
        ip: '127.0.0.1',
      },
    });
  }

  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {
    directConnection: true,
  });
}

/**
 * Disconnects Mongoose. Keeps the in-memory MongoDB instance alive across test suites for performance.
 */
async function teardownTestDB(forceStop = false) {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (forceStop && mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

process.on('exit', () => {
  if (mongoServer) {
    mongoServer.stop();
  }
});

/**
 * Clears all documents between test suites to ensure strict isolation.
 */
async function clearTestDB() {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

module.exports = {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
};
