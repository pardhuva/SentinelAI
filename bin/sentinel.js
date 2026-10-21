#!/usr/bin/env node

/**
 * SentinelAI CLI - Automated LLM Security & Regression Scanner
 * 
 * Usage:
 *   node bin/sentinel.js --url http://127.0.0.1:5001/api/chat --canary CANARY_SECRET_HR_9941_RESTRICTED
 *   node bin/sentinel.js --url http://127.0.0.1:5001/api/chat --mitigation --fail-on-findings
 */

const { createTargetAdapter } = require('../server/src/providers');
const { defaultEvaluator } = require('../server/src/evaluators');
const { getAllTestCases } = require('../server/src/test-engine/test-library');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://127.0.0.1:5001/api/chat',
    canary: 'CANARY_SECRET_HR_9941_RESTRICTED',
    mitigation: false,
    failOnFindings: true,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (arg === '--canary' && args[i + 1]) {
      options.canary = args[++i];
    } else if (arg === '--mitigation') {
      options.mitigation = true;
    } else if (arg === '--no-fail') {
      options.failOnFindings = false;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${BOLD}SentinelAI CLI - LLM Security & Vulnerability Scanner${RESET}

${BOLD}USAGE:${RESET}
  node bin/sentinel.js [options]

${BOLD}OPTIONS:${RESET}
  --url <url>         Target HTTP POST chat endpoint (Default: http://127.0.0.1:5001/api/chat)
  --canary <token>    Synthetic secret token to test for data leakage
  --mitigation        Attach defense header (x-sentinel-mitigation: true)
  --no-fail           Exit with code 0 even if vulnerabilities are detected
  --json              Output raw JSON results for CI/CD parsing
  --help, -h          Display this help message
`);
}

async function runCli() {
  const options = parseArgs();

  if (!options.json) {
    console.log(`\n${CYAN}${BOLD}╔═══════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${CYAN}${BOLD}║              SENTINELAI — LLM SECURITY SCANNER                ║${RESET}`);
    console.log(`${CYAN}${BOLD}╚═══════════════════════════════════════════════════════════════╝${RESET}`);
    console.log(`${GRAY}Target Endpoint :${RESET} ${options.url}`);
    console.log(`${GRAY}Canary Token    :${RESET} ${options.canary || 'None'}`);
    console.log(`${GRAY}Defense Mode    :${RESET} ${options.mitigation ? GREEN + 'Mitigated (Header Active)' + RESET : RED + 'Standard / Unmitigated' + RESET}`);
    console.log(`${GRAY}Test Vectors    :${RESET} Prompt Injection, Instruction Override, Secret Leakage\n`);
    console.log(`${BOLD}Executing security evaluation suite...${RESET}\n`);
  }

  const headers = {};
  if (options.mitigation) {
    headers['x-sentinel-mitigation'] = 'true';
  }

  const adapter = createTargetAdapter({
    type: 'http',
    url: options.url,
    method: 'POST',
    headers,
    timeoutMs: 5000,
  });

  const testCases = getAllTestCases();
  const results = [];
  let passedCount = 0;
  let failedCount = 0;
  const startTime = Date.now();

  for (const testCase of testCases) {
    let targetResponse;
    try {
      targetResponse = await adapter.execute({ prompt: testCase.input });
    } catch (err) {
      targetResponse = {
        success: false,
        output: '',
        latencyMs: 0,
        error: { code: 'TARGET_ERROR', message: err.message },
      };
    }

    const evalResult = defaultEvaluator.evaluate({
      targetResponse,
      testCase,
      options: { canaryValue: options.canary },
    });

    const isPassed = evalResult.verdict === 'passed';
    if (isPassed) passedCount++;
    else failedCount++;

    results.push({
      testCaseId: testCase.id,
      name: testCase.name,
      category: testCase.category,
      severity: testCase.severity,
      verdict: evalResult.verdict,
      evidence: evalResult.evidence,
      latencyMs: targetResponse.latencyMs || 0,
    });

    if (!options.json) {
      const statusIcon = isPassed ? `${GREEN}✓ PASSED${RESET}` : `${RED}✗ FAILED${RESET}`;
      const sevColor = testCase.severity === 'critical' ? RED : testCase.severity === 'high' ? YELLOW : CYAN;
      console.log(`  [${statusIcon}] ${BOLD}${testCase.id}${RESET} - ${testCase.name}`);
      console.log(`           ${GRAY}Category:${RESET} ${testCase.category} | ${GRAY}Severity:${RESET} ${sevColor}${testCase.severity}${RESET} | ${GRAY}Latency:${RESET} ${targetResponse.latencyMs || 0}ms`);
      if (!isPassed && evalResult.evidence) {
        console.log(`           ${RED}Evidence:${RESET} ${evalResult.evidence.slice(0, 75)}...`);
      }
      console.log('');
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (options.json) {
    console.log(JSON.stringify({
      targetUrl: options.url,
      mitigationActive: options.mitigation,
      durationSeconds: parseFloat(totalDuration),
      summary: {
        total: testCases.length,
        passed: passedCount,
        failed: failedCount,
        passRate: Math.round((passedCount / testCases.length) * 100),
      },
      results,
    }, null, 2));
  } else {
    console.log(`${BOLD}─────────────────────────────────────────────────────────────────${RESET}`);
    console.log(`${BOLD}ASSESSMENT SUMMARY:${RESET}`);
    console.log(`  Total Evaluated: ${testCases.length}`);
    console.log(`  ${GREEN}Passed         : ${passedCount}${RESET}`);
    console.log(`  ${failedCount > 0 ? RED : GREEN}Vulnerabilities: ${failedCount}${RESET}`);
    console.log(`  Duration       : ${totalDuration}s`);
    console.log(`${BOLD}─────────────────────────────────────────────────────────────────${RESET}`);

    if (failedCount > 0) {
      console.log(`\n${RED}${BOLD}FAILED: Security vulnerabilities detected in AI application target.${RESET}`);
      if (options.failOnFindings) {
        console.log(`${RED}Exiting with status code 1 for CI/CD enforcement.${RESET}\n`);
        process.exit(1);
      }
    } else {
      console.log(`\n${GREEN}${BOLD}SUCCESS: All prompt injection and canary confidentiality assertions passed!${RESET}\n`);
      process.exit(0);
    }
  }

  if (options.failOnFindings && failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCli().catch((err) => {
  console.error('\nFatal Scanner Error:', err.message);
  process.exit(1);
});
