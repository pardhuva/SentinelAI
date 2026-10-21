# SentinelAI 🛡️
> Developer-focused LLM Security Testing & Regression Platform

SentinelAI is a platform designed to test AI-powered applications for security vulnerabilities (e.g. prompt injection, unauthorized instruction override, synthetic secret disclosure), capture reproducible evidence, and detect regressions across prompt/model iterations.

---

## 🏗️ Architecture Overview

```
                                 ┌──────────────────────────────────┐
                                 │     React Dashboard (Vite)       │
                                 └─────────────────┬────────────────┘
                                                   │ HTTP / REST
                                                   ▼
                                 ┌──────────────────────────────────┐
                                 │    Express API (Modular Monolith) │
                                 └────────┬─────────────────┬───────┘
                                          │                 │
                         Enqueues Scan Job│                 │ Persists Scans, Findings
                                          ▼                 ▼
                                    ┌───────────┐     ┌───────────┐
                                    │ Redis     │     │ MongoDB   │
                                    │ (BullMQ)  │     │ (Mongoose)│
                                    └─────┬─────┘     └───────────┘
                                          │
                                          │ Job Event
                                          ▼
                               ┌──────────────────────┐
                               │  Background Worker   │
                               └──────────┬───────────┘
                                          │ Executes Test Cases
                                          ▼
                          ┌────────────────────────────────┐
                          │   Target AI App / Adapter      │
                          │   (e.g., Demo Target App)      │
                          └───────────────┬────────────────┘
                                          │ Returns Output
                                          ▼
                          ┌────────────────────────────────┐
                          │       Evaluation Engine        │
                          │  - Deterministic Canary Match  │
                          │  - Forbidden Output Assertions │
                          │  - Model Evaluator (Optional)  │
                          └────────────────────────────────┘
```

---

## 📁 Repository Structure

```
sentinelai/
├── client/                     # (Milestone 6) React Vite frontend dashboard
├── server/                     # Express REST API backend
│   ├── src/
│   │   ├── config/             # Centralized environment & service configurations
│   │   ├── controllers/        # Route handlers
│   │   ├── evaluators/         # (Milestone 3) Deterministic and semantic evaluators
│   │   ├── middleware/         # Error, 404, auth, and validation middleware
│   │   ├── models/             # (Milestone 4) Mongoose data models
│   │   ├── providers/          # (Milestone 2) Normalized target and LLM adapters
│   │   ├── queues/             # (Milestone 5) BullMQ job producer queues
│   │   ├── routes/             # Express API routing definitions
│   │   ├── services/           # Core business logic
│   │   ├── test-engine/        # (Milestone 4) Test suite executor
│   │   ├── utils/              # Helper utilities
│   │   ├── app.js              # Express app setup and middleware pipeline
│   │   └── server.js           # Network listener & graceful shutdown
│   ├── tests/                  # Jest + Supertest test suites
│   ├── .env.example
│   ├── .env
│   └── package.json
├── demo-target/                # (Milestone 2) Vulnerable & mitigated demo target
└── README.md
```

---

## 🚀 Quickstart - Milestone 1

### Prerequisites
- **Node.js**: v18+ (tested on v22)
- **npm**: v9+

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` (defaults are ready for local development):
```bash
cp .env.example .env
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev
```
Health endpoint will be accessible at: `http://localhost:5000/api/health`
