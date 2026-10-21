const HttpTargetAdapter = require('./HttpTargetAdapter');
const BaseTargetAdapter = require('./BaseTargetAdapter');

/**
 * Factory to create target adapters based on target configuration.
 * 
 * @param {Object} targetConfig
 * @param {'http'|'demo'|'custom'} targetConfig.type
 * @param {Object} targetConfig.options
 * @returns {BaseTargetAdapter}
 */
function createTargetAdapter(targetConfig = {}) {
  const { type = 'http', ...options } = targetConfig;

  switch (type.toLowerCase()) {
    case 'http':
    case 'demo':
      return new HttpTargetAdapter(options);
    default:
      throw new Error(`Unsupported target adapter type: "${type}". Supported types: "http", "demo".`);
  }
}

module.exports = {
  createTargetAdapter,
  BaseTargetAdapter,
  HttpTargetAdapter,
};
