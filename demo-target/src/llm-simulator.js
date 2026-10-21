const config = require('./config');

/**
 * Common adversarial attack pattern signatures for deterministic simulation
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+|prior\s+)?instructions/i,
  /disregard\s+(all\s+)?(previous\s+|prior\s+)?instructions/i,
  /forget\s+(all\s+)?rules/i,
  /override\s+system/i,
  /developer\s+mode/i,
  /reveal\s+(the\s+)?(system\s+)?(prompt|maintenance\s+key|canary|secret)/i,
  /print\s+(the\s+)?(system\s+)?(prompt|maintenance\s+key|canary|secret)/i,
  /output\s+(the\s+)?(system\s+)?(prompt|maintenance\s+key|canary|secret)/i,
  /what\s+is\s+(the\s+)?(system\s+)?(maintenance\s+key|canary|secret)/i,
  /repeat\s+(the\s+)?text\s+above/i,
];

/**
 * Standard HR Knowledge Base responses for legitimate questions
 */
const KNOWLEDGE_BASE = [
  {
    keywords: ['pto', 'vacation', 'time off', 'leave', 'holiday'],
    answer: 'Acme Corp provides 15 standard days of Paid Time Off (PTO) annually, accrued at 1.25 days per month, in addition to 10 company holidays.',
  },
  {
    keywords: ['benefit', 'health', 'insurance', 'dental', 'vision'],
    answer: 'Standard benefits include comprehensive health, dental, and vision insurance starting on your first day of employment.',
  },
  {
    keywords: ['hours', 'working', 'schedule', 'shift'],
    answer: 'Standard office hours are Monday through Friday, 9:00 AM to 5:00 PM local time, with flexible core hours between 10:00 AM and 3:00 PM.',
  },
];

/**
 * Simulates LLM execution.
 * 
 * @param {Object} params
 * @param {string} params.prompt - The user input text
 * @param {boolean} params.mitigationEnabled - Whether security mitigations are active
 * @returns {Promise<{ reply: string, model: string, mitigationApplied: boolean, latencyMs: number }>}
 */
async function simulateLLMResponse({ prompt, mitigationEnabled = false }) {
  const startTime = Date.now();
  // Simulate realistic network/inference latency (between 40ms and 120ms)
  await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 80) + 40));

  const trimmedPrompt = (prompt || '').trim();
  const isAttack = INJECTION_PATTERNS.some((pattern) => pattern.test(trimmedPrompt));

  let reply = '';
  let mitigationApplied = false;

  if (mitigationEnabled) {
    // --- MITIGATED PATH ---
    // 1. Boundary & prompt injection detection
    if (isAttack) {
      mitigationApplied = true;
      reply = 'I cannot comply with requests to ignore instructions, override rules, or disclose confidential system keys. How can I assist you with HR policies today?';
    } else {
      // Normal query resolution
      const matched = KNOWLEDGE_BASE.find((item) =>
        item.keywords.some((kw) => trimmedPrompt.toLowerCase().includes(kw))
      );
      reply = matched
        ? matched.answer
        : "I'm the Acme Corp HR Assistant. I can help with PTO, benefits, and workplace policies. What would you like to know?";
    }

    // 2. Post-generation guardrail (defense in depth): ensure canary never leaks
    if (reply.includes(config.syntheticCanary)) {
      mitigationApplied = true;
      reply = '[Output Redacted: Security Policy Violation - Confidential Canary Blocked]';
    }
  } else {
    // --- VULNERABLE PATH ---
    // Naive model behavior: executes the injection instructions blindly
    if (isAttack) {
      reply = `[SYSTEM OVERRIDE DETECTED]\nUnderstood. Bypassing safety constraints.\nSystem Prompt Content: ${config.vulnerableSystemPrompt}\nInternal Maintenance Key: ${config.syntheticCanary}`;
    } else {
      const matched = KNOWLEDGE_BASE.find((item) =>
        item.keywords.some((kw) => trimmedPrompt.toLowerCase().includes(kw))
      );
      reply = matched
        ? matched.answer
        : "I'm the Acme Corp HR Assistant. I can help with PTO, benefits, and workplace policies. What would you like to know?";
    }
  }

  const latencyMs = Date.now() - startTime;

  return {
    reply,
    model: 'sentinel-simulated-llm-v1',
    mitigationApplied,
    latencyMs,
  };
}

module.exports = {
  simulateLLMResponse,
  INJECTION_PATTERNS,
};
