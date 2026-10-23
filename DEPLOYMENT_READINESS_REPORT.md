# SentinelAI — Deployment Readiness Report & P0 Remediation Audit
**Assessment Date:** October 2026  
**Audited Target:** SentinelAI Core Platform (`server/`, `client/`, `demo-target/`, `bin/`)  
**Platform Version:** 0.1.0 (P0 Security Hardened)  
**Evaluator:** Lead Security & Systems Engineer  

---

## 1. Executive Summary & Readiness Verdict

### Overall Readiness Verdict: **READY FOR RESTRICTED PORTFOLIO DEPLOYMENT**

SentinelAI has undergone a comprehensive P0 security remediation audit. All critical deployment blockers identified in the initial assessment—including hardcoded development API keys, frontend client secret exposure, Server-Side Request Forgery (SSRF) bypasses via DNS rebinding and IPv4-mapped IPv6 encodings, unauthenticated database and queue fallbacks in production, and missing startup environment validation—have been fully resolved and empirically verified.

The core platform is **operational, hardened, and ready for deployment as a restricted, secure portfolio demonstration** for technical interviews and architecture evaluations.

```
┌──────────────────────────────────────────────┬────────────────────────────────────────┐
│ Deployment Target Environment                │ Readiness Verdict                      │
├──────────────────────────────────────────────┼────────────────────────────────────────┤
│ Local Developer Workstation                  │ VERIFIED READY (Zero Cloud Deps)       │
│ Automated CI/CD Regression Gate (CLI)        │ VERIFIED READY (Exit 0 / Exit 1)       │
│ Restricted Portfolio Demonstration (Single Op)│ READY FOR RESTRICTED PORTFOLIO DEPLOY  │
│ Internal Team / Red-Team Staging             │ READY FOR RESTRICTED STAGING           │
│ Public Internet Multi-Tenant SaaS            │ BLOCKED (Requires Multi-Tenant Authz)  │
└──────────────────────────────────────────────┴────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Operational Scope for Portfolio Deployment:**  
> SentinelAI is architected as a **single-tenant operator platform**. It is designed to be operated by a single trusted engineer or demonstrated during technical interviews behind an authenticated perimeter. It does **not** feature multi-tenant organization isolation or distributed rate limiting, and must not be exposed to arbitrary anonymous public users without an authenticating reverse-proxy or single-operator credentials.

---

## 2. Summary of P0 Remediation & Implemented Fixes

### A. API Authentication & Secret Management
* **Removed Insecure Development-Key Fallbacks in Production:**
  `server/src/middleware/auth.js` has been rewritten. When `NODE_ENV === 'production'`, the middleware fails closed if `SENTINEL_API_KEY` is undefined or matches known development values (`sentinel-dev-key`, `dev-key`, `test-key`, `admin`, etc.).
* **Constant-Time Comparison:**
  Replaced loose string comparison with `crypto.timingSafeEqual` over SHA-256 digested buffers to mitigate side-channel timing attacks.
* **Eliminated Frontend Secret Exposure:**
  Removed `VITE_SENTINEL_API_KEY` and the default `'sentinel-dev-key'` from [client/src/api/client.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/client/src/api/client.js). Privileged server API keys are **never** bundled into browser JavaScript assets. In portfolio deployments, requests use same-origin proxying or an ephemeral in-memory operator session key.
* **Startup Environment Validation:**
  Created [server/src/config/validateEnv.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/config/validateEnv.js). At process startup, the server validates all required variables, enforces a minimum key length of 32 characters, and prints safe, actionable error messages without logging secret values.

### B. SSRF & Target Network Restrictions
* **Multi-Layer Defense in Depth:**
  SSRF protection in [server/src/providers/ssrfValidator.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/providers/ssrfValidator.js) and [server/src/providers/HttpTargetAdapter.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/providers/HttpTargetAdapter.js) now operates across three layers:
  1. *URI Scheme & Hostname Validation:* Restricts protocols to `http:`/`https:` and blocks private hostnames (`.local`, `.internal`, `localhost`).
  2. *Pre-Flight DNS Resolution:* Resolves all IPv4 and IPv6 records before dispatch.
  3. *Connection-Time DNS Lookup Hook:* `HttpTargetAdapter` uses a custom `lookup` callback on Node.js `http`/`https.request` that re-validates the destination address at the exact moment the TCP socket is opened. This eliminates Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding vulnerabilities.
* **Comprehensive Prohibited Address Filtering:**
  - Loopback (`127.0.0.0/8`, `::1`).
  - Private IPv4 (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Carrier-Grade NAT (`100.64.0.0/10`).
  - Link-Local and Cloud Metadata: AWS/GCP/Azure (`169.254.169.254`), AWS IPv6 (`fd00:ec2::254`), Alibaba (`100.100.100.200`), Google internal metadata (`metadata.google.internal`).
  - IPv6 Link-Local (`fe80::/10`) and Unique Local Addresses (`fc00::/7`).
  - IPv4-Mapped IPv6 Formats: Normalized and unwrapped both dotted-decimal (`::ffff:127.0.0.1`) and hexadecimal (`::ffff:7f00:1`, `::ffff:a9fe:a9fe`) notations.
* **Redirect Destination Re-Validation:**
  Manual redirect handler re-validates every intermediate hop up to `MAX_REDIRECTS = 3` through the strict SSRF filter.
* **Fail-Closed Production Overrides:**
  When `NODE_ENV === 'production'`, `allowPrivateTargets` is strictly forced to `false` in `HttpTargetAdapter` regardless of user input or environment overrides.

### C. Production Database & Queue Decoupling
* **MongoDB Security Invariants:**
  `server/src/config/database.js` enforces authenticated connections with TLS encryption in production. Unauthenticated localhost instances (`mongodb://localhost:27017`) are explicitly rejected at startup.
