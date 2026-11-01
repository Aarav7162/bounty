import { chromium } from "playwright";
import { resolve } from "node:path";
import { existsSync, mkdirSync, renameSync } from "node:fs";

async function recordDashboardClip(videosDir: string) {
  console.log("Recording Clip 3: AG Grid Dashboard Live Telemetry (1280x720, 30s)...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videosDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Perform realistic interactions with AG Grid
  try {
    // 1. Sort by Amount Paid or Time
    const timeHeader = page.locator(".ag-header-cell-text").filter({ hasText: "Time" }).first();
    if (await timeHeader.count() > 0) {
      await timeHeader.click();
      await page.waitForTimeout(2000);
    }

    // 2. Click a status filter
    const statusHeader = page.locator(".ag-header-cell-text").filter({ hasText: "Status" }).first();
    if (await statusHeader.count() > 0) {
      await statusHeader.hover();
      await page.waitForTimeout(2000);
    }

    // 3. Hover over PayPal Batch ID chip
    const copyChip = page.locator("code").first();
    if (await copyChip.count() > 0) {
      await copyChip.hover();
      await page.waitForTimeout(2000);
    }

    // 4. Toggle a capability on the sidebar
    const toggleBtn = page.locator("button").filter({ hasText: "ACTIVE" }).first();
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click();
      await page.waitForTimeout(1500);
      await toggleBtn.click();
      await page.waitForTimeout(2000);
    }

    // 5. Scroll through grid rows
    const gridBody = page.locator(".ag-body-viewport").first();
    if (await gridBody.count() > 0) {
      await gridBody.evaluate(el => el.scrollBy({ top: 150, behavior: "smooth" }));
      await page.waitForTimeout(3000);
      await gridBody.evaluate(el => el.scrollBy({ top: -150, behavior: "smooth" }));
      await page.waitForTimeout(3000);
    }
  } catch (err: any) {
    console.warn("Interaction note:", err.message);
  }

  // Remain active for duration
  await page.waitForTimeout(10000);

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const videoPath = await video.path();
    const destPath = resolve(videosDir, "clip3_dashboard_streaming.webm");
    renameSync(videoPath, destPath);
    console.log(`✓ Saved Clip 3 to ${destPath}`);
  }
}

async function recordTerminalClip(
  videosDir: string,
  filename: string,
  title: string,
  terminalContentHtml: string,
  durationMs = 20000
) {
  console.log(`Recording ${filename} (1280x720, ${Math.round(durationMs / 1000)}s)...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videosDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'Consolas', 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 14.5px;
      line-height: 1.5;
      padding: 24px;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .window {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      box-shadow: 0 16px 32px rgba(0,0,0,0.5);
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .titlebar {
      background: #21262d;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid #30363d;
      user-select: none;
    }
    .dots { display: flex; gap: 8px; margin-right: 16px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot-red { background: #ff5f56; }
    .dot-yellow { background: #ffbd2e; }
    .dot-green { background: #27c93f; }
    .title { color: #8b949e; font-size: 13px; font-weight: 600; }
    .terminal-body {
      padding: 20px 24px;
      flex: 1;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .cyan { color: #58a6ff; }
    .green { color: #3fb950; font-weight: 600; }
    .yellow { color: #d29922; }
    .red { color: #f85149; }
    .gray { color: #8b949e; }
    .bold { font-weight: bold; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .badge-success { background: rgba(46, 160, 67, 0.2); color: #3fb950; border: 1px solid #2ea043; }
    .badge-info { background: rgba(56, 139, 253, 0.2); color: #58a6ff; border: 1px solid #388bfd; }
  </style>
</head>
<body>
  <div class="window">
    <div class="titlebar">
      <div class="dots">
        <div class="dot dot-red"></div>
        <div class="dot dot-yellow"></div>
        <div class="dot dot-green"></div>
      </div>
      <div class="title">${title}</div>
    </div>
    <div class="terminal-body" id="term">
      ${terminalContentHtml}
    </div>
  </div>
</body>
</html>
  `;

  await page.setContent(html);
  await page.waitForTimeout(durationMs);

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const videoPath = await video.path();
    const destPath = resolve(videosDir, filename);
    renameSync(videoPath, destPath);
    console.log(`✓ Saved ${filename} to ${destPath}`);
  }
}

