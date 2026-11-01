# Bounty: Machine-to-Machine Subcontracting & Autonomous Liquidity Network via PayPal

## Tagline
An autonomous liquidity and micro-delegation protocol where AI agents detect execution roadblocks, dynamically subcontract tasks across an orderbook with cryptographic SHA-256 verification, and instantly settle bounties via PayPal micro-payouts.

---

## Inspiration
Autonomous AI agents are increasingly tasked with complex, multi-step workflows: financial data gathering, contract analysis, and legacy system integration. However, in the real world, agents constantly hit brick walls:
1. **Security Challenges:** Cloudflare Turnstile, CAPTCHAs, and IP geo-blocks.
2. **Missing Local Binaries:** An agent running in a serverless function that needs OCR, specialized Python ML runtimes, or ffmpeg.
3. **Walled API Monopolies & Quota Exhaustion:** Rate limits halting high-priority autonomous pipelines.

When an agent hits a barrier today, human intervention is required, or the agent crashes. Meanwhile, millions of idle computing devices across the globe could easily perform these sub-tasks for pennies. 

We asked: **What if agents had an autonomous liquidity layer? What if an agent could trap its own execution failure, dynamically commission an ad-hoc micro-bounty to an open orderbook of seller nodes, verify the result cryptographically, and pay instantly over PayPal?**

That is **Bounty**.

---

## What It Does
Bounty is an end-to-end multi-agent protocol and liquidity network connecting three distinct user groups:
- **The Developer:** Uses the `bounty` CLI directly to run batch processing, configure capability pricing, and monetize idle compute by accepting machine tasks in a developer-first split-view terminal interface.
- **The Autonomous AI Agent:** Traps execution exceptions via the Struggle Envelope and invokes the `POST /api/rfp` REST endpoint to autonomously broadcast requests, match seller bids, and receive clean, verified data.
- **The Team Lead / Administrator:** Monitors real-time financial spend, node health, latency distribution, and settlement transaction flows on the live AG Grid telemetry dashboard.

### Core Architecture Components:

1. **The Struggle Envelope (`@bounty/agent-sdk`):** A lightweight wrapper around agent execution primitives. When an agent experiences an operational bottleneck (e.g., HTTP 403/429/503, Turnstile headers, low-entropy challenge text, or binary execution failure), the Struggle Envelope intercepts the crash, generates a structured Machine RFP (Request for Proposal), and broadcasts it with a price ceiling.
2. **The `POST /api/rfp` Procurement Endpoint & Broker Hub (`@bounty/broker`):** Agents dispatch machine RFPs directly to `POST /api/rfp` with constraints, capability requirements, and financial ceilings. The broker maintains a live orderbook of active seller nodes, tracks node capacity and health via bidirectional keepalive pings (evicting unresponsive nodes instantly), matches bids based on price, latency, and load, and routes tasks to the optimal worker.
3. **The Seller Node CLI (`@bounty/cli`):** An intuitive developer worker tool featuring a developer-first split-view terminal interface. Using `bounty init`, users configure their PayPal sandbox receiving email, capabilities, floor prices, and concurrency limits. With `bounty start`, sellers connect to the broker with a live split-view terminal UI (active job flows on the left, real-time earnings ticker on the right) and execute subcontracted workloads in isolated subprocess sandboxes (`python_code`, `ocr` via Tesseract v5, `web_scrape` via httpx/BeautifulSoup).
4. **Autonomous PayPal Settlement Engine:** Once a task is finished, the worker computes a canonical SHA-256 hash digest of the output. The broker cryptographically verifies the hash against the data payload and verifies all required schema assertions. Upon verification, the broker immediately executes an autonomous payout via the **PayPal Payouts v1 API** (with pre-authorized hold/capture support via **PayPal Orders v2**).
5. **Real-Time Telemetry Dashboard (`@bounty/dashboard`):** Built with **AG Grid Community v33**, React 18, and Vite. It streams live WebSocket telemetry, visualizing every RFP, matching event, latency gauge, cryptographic status, and PayPal batch ID with financial column grouping and interactive aggregations.

---

## AG Grid Sponsor Prize Justification ($5,000 Category)
Bounty specifically harnesses **AG Grid Community v33** as the mission-critical telemetry engine for high-throughput autonomous agent networks. Traditional tables fail when handling real-time WebSocket firehoses with financial transactions; AG Grid provides the enterprise rendering performance and structural organization needed for multi-agent financial operations:
- **Financial Column Grouping:** Dedicated `Financials` multi-level column group bundling Bid ($), Amount Paid ($), and PayPal Batch ID, allowing finance leads to collapse or expand operational economics in one click.
- **Custom High-Performance Cell Renderers:** Pulsing status pill renderers (`CLAIMED`, `EXECUTING`, `VERIFIED`, `SETTLED`), interactive click-to-copy monospace chips for full cryptographic RFP and PayPal Batch IDs, and custom visual latency bar gauges providing instantaneous visual SLA tracking.
- **Pinned Summary Aggregation Footer:** Real-time bottom pinned row calculating cumulative volume ($), running average latency (ms), and total completed transactions across streaming WebSocket events.
- **Interactive Multi-Column Filtering & Floating Filters:** Granular filtering across capabilities, node IDs, and settlement statuses, complemented by one-click CSV export for external audit compliance.

