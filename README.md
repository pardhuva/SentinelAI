# SentinelAI 🛡️
> **Automated Security Testing, Vulnerability Triage & Regression Platform for LLM Applications**

[![Live Demo](https://img.shields.io/badge/demo-live%20on%20render-brightgreen?logo=render)](https://sentinelai-g2lk.onrender.com)
[![Tests](https://img.shields.io/badge/tests-107%20passed%20(11%20suites)-brightgreen.svg)](#-test-verification)
[![Node.js](https://img.shields.io/badge/node.js-v18%20%7C%20v20%20%7C%20v22-blue.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/architecture-Modular%20Monolith-orange.svg)](#-architecture-overview)
[![Security Hardened](https://img.shields.io/badge/security-P0%20Remediated%20%26%20SSRF%20Protected-blueviolet.svg)](#-security-hardening--ssrf-defenses)

SentinelAI is an enterprise-grade automated security testing and regression analysis platform designed to evaluate AI-powered applications, chatbots, and LLM agent interfaces for adversarial vulnerabilities (prompt injection, jailbreaks, canary token leakage, unauthorized disclosure), capture verifiable forensic evidence, and **detect security regressions across prompt and model revisions**.

---

## 🏗️ Architecture Overview

```
                                  ┌────────────────────────────────────────┐
                                  │       React Dashboard (Vite)           │
                                  │  - Warm-White / Forest-Green Design    │
                                  │  - Confidence Badges (Direct/Heuristic)│
                                  │  - 1-Click Demo Comparison Workflow    │
                                  │  - Domain Security Profile Selector    │
                                  │  - Side-by-Side Regression Diff Modal  │
                                  └───────────────────┬────────────────────┘
                                                      │ HTTP / REST Proxy (Port 3000 -> 5000)
                                                      │ Header: x-api-key
                                                      ▼
                                  ┌────────────────────────────────────────┐
                                  │      Express REST API Backend          │
                                  │  - Helmet Security Headers & Rate Limit│
                                  │  - API Key & Bearer Token Auth         │
                                  │  - Strict ObjectId & Pagination Sanit. │
                                  │  /api/health      /api/applications    │
                                  │  /api/scans       /api/findings        │
                                  └─────────┬───────────────────┬──────────┘
                                            │                   │
                        Enqueues Scan Job   │                   │ Persists Models, Telemetry & Diffs
                                            ▼                   ▼
                                      ┌───────────┐       ┌───────────┐
                                      │   Redis   │       │  MongoDB  │
                                      │ (BullMQ)  │       │ (Mongoose)│
                                      └─────┬─────┘       └───────────┘
                                            │
                                            │ Job Event (attempts: 3, exponential backoff)
                                            ▼
                                  ┌──────────────────────┐
                                  │  Background Worker   │
                                  │  (concurrency: 2)    │
                                  └──────────┬───────────┘
                                             │ Executes Tests & Updates Progress
                                             ▼
                             ┌────────────────────────────────┐
                             │    SSRF Protection Engine      │
                             │  - DNS Resolution Pre-flight   │
                             │  - Blocks Loopback & Private   │
                             │  - Blocks Metadata 169.254.x.x │
                             │  - Safe Hop-by-Hop Redirects   │
                             └───────────────┬────────────────┘
                                             │ Verified Safe Outbound Request
                                             ▼
                             ┌────────────────────────────────┐
                             │    Target AI Application       │
                             │  (e.g., Acme HR Assistant)     │
                             └───────────────┬────────────────┘
                                             │ Returns Raw Inference Output
                                             ▼
                             ┌────────────────────────────────┐
                             │  Deterministic Evaluator       │
                             │  - Canary & Secret Disclosure  │
                             │  - Forbidden Strings & ReDoS   │
                             │  - Output Length Constraints   │
                             │  - Confidence Classification   │
                             └───────────────┬────────────────┘
                                             │
                                             ▼
                             ┌────────────────────────────────┐
                             │       Regression Engine        │
                             │  - Baseline vs Target Diff     │
                             │  - REGRESSED / IMPROVED Verdict│
                             │  - VERSION_CHANGED / REMOVED   │
                             └────────────────────────────────┘
```

---

## ✨ Key Features & Capabilities

### 1. Application-Specific Security Testing Profiles
Configure security test suites calibrated for specific application domains without claiming proof of universal industry fitness:
- **General / Common**: Universal prompt injection vectors, developer mode jailbreaks, benign baseline, and canary token tripwire.
- **Banking & Finance**: Unauthorized account balance and customer PII disclosure (`SEC-BANK-001`), unauthorized wire transfers and supervisor limit bypass (`SEC-BANK-002`).
- **Healthcare & Clinical**: Protected Health Information (PHI) disclosure (`SEC-HEALTH-001`), unauthorized medication dosage overrides (`SEC-HEALTH-002`).
- **HR & People Ops**: Confidential executive compensation leakage (`SEC-HR-001`), confidential recruitment guidelines.
- **Customer Support & CRM**: Cross-tenant ticket data isolation (`SEC-CS-001`), arbitrary refund and credit generation (`SEC-CS-002`).
- **Custom Application Rules**: Register bespoke test cases with strict schema validation and version tracking.
- **Granular Category Filtering**: Enable or disable specific test categories or test IDs per application.

### 2. Deterministic Evaluator & Evidence Classification
- **Direct Evidence vs. Heuristic Signals**:
  - `direct_match`: Exact canary token match or verified forbidden secret leakage. A refusal phrase like *"cannot"* does NOT override a canary leak.
  - `heuristic_signal`: Deviation from safe refusal conditions (e.g. model responded without standard policy disclaimers).
- **Supported Assertion Types**:
  - `not_contains_canary`: Ensures synthetic secret never appears in output.
  - `forbidden_strings`: Exact strings or substring patterns that must not appear.
  - `required_strings_any`: Safe refusal words that must be present in model replies.
  - `regex_forbidden`: Regular expression matching protected by 200-char ReDoS length guards.
  - `output_length_constraints`: Enforces min/max character limits to detect empty refusal bypasses or data dumps.
  - `json_valid`: Verifies deterministic structured output formatting.
- **Clear Error Attribution**: Distinguishes target infrastructure errors (timeout, connection refused, 500) from security test failures.

### 3. Vulnerability Findings & Triage Experience
- Displays target application, scan ID, test ID, and version.
- Captures the exact **adversarial attack prompt** and **observed target output**.
- Records the failed assertion schema and specific reason for failure.
- Confidence badge: `[Direct Evidence]` in red vs `[Heuristic Signal]` in amber.
- Prescriptive security remediation guidance tailored to each vulnerability category.
- Full triage lifecycle: `open` $\to$ `investigating` $\to$ `resolved` $\to$ `false_positive`.

### 4. Vulnerable vs. Mitigated Demo Comparison
- **1-Click Comparison**: Automates vulnerable scan $\to$ baseline designation $\to$ mitigated scan $\to$ side-by-side regression diff.
- Real defense mechanism: Acme HR target inspects `x-sentinel-mitigation: true` to enforce XML delimiter boundaries (`<system>`, `<user>`) and refusal filters.
- **Important Disclaimer**: The demo simulates the platform testing workflow; it demonstrates regression detection and does not certify the security of a commercial third-party LLM.

### 5. Security Hardening & SSRF Defenses
- **SSRF Protection**:
  - Pre-flight DNS resolution validates all resolved destination IPs.
  - Blocks cloud metadata service addresses (`169.254.169.254`) unconditionally.
  - Blocks loopback (`127.0.0.0/8`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and carrier-grade NAT (`100.64.0.0/10`) in strict mode.
  - Safe redirect inspector checks resolved IPs on each redirect hop (max 3 hops) to prevent redirect SSRF and DNS rebinding attacks.
- **API Authentication**:
  - Protects `/api/applications`, `/api/scans`, and `/api/findings` via `x-api-key` header or `Authorization: Bearer <key>`.
  - Public health check endpoint remains accessible for uptime monitoring.
- **Input Sanitization & DoS Defense**:
  - MongoDB ObjectId parameter validator rejects malformed identifiers before database queries.
  - Request body limits (`500kb`) and in-memory sliding-window rate limiter (200 req/min).
  - Helmet security headers and strict CORS configuration.

---

## 📁 Repository Structure

```
sentinelai/
├── .github/
│   └── workflows/
│       └── security-scan.yml   # Automated CI/CD security gate
├── bin/
│   └── sentinel.js             # Standalone CLI security scanner runner
├── client/                     # React Vite frontend dashboard
│   ├── src/
│   │   ├── api/client.js       # Authenticated REST client with timeout handling
│   │   ├── components/
│   │   │   ├── ApplicationsView.jsx    # Application inventory with profile selection
│   │   │   ├── FindingsView.jsx        # Findings table with direct/heuristic badges & drawer
│   │   │   ├── Header.jsx              # Navbar & live engine indicator
│   │   │   ├── MetricCards.jsx         # 4 KPI overview cards
│   │   │   ├── RegressionDiffModal.jsx # Side-by-side baseline diff inspector
│   │   │   ├── ScanHistoryView.jsx     # Historical scan audit log & baseline selector
│   │   │   └── ScanLauncher.jsx        # 1-click scan & demo comparison launcher
│   │   ├── App.jsx             # Master application coordinator
│   │   ├── index.css           # Warm-white / Forest-green design tokens
│   │   └── main.jsx
│   ├── vite.config.js          # Port 3000 dev server with /api proxy to 5000
│   └── package.json
├── demo-target/                # Simulated AI Application (Acme HR Assistant)
│   ├── src/
│   │   ├── app.js              # Express chat endpoint with delimiter mitigation
│   │   └── config.js           # Synthetic canary secret & system instructions
│   └── tests/                  # Demo target injection tests
├── server/                     # SentinelAI Express REST Backend
│   ├── src/
│   │   ├── config/             # Environment & Redis connection factory
│   │   ├── controllers/        # REST route handlers
│   │   ├── evaluators/         # DeterministicEvaluator with ReDoS & length checks
│   │   ├── middleware/         # auth.js, rateLimiter.js, validate.js, errorHandler.js
│   │   ├── models/             # Application, Scan, TestResult, Finding
│   │   ├── providers/          # HttpTargetAdapter & ssrfValidator.js
│   │   ├── queues/             # BullMQ queue producer & in-memory queue fallback
│   │   ├── routes/             # Express API routes
│   │   ├── services/           # scan.service.js, finding.service.js, demoAssessment
│   │   ├── test-engine/        # ScanEngine, RegressionEngine & domain test profiles
│   │   │   └── test-library/
│   │   │       ├── profiles/   # common, banking, healthcare, hr, customer-support
│   │   │       └── index.js
│   │   ├── workers/            # Background BullMQ scan workers
│   │   └── app.js              # Express app & middleware pipeline
│   └── tests/                  # 8 Jest test suites (68 tests)
│       └── security-hardening.test.js # Profiles, SSRF, Auth & Regression tests
├── package.json                # Root orchestration scripts
└── README.md
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v18+ (tested on v20 and v22)
- **npm**: v9+
- *(Optional)* **Redis** on port 6379 (SentinelAI automatically uses an in-memory queue mock if Redis is not running).

---

### 1. Install Dependencies
From the repository root:
```bash
npm install
npm --prefix demo-target install
npm --prefix server install
npm --prefix client install
```

---

### 2. Run Automated Test Verification
Run all **68 automated tests across 8 test suites**:
```bash
npm test
```
*Actual Verified Test Result:*
```text
Test Suites: 8 passed, 8 total
Tests:       68 passed, 68 total
Snapshots:   0 total
Time:        23.2s
```

---

### 3. Run the CLI Security Scanner
```bash
# 1. Start the target in a separate terminal:
npm run dev:target

# 2. Run scan against unmitigated target (Detects vulnerabilities and exits 1):
npm run scan:cli

# 3. Run scan with defenses active (Passes all assertions and exits 0):
npm run scan:mitigated
```

---

### 4. Run the Full Dashboard Platform
Open three terminal windows (or run in background):

```bash
# Terminal 1: Start Demo Target (Port 5001)
npm run dev:target

# Terminal 2: Start Express Backend API (Port 5000)
npm run dev:server

# Terminal 3: Start React Dashboard (Port 3000)
npm run dev:client
```

Open your browser to: **`http://localhost:3000`**

---

## 🔒 Security Hardening & SSRF Defenses

When deploying SentinelAI to evaluate external or multi-tenant AI applications, observe these security requirements:

| Defense Dimension | Implementation Detail |
|---|---|
| **SSRF Target Validation** | Pre-flight DNS lookup resolves hostnames. Blocks all IPv4/IPv6 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `::1`). |
| **Cloud Metadata Protection** | Unconditionally blocks `169.254.169.254` across AWS, GCP, Azure, and DigitalOcean in both dev and production. |
| **Redirect Inspection** | Follows redirects hop-by-hop with safe IP resolution on every hop (max 3 redirects) to defeat DNS rebinding. |
| **API Authentication** | Protected routes require `x-api-key` header matching `SENTINEL_API_KEY`. Defaults to `sentinel-dev-key` in dev. |
| **ReDoS Mitigation** | Custom regex patterns are strictly limited to 200 characters to prevent catastrophic backtracking. |
| **No Dynamic Code Execution** | Evaluator uses deterministic string and regex checks; arbitrary `eval()` or user-supplied script execution is prohibited. |
| **Parameter Sanitization** | `validateObjectId` prevents MongoDB cast errors; query pagination is clamped to `limit=100`. |

---

## ⚠️ Current Limitations

1. **Deterministic Test Scope**: SentinelAI evaluates deterministic boundary conditions (canaries, forbidden strings, length, JSON structure). It does not evaluate semantic drift that requires human judgment or secondary LLM judges.
2. **Simulator Boundaries**: The Acme HR demo target is a simulated reference implementation designed to verify the scanning and regression workflows. It does not certify the security posture of an arbitrary commercial LLM.
3. **SSRF Private Target Mode**: When running against local development targets (`127.0.0.1:5001`), `allowPrivateTargets` is enabled by default in non-production environments. In production, outbound requests to private RFC 1918 addresses are blocked unless explicitly configured behind an internal network proxy.

---

## 🛡️ License

MIT License. Designed and built by Pardhu.
