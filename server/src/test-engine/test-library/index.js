const promptInjectionTests = require('./prompt-injection');
const dataLeakageTests = require('./data-leakage');
const commonTests = require('./profiles/common');
const bankingTests = require('./profiles/banking');
const healthcareTests = require('./profiles/healthcare');
const hrTests = require('./profiles/hr');
const customerSupportTests = require('./profiles/customer-support');
const { validateTestCase } = require('../testCaseValidator');

// Bundled base tests for backward compatibility
const allTestCases = [...promptInjectionTests, ...dataLeakageTests];

// Validate all bundled test cases at load time to catch configuration errors early
allTestCases.forEach((tc) => validateTestCase(tc));
bankingTests.forEach((tc) => validateTestCase(tc));
healthcareTests.forEach((tc) => validateTestCase(tc));
hrTests.forEach((tc) => validateTestCase(tc));
customerSupportTests.forEach((tc) => validateTestCase(tc));

const PROFILES = {
  general: {
    id: 'general',
    name: 'General LLM Security Profile',
    description: 'Universal prompt injection, developer jailbreaks, and canary token leakage tripwires.',
    testCases: commonTests,
  },
  hr: {
    id: 'hr',
    name: 'HR & Internal Operations Profile',
    description: 'Universal tests plus employee compensation confidentiality and confidential HR instructions.',
    testCases: [...commonTests, ...hrTests],
  },
  banking: {
    id: 'banking',
    name: 'Banking & Financial Services Profile',
    description: 'Universal tests plus cross-account balance disclosure and unauthorized funds transfer overrides.',
    testCases: [...commonTests, ...bankingTests],
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Clinical Safety Profile',
    description: 'Universal tests plus unauthorized patient PHI disclosure and hazardous dosage overrides.',
    testCases: [...commonTests, ...healthcareTests],
  },
  customer_support: {
    id: 'customer_support',
    name: 'Customer Support & CRM Profile',
    description: 'Universal tests plus cross-tenant ticket leakage and arbitrary refund overrides.',
    testCases: [...commonTests, ...customerSupportTests],
  },
};

/**
 * Returns all default test cases (for backward compatibility).
 * @returns {Array<Object>}
 */
function getAllTestCases() {
  return [...allTestCases];
}

/**
 * Returns available testing profile definitions.
 * @returns {Array<Object>}
 */
function getAvailableProfiles() {
  return Object.values(PROFILES).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    testCount: p.testCases.length,
    categories: [...new Set(p.testCases.map((tc) => tc.category))],
  }));
}

/**
 * Returns test cases belonging to a specific named profile.
 * @param {string} profileName
 * @returns {Array<Object>}
 */
function getTestCasesByProfile(profileName = 'general') {
  const profile = PROFILES[profileName] || PROFILES.general;
  return [...profile.testCases];
}

/**
 * Resolves the full suite of test cases for a specific Application configuration.
 * Respects profile selection, category filters, disabled test IDs, and custom test cases.
 * 
 * @param {Object} application
 * @returns {Array<Object>}
 */
function getTestCasesForApplication(application = {}) {
  // 1. Resolve base profile
  const profileKey = application.securityProfile || 'general';
  let baseTests = PROFILES[profileKey] ? [...PROFILES[profileKey].testCases] : [...allTestCases];

  // 2. Append validated custom test cases if present
  if (Array.isArray(application.customTestCases) && application.customTestCases.length > 0) {
    const validCustom = [];
    for (const customCase of application.customTestCases) {
      try {
        validateTestCase(customCase);
        validCustom.push(customCase);
      } catch (err) {
        console.warn(`[TestLibrary] Skipping invalid custom test case "${customCase?.id}": ${err.message}`);
      }
    }
    baseTests = [...baseTests, ...validCustom];
  }

  // De-duplicate by ID (custom tests can override base tests with same ID)
  const testMap = new Map();
  for (const tc of baseTests) {
    testMap.set(tc.id, tc);
  }
  let resolvedTests = Array.from(testMap.values());

  // 3. Apply category filter if configured
  if (Array.isArray(application.enabledCategories) && application.enabledCategories.length > 0) {
    const allowed = new Set(application.enabledCategories);
    resolvedTests = resolvedTests.filter((tc) => allowed.has(tc.category));
  }

  // 4. Apply disabled test IDs filter
  if (Array.isArray(application.disabledTestIds) && application.disabledTestIds.length > 0) {
    const disabled = new Set(application.disabledTestIds);
    resolvedTests = resolvedTests.filter((tc) => !disabled.has(tc.id));
  }

  // Ensure at least one test case is returned
  return resolvedTests.length > 0 ? resolvedTests : [...allTestCases];
}

/**
 * Finds a test case by stable ID across all registered profiles.
 * @param {string} id
 * @returns {Object|null}
 */
function getTestCaseById(id) {
  // Search in default list first
  const found = allTestCases.find((tc) => tc.id === id);
  if (found) return found;

  // Search in all profiles
  for (const profile of Object.values(PROFILES)) {
    const match = profile.testCases.find((tc) => tc.id === id);
    if (match) return match;
  }

  return null;
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
  getAvailableProfiles,
  getTestCasesByProfile,
  getTestCasesForApplication,
  getTestCaseById,
  getTestCasesByCategory,
  allTestCases,
  PROFILES,
};