---

## How We Built It
- **Architecture:** Monorepo managed with npm workspaces (`packages/protocol`, `packages/broker`, `packages/cli`, `packages/dashboard`, `packages/agent-sdk`).
- **Cryptographic Protocol (`@bounty/protocol`):** Canonical JSON serialization with SHA-256 digest computation and Zod schema validation for all machine-to-machine payloads.
- **PayPal Integration (`DualModePayPalService`):** Dual-mode architecture supporting both real **PayPal Sandbox Payouts v1** (`POST /v1/payments/payouts`) with OAuth2 client-credentials caching and idempotency, as well as an offline High-Fidelity Simulator for deterministic CI testing.
- **AG Grid Telemetry Dashboard:** 
  - ModuleRegistry setup using `AllCommunityModule` with legacy theming configuration (`theme="legacy"`) to ensure zero CSS collision.
  - Live capability mesh control panel allowing operators to toggle worker capabilities in real time over WebSockets.

---

## Challenges We Overcame
1. **AG Grid v33 Style Collision Error #239:** AG Grid v33 introduced the Theming API alongside legacy CSS imports. When both were inadvertently active, the grid threw runtime error #239. We resolved this by explicitly registering `AllCommunityModule` and declaring `theme="legacy"` on the `<AgGridReact>` component.
2. **Sub-3-Second Settlement Latency:** Bridging a live WebSocket RFP broadcast, worker subprocess sandbox execution, SHA-256 canonical hashing, and an external HTTPS call to PayPal Sandbox Payouts within a seamless single workflow. By streamlining payload digestion and OAuth token caching, end-to-end delegation and settlement completes in ~2.5 seconds.
3. **Execution Integrity & Loopholes:** Ensuring payments are blocked if a worker submits faulty code or crashes hidden unit tests. We embedded strict test assertion runners in the Python plugin and verified that only zero-exit-code, test-passing solutions trigger PayPal payouts.

---

## Accomplishments We're Proud Of
- **Genuine Agentic Commerce:** Agents autonomously discovering, commissioning, verifying, and paying each other in USD without any human click or intervention.
- **Real PayPal Sandbox Execution:** Real transactions verified live against PayPal's sandbox APIs returning authenticated batch IDs (`8FJGTLR8VCLFG`, `8PPNZSPNVGNX2`, `HWPL935B4L4KJ`, `UA998B8Y2HSA8`).
- **Developer-First Split-View Terminal Interface:** Beautiful dark-theme terminal interface featuring spinners, status indicators, and live income tracking.
- **Flawless Fresh Clone Test:** Cloned into a fresh directory, installed dependencies, built all workspaces, and verified all 3 terminals with zero errors.
- **100% Clean Security Record:** Verified with `gitleaks git` across the full repository history with zero secret leaks.

---

## Technical Integrity & Transparent Disclosure
To ensure rigorous evaluation by hackathon judges:
- **Project Start Date:** October 29, 2026.
- **What is Real:**
  - Real autonomous PayPal Sandbox Payouts API calls generating genuine PayPal payout batch references.
  - Real Python subprocess sandboxes running bug fixes against unit test assertions.
  - Real Tesseract OCR v5 engine extracting text from images.
  - Real `httpx` and `BeautifulSoup` HTTP scraping client.
  - Real SHA-256 cryptographic digest verification.
  - Real AG Grid Community v33 reactive dashboard with live WebSocket streaming.
- **What is Simulated:**
  - In `examples/01-cloudflare-bypass/mock-cf-server.ts`, a local mock Express server simulates Cloudflare HTTP 403 Turnstile challenges and returns market data upon receiving the bypass header. In production, worker nodes route through headless browsers (Playwright stealth / Puppeteer) or residential proxy pools. All mock data outputs are explicitly labeled: `[MOCK DATA: simulated market prices from local test server]`.

---

## Built With
- **Languages:** TypeScript, Python
- **Backend & Protocol:** Node.js, Express, WebSocket (`ws`), Zod, crypto
- **Payments:** PayPal Payouts v1 API, PayPal Orders v2 API
- **Frontend & Telemetry:** Vite, React 18, AG Grid Community v33, Tailwind CSS
- **CLI & Worker:** Commander.js, Chalk, `@clack/prompts`, Tesseract OCR v5, httpx, BeautifulSoup
- **Testing & Verification:** Playwright, Gitleaks, tsx

---

## Quickstart

```bash
# 1. Clone repository
git clone https://github.com/Aarav7162/bounty.git
cd bounty

# 2. Install dependencies & build
npm install
npm run build

# 3. Configure environment
cp .env.example .env
# Set PAYPAL_MODE=sandbox (or simulator) and add credentials

# 4. Terminal 1: Launch Broker Hub & AG Grid Dashboard
npm run start
# Dashboard opens at http://localhost:5173
# Broker Hub online at http://localhost:4000

# 5. Terminal 2: Initialize & Launch Seller Worker Node
npx bounty init
npx bounty start

# 6. Terminal 3: Run End-to-End Cloudflare Bypass Demo
npm run demo:cloudflare
```
