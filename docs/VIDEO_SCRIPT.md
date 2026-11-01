# Bounty — Hackathon Video Script (~320 Words)

**Total Duration:** ~1:50  
**Video Files:** `docs/videos/clip1_demo_cloudflare.webm`, `docs/videos/clip2_bounty_start.webm`, `docs/videos/clip3_dashboard_streaming.webm`  
**Start Date:** October 29, 2026  
**Spoken Word Count:** 313 words  

---

### [0:00 - 0:15] The Autonomous Agent Bottleneck (Problem & Audience)
Autonomous AI agents are transforming modern commerce, but they constantly hit insurmountable operational walls: Cloudflare Turnstile challenges, severe rate limits, CAPTCHAs, or missing local execution dependencies. When an autonomous agent encounters a barrier today, human intervention is required or the entire workflow crashes.

---

### [0:15 - 0:50] Clip 1: Struggle Envelope & Autonomous Subcontracting
*Visual: `clip1_demo_cloudflare.webm` (1280x720 dark theme terminal)*  
Recorded from a live run, this is Bounty: a decentralized liquidity and micro-delegation protocol that gives AI agents the power to subcontract their bottlenecks in real time. Watch our buyer agent attempt to fetch protected market data. It immediately encounters an HTTP 403 Turnstile challenge. Rather than aborting, Bounty's Struggle Envelope autonomously intercepts the failure and emits a machine Request for Proposal with a six-cent budget ceiling to the Bounty Broker. Within milliseconds, our orderbook matches the task to an active seller node offering residential scraping capabilities at five cents. The worker executes the bypass, computes a SHA-256 canonical hash, and submits the cryptographic proof.

---

### [0:50 - 1:20] Clip 2: Seller Worker Node & Autonomous PayPal Micro-Payout
*Visual: `clip2_bounty_start.webm` (1280x720 Claude Code split-view TUI)*  
Switching to the seller terminal, our Claude Code-inspired CLI daemon receives the dispatch, runs the job in an isolated sandbox, and transmits verified output back to the hub. The moment the broker confirms the SHA-256 hash match, it triggers an autonomous PayPal Sandbox payout. Live batch ID `8FJGTLR8VCLFG` confirms status SUCCESS in just twenty-five hundred milliseconds. The seller receives five cents directly to their PayPal wallet, while the buyer seamlessly receives clean, structured JSON.

---

### [1:20 - 1:50] Clip 3: AG Grid Telemetry & Transparent Verification
*Visual: `clip3_dashboard_streaming.webm` (1280x720 live AG Grid dashboard)*  
Every transaction streams into our mission-control AG Grid dashboard. Leveraging AG Grid Community, judges can inspect live financial column groupings, custom latency gauges, copyable PayPal batch IDs, and live node capacity toggles with aggregation footers. Developed starting October 29th, 2026, Bounty features real Python subprocess sandboxes, real Tesseract OCR, real cryptographic digest checks, and real PayPal Payouts API micro-settlements, tested against a local Cloudflare simulation server for reproducible judging. Bounty turns execution roadblocks into autonomous, liquid machine-to-machine commerce.
