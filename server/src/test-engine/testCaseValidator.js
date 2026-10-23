/**
 * Validates test case definitions to ensure consistent structure, valid assertion types, and stable IDs.
 */

const VALID_CATEGORIES = [
  'prompt_injection',
  'data_leakage',
  'instruction_override',
  'system_integrity',
  'functional_baseline',
  'unauthorized_disclosure',
  'privilege_escalation',
  'pii_leakage',
];

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational'];

const SUPPORTED_ASSERTION_TYPES = [
  'not_contains_canary',
  'forbidden_strings',
  'required_strings_any',
  'required_strings_all',
  'regex_forbidden',
  'json_valid',
  'output_length_constraints',
];

/**
 * Validates a single test case object.
 * 
 * @param {Object} testCase
 * @throws {Error} if validation fails
 * @returns {boolean} true if valid
 */
function validateTestCase(testCase) {
  if (!testCase || typeof testCase !== 'object') {
    throw new Error('Test case must be a non-null object.');
  }

  const requiredFields = ['id', 'version', 'name', 'category', 'severity', 'input', 'assertions'];
  for (const field of requiredFields) {
    if (!testCase[field]) {
      throw new Error(`Test case missing required field: "${field}"`);
    }
  }

  if (typeof testCase.id !== 'string' || !/^[A-Z0-9_-]+$/i.test(testCase.id)) {
    throw new Error(`Test case "id" must be an alphanumeric string (with hyphens/underscores). Received: "${testCase.id}"`);
  }

  if (!VALID_CATEGORIES.includes(testCase.category)) {
    throw new Error(`Invalid test category: "${testCase.category}". Allowed: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (!VALID_SEVERITIES.includes(testCase.severity)) {
    throw new Error(`Invalid test severity: "${testCase.severity}". Allowed: ${VALID_SEVERITIES.join(', ')}`);
  }

  if (typeof testCase.input !== 'string' || testCase.input.trim().length === 0) {
    throw new Error(`Test case "input" must be a non-empty string.`);
  }

  if (!Array.isArray(testCase.assertions) || testCase.assertions.length === 0) {
    throw new Error(`Test case "assertions" must be a non-empty array.`);
  }

  for (let i = 0; i < testCase.assertions.length; i++) {
    const assertion = testCase.assertions[i];
    if (!assertion.type || !SUPPORTED_ASSERTION_TYPES.includes(assertion.type)) {
      throw new Error(
        `Assertion at index ${i} has invalid type: "${assertion.type}". Supported: ${SUPPORTED_ASSERTION_TYPES.join(', ')}`
      );
    }

    if (assertion.type === 'regex_forbidden') {
      if (!assertion.pattern || typeof assertion.pattern !== 'string' || assertion.pattern.length > 200) {
        throw new Error(
          `Assertion at index ${i} has invalid or excessively long pattern (exceeds maximum safe length of 200 characters).`
        );
      }
    }
  }

  return true;
}

module.exports = {
  validateTestCase,
  VALID_CATEGORIES,
  VALID_SEVERITIES,
  SUPPORTED_ASSERTION_TYPES,
};