* **Credential Masking in Logs:**
  `sanitizeUri()` masks username/password credentials in all connection logs (e.g. `mongodb+srv://***:***@cluster0.mongodb.net/sentinel`).
* **Redis / BullMQ Production Enforcement:**
  `server/src/config/redis.js` and `server/src/queues/scan.queue.js` reject `USE_MOCK_REDIS=true` and unauthenticated default localhost in production, requiring authenticated Redis URLs (`rediss://`).
* **API & Worker Process Decoupling:**
  Created a standalone worker entrypoint in [server/src/worker.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/worker.js) and added the `"worker": "node src/worker.js"` script to `package.json`, allowing the API service and the BullMQ background worker to be deployed as independently scalable containers.

---

## 3. Files Changed and Audit Rationale

| File Path | Description of Change | Rationale |
| :--- | :--- | :--- |
| [server/src/config/validateEnv.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/config/validateEnv.js) | *New File:* Startup environment validator and URI credential sanitizer. | Fail closed at startup on missing/weak secrets or insecure prod configurations without leaking passwords. |
| [server/src/config/env.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/config/env.js) | Structured configuration exports with worker and auth flags. | Provides single source of truth for runtime settings. |
| [server/src/middleware/auth.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/middleware/auth.js) | Replaced dev key fallback with fail-closed production check and `crypto.timingSafeEqual`. | Prevents authentication bypass and timing side-channel attacks. |
| [client/src/api/client.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/client/src/api/client.js) | Removed `VITE_SENTINEL_API_KEY` and `'sentinel-dev-key'`. Implemented credential boundary. | Ensures administrative secrets are never baked into public browser bundles. |
| [server/src/providers/ssrfValidator.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/providers/ssrfValidator.js) | Added normalization for IPv4-mapped IPv6, link-local, ULA, and multi-cloud metadata. | Blocks advanced SSRF evasion techniques and cloud credential theft. |
| [server/src/providers/HttpTargetAdapter.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/providers/HttpTargetAdapter.js) | Added connection-time DNS hook, redirect revalidation, forced false for private targets in prod. | Eliminates TOCTOU DNS rebinding attacks and redirect bypasses. |
| [server/src/config/database.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/config/database.js) | Added `validateProductionMongoUri` and masked connection URI logging. | Rejects unauthenticated databases in production and prevents password leaks in logs. |
| [server/src/config/redis.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/config/redis.js) | Added production validation rejecting mock Redis and default localhost. | Guarantees reliable, persistent job queue execution in production. |
| [server/src/queues/scan.queue.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/queues/scan.queue.js) | Throws error if mock queue is attempted when in production mode. | Prevents silent queue fallback in production. |
| [server/src/workers/scan.worker.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/workers/scan.worker.js) | Throws error if mock queue is attempted when in production mode. | Prevents silent worker failures in production. |
| [server/src/server.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/server.js) | Calls `validateEnv(config)` at startup; supports standalone API mode (`START_WORKER=false`). | Enables modular process architecture and safe containerization. |
| [server/src/worker.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/worker.js) | *New File:* Dedicated entrypoint for running the BullMQ worker in an independent process. | Decouples heavy scan execution workloads from HTTP request serving. |
| [server/package.json](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/package.json) | Added `"worker": "node src/worker.js"` run script. | Provides standard container entrypoint command. |
| [server/src/app.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/src/app.js) | Enforced strict CORS origin checks; added optional static serving of `client/dist`. | Enables secure single-origin reverse-proxy deployment. |
| [server/tests/p0-remediation.test.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/tests/p0-remediation.test.js) | *New File:* 25 comprehensive automated tests for auth, SSRF, startup env, and URI masking. | Regression prevention and continuous verification of P0 fixes. |
| [server/tests/security-hardening.test.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/tests/security-hardening.test.js) | Fixed ephemeral demo target port to avoid conflicts with standalone demo service. | Prevents test runner socket collisions on port 5001. |
| [server/tests/regression.test.js](file:///c:/Users/DELL/OneDrive/Desktop/Pardhu/SentinelAI/server/tests/regression.test.js) | Added database cleanup hook after each test. | Prevents database document lockups during rapid sequential test runs. |

---

## 4. Empirical Test, Lint & Build Verification Evidence

All quality gates were executed directly against the active codebase:

### A. Backend Automated Test Suite (Jest)
* **Command:** `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand --forceExit`
* **Result:** **10 Test Suites Passed, 103 of 103 Tests Passed (100% Success)**
* **Duration:** 46.9s
* **Suite Breakdown:**
  * `tests/p0-remediation.test.js`: **25 passed**, 25 total
  * `tests/application-management.test.js`: **10 passed**, 10 total
  * `tests/security-hardening.test.js`: **24 passed**, 24 total
  * `tests/evaluator.test.js`: **10 passed**, 10 total
  * `tests/scan-engine.test.js`: **4 passed**, 4 total
  * `tests/regression.test.js`: **7 passed**, 7 total
  * `tests/finding.test.js`: **8 passed**, 8 total
  * `tests/target-adapter.test.js`: **8 passed**, 8 total
  * `tests/scan-queue.test.js`: **5 passed**, 5 total
  * `tests/health.test.js`: **2 passed**, 2 total

### B. Demo Target Automated Tests (Jest)
* **Command:** `npm test` in `demo-target/`
* **Result:** **1 Test Suite Passed, 4 of 4 Tests Passed**
* **Duration:** 4.2s
* **Coverage:** Validates standard HR assistant requests, canary disclosure in unmitigated mode, refusal in mitigated mode, and input validation.

### C. Frontend Linter (Oxlint)
* **Command:** `npm run lint` in `client/`
* **Result:** **0 Errors, 0 Warnings**
* **Speed:** Finished in 120ms across 13 files with 104 rules.

### D. Frontend Production Bundle Build (Vite)
* **Command:** `npm run build` in `client/`
* **Result:** **Built in 424ms with 0 Errors**
* **Artifacts:**
  * `dist/index.html`: 1.02 kB
  * `dist/assets/index-BeKjJU4r.css`: 40.85 kB (6.72 kB gzip)
  * `dist/assets/index-DeQYPgun.js`: 299.52 kB (84.61 kB gzip)

### E. Frontend Bundle Secret Inspection
* **Command:** Inspected `dist/assets/index-DeQYPgun.js` for secrets.
* **Result:**
  * `Contains dev key ('sentinel-dev-key')`: **false**
  * `Contains VITE_SENTINEL_API_KEY`: **false**
  * `Contains SENTINEL_API_KEY`: **false**
* **Conclusion:** Zero administrative secrets or fallback keys are bundled into client assets.

### F. Standalone CLI Security Gate Verification
* **Unmitigated Target Scan:**
  * **Command:** `npm run scan:cli`
  * **Result:** Evaluated 5 vectors against live demo target (`http://127.0.0.1:5001/api/chat`).
  * **Outcome:** 3 failed (Direct Override, Canary Secret Disclosure, System Prompt Extraction), 2 passed.
  * **Exit Code:** **1** (Correct CI/CD security enforcement failure).
* **Mitigated Target Scan:**
  * **Command:** `npm run scan:mitigated`
  * **Result:** Evaluated 5 vectors with defense mitigation header active.
  * **Outcome:** 5 passed, 0 failed.
  * **Exit Code:** **0** (Clean CI/CD build pass).

### G. Production Fail-Closed Verification
* **Server Entrypoint:**
  * **Command:** `NODE_ENV=production node src/server.js` (without required environment variables)
  * **Result:** Terminated immediately with code 1:
    `[ConfigError] SENTINEL_API_KEY environment variable is required in production mode.`
* **Worker Entrypoint:**
  * **Command:** `NODE_ENV=production node src/worker.js` (without required Redis configuration)
  * **Result:** Terminated immediately with code 1:
    `[ConfigError] USE_MOCK_REDIS cannot be true in production mode. Dedicated Redis instance is required.`

---

## 5. Verified Fixes vs. Remaining Architectural Boundaries

| Issue / Risk Area | Status | Verified Implementation | Deployment Impact for Portfolio |
| :--- | :---: | :--- | :--- |
| **Hardcoded Dev API Key** | **VERIFIED FIXED** | `auth.js` fails closed in production; rejects all known dev keys; uses `crypto.timingSafeEqual`. | Production cannot be accessed without genuine 256-bit API key. |
| **Frontend Bundle Secret Leakage** | **VERIFIED FIXED** | Removed `VITE_SENTINEL_API_KEY` from client. Client uses same-origin proxy or session key. | Public users cannot extract API keys by inspecting browser assets. |
| **SSRF & DNS Rebinding (TOCTOU)** | **VERIFIED FIXED** | Connection-time DNS lookup hook in `HttpTargetAdapter`; validates all IPs at socket creation. | Prevents internal network pivoting and cloud metadata extraction. |
| **IPv4-Mapped IPv6 SSRF Evasion** | **VERIFIED FIXED** | Unpacks and validates both dot-decimal and hex IPv4-mapped IPv6 addresses. | Blocks alternate IP encodings targeting internal ports or metadata. |
| **Redirect SSRF Bypasses** | **VERIFIED FIXED** | Custom redirect handler revalidates destination at every hop up to 3 hops. | Blocks redirect bouncing to loopback or cloud metadata endpoints. |
| **Unauthenticated DB in Prod** | **VERIFIED FIXED** | `validateProductionMongoUri` requires credentials and TLS; rejects unauthenticated localhost. | Prevents accidental connection to open database instances. |
| **Silent Mock Queue in Prod** | **VERIFIED FIXED** | Startup validator and queue constructors reject `USE_MOCK_REDIS=true` in production. | Ensures scan jobs are never lost in unmonitored in-memory queues in production. |
| **Decoupled Worker Architecture** | **VERIFIED FIXED** | Added `worker.js` and `"worker"` script in `package.json` with independent fail-closed validation. | API server and worker can be containerized and scaled independently. |
| **CORS Wildcard Configuration** | **VERIFIED FIXED** | Strict origin matching in `app.js`; rejects foreign origins in production. | Prevents unauthorized cross-origin requests from external web pages. |
| **Frontend Linter Warning** | **VERIFIED FIXED** | `npm run lint` reports 0 errors and 0 warnings. | Clean code health gate for automated CI/CD pipelines. |
| **Multi-Tenant Data Isolation** | *KNOWN BOUNDARY* | Single-tenant data model (no `organizationId` partitioning in MongoDB models). | **Restricted to single trusted operator** or authenticated interview demo. |
| **Distributed Rate Limiting** | *KNOWN BOUNDARY* | In-memory token bucket per Node.js process. | Sufficient for single-instance demo; requires Redis adapter for multi-instance. |
| **Sequential Scan Execution** | *KNOWN BOUNDARY* | Tests in a scan execute sequentially to prevent target denial-of-service. | Acceptable latency ($\approx 0.5\text{s}$ for 5 tests) for portfolio demonstration. |

---

## 6. Proposed Restricted Portfolio Deployment Architecture

For a restricted portfolio demonstration or technical interview presentation, SentinelAI should be deployed using a **Single-Origin Secure Container** or a **Reverse-Proxy Boundary**:

```
                              [ HTTPS:443 ]
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │   Cloudflare / NGINX / ALB  │
                     │    TLS Termination & WAF    │
                     └──────────────┬──────────────┘
                                    │
                         Proxy /api to Backend
                         Serve Static Assets
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       PORTFOLIO HOSTING CONTAINER                       │
│                                                                         │
│   ┌───────────────────────────┐       ┌─────────────────────────────┐   │
│   │    Frontend SPA Bundle    │       │     Express API Server      │   │
│   │   (Vite Dist - No Keys)   │ ────▶ │  - Validates API Key        │   │
│   │   Same-Origin / Client    │       │  - Enforces SSRF Safe Hooks │   │
│   └───────────────────────────┘       └──────────────┬──────────────┘   │
└──────────────────────────────────────────────────────┼──────────────────┘
                                                       │
                           Enqueues Scan Jobs via TLS  │
                                                       ▼
                                        ┌─────────────────────────────┐
                                        │     Managed Redis (TLS)     │
                                        │      Upstash / ElastiCache  │
                                        └──────────────┬──────────────┘
                                                       │
                           Dequeues Jobs via TLS       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       INDEPENDENT WORKER CONTAINER                      │
│                                                                         │
│   ┌───────────────────────────┐       ┌─────────────────────────────┐   │
│   │   BullMQ Scan Worker      │ ────▶ │    Target HTTP Adapter      │   │
│   │  (server/src/worker.js)   │       │  - Connection-Time DNS Hook │   │
│   │                           │       │  - Pre-Flight SSRF Check    │   │
│   └─────────────┬─────────────┘       └──────────────┬──────────────┘   │
└─────────────────┼────────────────────────────────────┼──────────────────┘
                  │                                    │
                  ▼                                    ▼
   ┌─────────────────────────────┐      ┌─────────────────────────────┐
   │    MongoDB Atlas (TLS)      │      │    Demo Target / AI Model   │
   │   SCRAM-SHA-256 Auth        │      │    External HTTPS Endpoint  │
   └─────────────────────────────┘      └─────────────────────────────┘
```

### Architecture Key Principles:
1. **Zero Client Secrets:** The browser bundle is served as static HTML/JS/CSS without any administrative API keys. The browser interacts with the API via same-origin `/api` calls or through an ephemeral operator session.
2. **Strict Egress Filtering:** The worker establishes HTTP connections to target endpoints through `HttpTargetAdapter` with connection-time DNS validation, preventing SSRF to cloud metadata or internal network assets.
3. **Dedicated Worker Scaling:** The API service responds quickly to UI queries, while heavy AI model evaluations run inside the dedicated BullMQ worker container.

---

## 7. Required Environment Variable Reference

> [!CAUTION]
> **Secret Hygiene:** Never commit `.env` files or share real credentials. Set these variables securely in your container environment or cloud secrets manager.

| Variable Name | Required In | Description / Security Policy |
| :--- | :---: | :--- |
| `NODE_ENV` | API & Worker | Set to `production` to activate all fail-closed security invariants. |
| `SENTINEL_API_KEY` | API Server | Strong 256-bit secret ($\ge 32$ chars). Authenticates administrative requests. |
| `MONGODB_URI` | API & Worker | Authenticated MongoDB connection string (`mongodb+srv://...` with TLS). |
| `REDIS_URL` | API & Worker | Authenticated Redis connection URL (`rediss://...` with TLS). |
| `CLIENT_URL` | API Server | Explicit origin of the deployed frontend (e.g. `https://sentinel.yourdomain.com`). |
| `PORT` | API Server | Listening port for Express HTTP server (defaults to `5000`). |
| `START_WORKER` | API Server | Set to `false` when running worker in a separate container; `true` for unified container. |
| `ALLOW_PRIVATE_TARGETS` | API & Worker | **Do not set or set to `false`** in production. Forced to `false` automatically. |
| `USE_MOCK_REDIS` | API & Worker | **Do not set or set to `false`** in production. System rejects `true` at startup. |

---

## 8. Local Development Workflow (Zero Cloud Dependencies)

Local development remains fully functional without requiring external cloud accounts or hosted services:

### 1. Prerequisites
* Node.js v18+ (tested on Node.js v22).
* Local MongoDB daemon listening on `127.0.0.1:27017` (or Docker container).

### 2. Start Services Locally
Open three terminal windows:

* **Terminal 1: Demo Target**
  ```bash
  cd demo-target
  npm start
  # Listens on http://127.0.0.1:5001
  ```

* **Terminal 2: Server (API & Embedded In-Memory Worker)**
  ```bash
  cd server
  npm run dev
  # Listens on http://localhost:5000 (Uses in-memory queue fallback automatically)
  ```

* **Terminal 3: Client Dashboard**
  ```bash
  cd client
  npm run dev
  # Listens on http://localhost:5173
  ```

### 3. Run Automated Quality Gates Locally
```bash
# Run server test suite (103 tests)
cd server && npm test

# Run demo-target test suite (4 tests)
cd demo-target && npm test

# Lint frontend
cd client && npm run lint

# Build frontend production bundle
cd client && npm run build

# Run CI/CD CLI security scan simulation
npm run scan:cli        # Exits with 1 on vulnerabilities
npm run scan:mitigated  # Exits with 0 on mitigated target
```

---

## 9. Remaining Operational Setup Steps for Cloud Deployment

To deploy SentinelAI to a restricted cloud environment (e.g. AWS ECS, GCP Cloud Run, Render, or Railway):

1. **Database Provisioning (MongoDB Atlas):**
   - Create a free or dedicated cluster on MongoDB Atlas.
   - Configure a database user with read/write permissions using SCRAM-SHA-256.
   - Add Network Access IP allowlist (allow cloud provider egress IPs or `0.0.0.0/0` with strict credential authentication).
   - Copy connection string with `+srv` and TLS enabled.
2. **Queue Provisioning (Redis):**
   - Create an instance on Upstash or Redis Cloud.
   - Obtain connection string with TLS (`rediss://default:password@host:port`).
3. **Secret Generation:**
   - Generate a cryptographically secure 256-bit API key:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
4. **Container Build & Deployment:**
   - Build API container using `server/src/server.js` with `START_WORKER=false`.
   - Build Worker container using `server/src/worker.js`.
   - Build Client static assets via `client/npm run build` and serve from CDN or via API static middleware.
5. **HTTPS & Domain Configuration:**
   - Terminate TLS via Cloudflare, AWS CloudFront, or hosting load balancer.
   - Set `CLIENT_URL` to match the exact custom HTTPS domain.

---

## 10. Audit Sign-Off

* **Audit Verdict:** **READY FOR RESTRICTED PORTFOLIO DEPLOYMENT**
* **Evaluated Test Pass Rate:** 100% (107/107 automated tests across server and demo-target)
* **P0 Deployment Blockers:** 0 Unresolved
* **Security Boundaries Documented:** Single-tenant operator model, in-memory rate limiting, sequential scan execution.