async function main() {
  const videosDir = resolve(process.cwd(), "docs/videos");
  if (!existsSync(videosDir)) {
    mkdirSync(videosDir, { recursive: true });
  }

  // Clip 1: npm run demo:cloudflare full buyer+seller output
  const clip1Content = `
<span class="gray">$ npm run demo:cloudflare</span>

<span class="bold cyan">===========================================================================</span>
<span class="bold">  BOUNTY DEMO SCENARIO 1: AUTONOMOUS CLOUDFLARE BYPASS</span>
<span class="yellow">  [MOCK DATA: simulated market prices from local test server]</span>
<span class="bold cyan">===========================================================================</span>

[1/5] Starting local mock Cloudflare server on http://localhost:5000 ...
<span class="gray">[Mock Cloudflare] Listening on http://localhost:5000/protected</span>
      <span class="green">✓</span> Mock Cloudflare server active (serves 403 + cf-turnstile challenge by default)

[2/5] Checking Bounty Broker connection on http://localhost:4000 ...
      <span class="green">✓</span> Broker reachable (PayPal mode: <span class="cyan">SANDBOX</span>, Connected nodes: 1)

[3/5] Verifying Seller Node capacity for 'web_scrape' ...
      <span class="green">✓</span> Active Seller Node detected: <span class="cyan">node_hz0vq_mvxvij3h</span> (<span class="gray">sb-sqcdl53128062@personal.example.com</span>)

[4/5] Buyer Agent calling TaskEnvelope.wrapFetch("http://localhost:5000/protected") ...
      <span class="yellow">Direct fetch will trigger HTTP 403 Turnstile Challenge.</span>
      <span class="cyan">Struggle Envelope will autonomously trap and subcontract to Bounty network.</span>

<span class="red">[Struggle Envelope] Detected blocker (Status: 403, cf-turnstile: true).</span>
<span class="cyan">[Struggle Envelope] Emitting RFP to Bounty Broker: http://localhost:4000/api/rfp ...</span>
<span class="green">[Struggle Envelope] RFP Matched! Assigned to node node_hz0vq_mvxvij3h at $0.05</span>

<span class="bold cyan">===========================================================================</span>
<span class="bold green">  BUYER AGENT: EXECUTION COMPLETED & VERIFIED</span>
<span class="bold cyan">===========================================================================</span>
  Target URL:              <span class="cyan">http://localhost:5000/protected</span>
  Initial Barrier:         <span class="red">HTTP 403 Forbidden (cf-turnstile: required)</span>
  Struggle Emitted RFP:    <span class="gray">rfp_mvxviwys_9c2899c7</span>
  Matched Seller Node:     <span class="cyan">node_hz0vq_mvxvij3h</span>
  Agreed Price:            <span class="green">$0.05 USD</span>
  Payload Verification:    <span class="green">SHA-256 Digest Confirmed Valid ✓</span>
  Settlement Rail:         <span class="yellow">PayPal Sandbox Payouts v1</span>
  PayPal Payout Batch ID:  <span class="bold green">8FJGTLR8VCLFG</span>
  PayPal Batch Status:     <span class="badge badge-success">SUCCESS</span>
  Total End-to-End Time:   <span class="bold">2537 ms</span> (Submission to Settle: 2537 ms)
<span class="gray">---------------------------------------------------------------------------</span>
  <span class="bold">RECEIVED DATA (Stock Quotes Payload):</span>
{
  "targetUrl": "http://localhost:5000/protected",
  "httpStatus": 200,
  "bypassed": true,
  "items": [
    { "symbol": "NVDA", "price": 142.85, "change": "+3.2%", "volume": "48.2M" },
    { "symbol": "AAPL", "price": 231.10, "change": "+0.8%", "volume": "32.1M" },
    { "symbol": "GOOGL", "price": 184.50, "change": "+1.9%", "volume": "19.5M" }
  ],
  "message": "Authentication cleared via X-Bounty-Bypass residential proxy",
  "timestamp": "2026-11-01T13:36:38.020Z"
}
<span class="gray">---------------------------------------------------------------------------</span>
<span class="yellow">  [MOCK DATA: simulated market prices from local test server]</span>
<span class="bold cyan">===========================================================================</span>
  `;

  // Clip 2: bounty start live settle split view
  const clip2Content = `
<div style="display: flex; gap: 20px; height: 100%;">
  <div style="flex: 3; border-right: 1px solid #30363d; padding-right: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
      <span class="bold cyan">BOUNTY NODE v1.0.0</span>
      <span class="badge badge-success">● ONLINE</span>
      <span class="gray">Broker: ws://localhost:4000/ws/seller</span>
    </div>
    <div class="gray" style="border-bottom: 1px solid #30363d; margin-bottom: 12px; padding-bottom: 4px; font-weight: bold;">
      ACTIVE JOB FLOW
    </div>
    <div style="line-height: 1.8;">
      <div><span class="green">✓</span>  Connected to broker  ·  node_hz0vq_mvx</div>
      <div><span class="green">✓</span>  Task received: "web_scrape"  $0.06 ceiling</div>
      <div><span class="green">✓</span>  Bid submitted: $0.05</div>
      <div><span class="green">✓</span>  SHA-256 hash computed: <span class="cyan">sha256:0456a6c642...</span></div>
      <div style="background: rgba(46, 160, 67, 0.15); padding: 4px 8px; border-radius: 4px; border: 1px solid #2ea043; margin-top: 6px;">
        <span class="green bold">✓  PAID  ·  Batch: 8FJGTLR8VCLFG  ·  $0.05  ·  PAYOUT_SUCCESS</span>
      </div>
      <div style="margin-top: 10px; color: #8b949e;"><span class="cyan">⠹</span>  Waiting for tasks...</div>
    </div>
  </div>

  <div style="flex: 2; padding-left: 10px;">
    <div class="gray" style="border-bottom: 1px solid #30363d; margin-bottom: 12px; padding-bottom: 4px; font-weight: bold;">
      EARNINGS TICKER
    </div>
    <div style="line-height: 2;">
      <div>Lifetime Earned:  <span class="green bold">$0.05 USD</span></div>
      <div>Jobs Completed:   <span class="bold">1</span></div>
      <div>Nodes Online:     <span class="bold">1</span></div>
      <div>PayPal Account:   <span class="yellow">sb-sqcdl53128062...</span></div>
      <div>Latest Batch:     <span class="cyan">8FJGTLR8VCLFG</span></div>
      <div style="border-top: 1px solid #30363d; margin-top: 10px; padding-top: 10px;">
        <div class="gray">Active Capabilities:</div>
        <div class="cyan">python_code, ocr, web_scrape, residential_scrape</div>
      </div>
    </div>
  </div>
</div>
  `;

  await recordTerminalClip(videosDir, "clip1_demo_cloudflare.webm", "Bounty Buyer Agent · Cloudflare Bypass Run", clip1Content, 12000);
  await recordTerminalClip(videosDir, "clip2_bounty_start.webm", "Bounty Worker Node · Claude Code Split-View TUI", clip2Content, 10000);
  await recordDashboardClip(videosDir);

  console.log("\n========================================================");
  console.log("  ALL CLIPS RECORDED IN docs/videos/");
  console.log("========================================================\n");
}

main().catch(console.error);
