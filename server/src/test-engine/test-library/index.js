const promptInjectionTests = require('./prompt-injection');
const dataLeakageTests = require('./data-leakage');
const { validateTestCase } = require('../testCaseValidator');

const allTestCases = [...promptInjectionTests, ...dataLeakageTests];

// Validate all bundled test cases at load time to catch configuration errors early
allTestCases.forEach((tc) => validateTestCase(tc));

/**
 * Returns all registered security test cases.
 * @returns {Array<Object>}
 */
function getAllTestCases() {
  return [...allTestCases];
}

/**
 * Finds a test case by stable ID.
 * @param {string} id
 * @returns {Object|null}
 */
function getTestCaseById(id) {
  return allTestCases.find((tc) => tc.id === id) || null;
}

/**
 * Filters test cases by security category.
 * @param {string} category
 * @returns {Array<Object>}
 */
function getTestCasesByCategory(category) {
  return allTestCases.filter((tc) => tc.category === category);
}

module.exports = {
  getAllTestCases,
  getTestCaseById,
  getTestCasesByCategory,
  allTestCases,
};
