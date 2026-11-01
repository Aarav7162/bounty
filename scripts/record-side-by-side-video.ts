import { chromium } from "playwright";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import fs from "node:fs";

const FFMPEG_BIN = `${process.env.APPDATA}\\npm\\ffmpeg.exe`;
const videosDir = resolve(process.cwd(), "docs/videos");

async function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    execFile(FFMPEG_BIN, args, (err, stdout, stderr) => {
      if (err) {
        console.error(stderr);
        return rej(err);
      }
      res();
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Starting Playwright side-by-side dual terminal recording session...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videosDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  // 1. Prepare Side-by-Side Dual Terminal HTML
  const sideBySideHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #06090e;
      color: #e6edf3;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      width: 1280px;
      height: 720px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .top-bar {
      height: 38px;
      background: #0d1117;
      border-bottom: 1px solid #21262d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-size: 12px;
      color: #8b949e;
    }
    .top-bar .title {
      color: #58a6ff;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .split-container {
      display: flex;
      flex: 1;
      width: 1280px;
      height: 682px;
      gap: 2px;
      background: #161b22;
    }
    .terminal-pane {
      flex: 1;
      background: #090d16;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .pane-header {
      height: 32px;
      background: #0d131f;
      border-bottom: 1px solid #1f2937;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 11px;
      color: #94a3b8;
    }
    .traffic-lights {
      display: flex;
      gap: 6px;
      margin-right: 12px;
    }
    .dot { width: 10px; height: 10px; rounded-circle; border-radius: 50%; }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #eab308; }
    .dot-green { background: #22c55e; }
    .pane-content {
      flex: 1;
      padding: 14px;
      font-size: 11px;
      line-height: 1.45;
      overflow: hidden;
    }
    .prompt { color: #38bdf8; font-weight: bold; }
    .cmd { color: #f8fafc; font-weight: 600; }
    .cyan { color: #38bdf8; }
    .green { color: #4ade80; }
    .yellow { color: #facc15; }
    .magenta { color: #c084fc; }
    .gray { color: #64748b; }
    .white { color: #f8fafc; font-weight: bold; }
    .step-box {
      border: 1px solid #0284c7;
      background: rgba(14, 165, 233, 0.05);
      border-radius: 6px;
      padding: 10px;
      margin: 10px 0;
    }
    .step-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .seller-tui-box {
      border: 1px solid #334155;
      border-radius: 6px;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #090d16;
    }
    .seller-tui-header {
      padding: 8px 12px;
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    .seller-tui-body {
      flex: 1;
      display: flex;
    }
    .seller-col-left {
      flex: 1.4;
      border-right: 1px solid #334155;
      padding: 10px;
    }
    .seller-col-right {
      flex: 1;
      padding: 10px;
      background: rgba(15, 23, 42, 0.4);
    }
    .seller-tui-footer {
      padding: 6px 12px;
      border-top: 1px solid #334155;
      font-size: 10px;
      color: #64748b;
    }
    .fade-step {
      opacity: 0;
      transform: translateY(4px);
      transition: all 0.4s ease;
    }
    .fade-step.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .pulse { animation: pulseAnim 1.5s infinite; }
    @keyframes pulseAnim {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="title">⚡ BOUNTY MULTI-AGENT MESH · SIDE-BY-SIDE CONCURRENT DELEGATION</div>
    <div>AUTONOMOUS LIQUIDITY OVER PAYPAL SANDBOX RAILS</div>
  </div>

  <div class="split-container">
    <!-- LEFT PANE: BUYER AGENT -->
    <div class="terminal-pane">
      <div class="pane-header">
        <div class="traffic-lights">
          <div class="dot dot-red"></div>
          <div class="dot dot-yellow"></div>
          <div class="dot dot-green"></div>
        </div>
        <span>Bounty Buyer Agent [Left] · PowerShell</span>
      </div>
      <div class="pane-content" id="buyer-content">
        <div><span class="prompt">PS C:\\Users\\aarav&gt;</span> <span class="cmd" id="buyer-cmd"></span><span id="cursor">█</span></div>
        
        <div id="buyer-box" class="step-box fade-step" style="display: none;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 8px;">
            ╭── BOUNTY BUYER DELEGATION · RFP: rfp_mvxyfeai_de226282
          </div>
          <div class="step-row fade-step" id="b-step-1">
            <span class="green">✔</span> 1. Roadblock Trapped &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span class="yellow">[HTTP 403 · cf-turnstile: required]</span>
          </div>
          <div class="step-row fade-step" id="b-step-2">
            <span class="green">✔</span> 2. RFP Broadcasted &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span class="gray">[Cap: web_scrape · Ceiling: $0.06]</span>
          </div>
          <div class="step-row fade-step" id="b-step-3">
            <span class="green">✔</span> 3. Orderbook Matched &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span class="cyan">[Node: node_mumbai_01 · Price: $0.05]</span>
          </div>
          <div class="step-row fade-step" id="b-step-4">
            <span class="green">✔</span> 4. Execution Sandbox &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span class="gray">[517 bytes · SHA-256 Verified]</span>
          </div>
          <div class="step-row fade-step" id="b-step-5">
            <span class="green">✔</span> 5. PayPal Settlement &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span class="yellow">[Batch: VH7GM2N22RB9G]</span> · <span class="green">SUCCESS</span>
          </div>
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #0369a1; font-size: 10px; color: #94a3b8;">
            Duration: 2.63s &nbsp;·&nbsp; Settlement: $0.05 USD &nbsp;·&nbsp; Rails: PayPal Sandbox
          </div>
        </div>

        <div id="buyer-result" class="fade-step" style="display: none; margin-top: 10px;">
          <div class="gray">[MOCK DATA: simulated market prices from local test server]</div>
          <pre style="color: #cbd5e1; font-size: 10px; margin-top: 4px;">
{
  "targetUrl": "http://localhost:5000/protected",
  "httpStatus": 200,
  "bypassed": true,
  "items": [
    { "symbol": "NVDA", "price": 142.85, "change": "+3.2%" },
    { "symbol": "AAPL", "price": 231.10, "change": "+0.8%" },
    { "symbol": "GOOGL", "price": 184.50, "change": "+1.9%" }
  ],
  "message": "Authentication cleared via X-Bounty-Bypass"
}
          </pre>
        </div>

        <!-- Follow up command: bounty ledger -->
        <div id="ledger-section" class="fade-step" style="display: none; margin-top: 12px;">
          <div><span class="prompt">PS C:\\Users\\aarav&gt;</span> <span class="cmd">bounty ledger</span></div>
          <pre style="color: #38bdf8; font-size: 9.5px; margin-top: 4px;">
  ╭────────────────────────────────────────────────────────────────────────╮
  │  BOUNTY SETTLEMENT LEDGER (Live PayPal Settlement Records)             │
  ├──────────┬──────────────────┬─────────────┬─────────────────┬──────────┤
  │ TIME     │ RFP ID           │ AMOUNT (USD)│ PAYPAL BATCH ID │ STATUS   │
  ├──────────┼──────────────────┼─────────────┼─────────────────┼──────────┤
  │ 20:27:54 │ rfp_mvxyfeai_d.. │ $0.05       │ VH7GM2N22RB9G   │ SETTLED  │
  │ 20:27:08 │ rfp_mvxye5k7_1.. │ $0.05       │ 75AWDKKVK6XF6   │ SETTLED  │
  ├──────────┴──────────────────┴─────────────┴─────────────────┴──────────┤
  │ Total Volume: $0.10 USD · Transactions: 2 · Rails: PayPal Sandbox     │
  ╰────────────────────────────────────────────────────────────────────────╯
          </pre>
        </div>
      </div>
    </div>

    <!-- RIGHT PANE: SELLER WORKER -->
    <div class="terminal-pane">
      <div class="pane-header">
        <div class="traffic-lights">
          <div class="dot dot-red"></div>
          <div class="dot dot-yellow"></div>
          <div class="dot dot-green"></div>
        </div>
        <span>Bounty Seller Node [Right] · PowerShell</span>
      </div>
      <div class="pane-content" style="padding: 10px;">
        <div class="seller-tui-box">
          <div class="seller-tui-header">
            <div><span class="white">BOUNTY NODE</span> <span class="gray">v1.0.0</span></div>
            <div><span class="green">● ONLINE</span></div>
            <div class="gray">Broker: ws://localhost:4000/ws/seller</div>
          </div>
          <div class="seller-tui-body">
            <div class="seller-col-left">
              <div class="gray" style="margin-bottom: 6px; font-weight: bold;">ACTIVE JOB FLOW</div>
              <div id="s-event-1" class="fade-step visible" style="margin-bottom: 4px;">
                <span class="green">✓</span> Connected to broker · <span class="cyan">node_mumbai_01</span>
              </div>
              <div id="s-event-wait" class="fade-step visible pulse" style="color: #94a3b8; margin-bottom: 4px;">
                ⠋ Waiting for tasks...
              </div>
              <div id="s-event-2" class="fade-step" style="display: none; margin-bottom: 4px;">
                <span class="green">✓</span> Task received: <span class="yellow">"web_scrape"</span> $0.06 ceiling
              </div>
              <div id="s-event-3" class="fade-step" style="display: none; margin-bottom: 4px;">
                <span class="green">✓</span> Bid submitted: <span class="green">$0.05</span>
              </div>
              <div id="s-event-4" class="fade-step" style="display: none; margin-bottom: 4px;">
                <span class="green">✓</span> SHA-256 hash computed: <span class="gray">sha256:375219d...</span>
              </div>
              <div id="s-event-5" class="fade-step" style="display: none; margin-bottom: 4px;">
                <span class="green" style="font-weight: bold;">✓ PAID · Batch: VH7GM2N22RB9G · $0.05 · SUCCESS</span>
              </div>
            </div>

            <div class="seller-col-right">
              <div class="gray" style="margin-bottom: 6px; font-weight: bold;">EARNINGS TICKER</div>
              <div style="margin-bottom: 4px;">Lifetime Earned: <span class="green" id="seller-earned" style="font-weight: bold;">$0.05 USD</span></div>
              <div style="margin-bottom: 4px;">Jobs Completed: &nbsp;<span class="white" id="seller-jobs">1</span></div>
              <div style="margin-bottom: 4px;">Nodes Online: &nbsp;&nbsp;&nbsp;<span class="cyan">1</span></div>
              <div style="margin-bottom: 8px;">PayPal Account: &nbsp;<span class="yellow" style="font-size: 9px;">sb-sq***@personal</span></div>
              <div style="border-top: 1px solid #334155; padding-top: 6px; font-size: 10px;">
                <div class="gray" style="margin-bottom: 4px;">Capabilities:</div>
                <div class="cyan">● python_code ($0.25)</div>
                <div class="cyan">● ocr ($0.20)</div>
                <div class="cyan">● web_scrape ($0.05)</div>
              </div>
            </div>
          </div>
          <div class="seller-tui-footer">
            Keystrokes: [p] pause/resume · [c] capabilities · [q] quit
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  await page.setContent(sideBySideHtml);

  // Playwright Orchestrated Real-Time Timeline with 2-second Pacing
  console.log("Scene 1: Running Buyer & Seller side-by-side execution with 2s step pacing...");
  await sleep(2000);

  // 1. Simulate Buyer typing command
  const commandText = "bounty buy scrape http://localhost:5000/protected --bypass cloudflare_turnstile --pause 2";
  for (let i = 1; i <= commandText.length; i++) {
    await page.evaluate((text) => {
      document.getElementById("buyer-cmd")!.textContent = text;
    }, commandText.slice(0, i));
    await sleep(25);
  }
  await sleep(1000);

  // 2. Buyer hits Enter -> Step 1 (Roadblock trapped)
  await page.evaluate(() => {
    document.getElementById("cursor")!.style.display = "none";
    const box = document.getElementById("buyer-box")!;
    box.style.display = "block";
    box.classList.add("visible");
    document.getElementById("b-step-1")!.classList.add("visible");
  });
  await sleep(2000); // 2s pause

  // 3. Step 2 (RFP Broadcasted)
  await page.evaluate(() => {
    document.getElementById("b-step-2")!.classList.add("visible");
  });
  await sleep(2000); // 2s pause

  // 4. Seller Node receives task!
  await page.evaluate(() => {
    document.getElementById("s-event-wait")!.style.display = "none";
    const e2 = document.getElementById("s-event-2")!;
    e2.style.display = "block";
    e2.classList.add("visible");
    const e3 = document.getElementById("s-event-3")!;
    e3.style.display = "block";
    e3.classList.add("visible");
    document.getElementById("b-step-3")!.classList.add("visible");
  });
  await sleep(2000); // 2s pause

  // 5. Seller executes sandbox & computes SHA-256
  await page.evaluate(() => {
    const e4 = document.getElementById("s-event-4")!;
    e4.style.display = "block";
    e4.classList.add("visible");
    document.getElementById("b-step-4")!.classList.add("visible");
  });
  await sleep(2000); // 2s pause

  // 6. PayPal Settlement settles & balances update!
  await page.evaluate(() => {
    const e5 = document.getElementById("s-event-5")!;
    e5.style.display = "block";
    e5.classList.add("visible");
    document.getElementById("b-step-5")!.classList.add("visible");
    document.getElementById("seller-earned")!.textContent = "$0.10 USD";
    document.getElementById("seller-jobs")!.textContent = "2";
    const res = document.getElementById("buyer-result")!;
    res.style.display = "block";
    res.classList.add("visible");
  });
  await sleep(4000);

  // 7. Follow up: Show bounty ledger query
  await page.evaluate(() => {
    const ledger = document.getElementById("ledger-section")!;
    ledger.style.display = "block";
    ledger.classList.add("visible");
  });
  await sleep(8000);

  // Scene 2: Navigate to live AG Grid Telemetry Dashboard!
  console.log("Scene 2: Transitioning to live AG Grid Telemetry Dashboard at http://localhost:5173...");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await sleep(3000);

  // Smooth scroll and hover interactions across AG Grid
  console.log("Scene 3: Demonstrating AG Grid Community features in motion...");
  await page.mouse.move(300, 250);
  await sleep(3000);

  // Filter transactions
  await page.fill("#filter-text-box", "web_scrape");
  await sleep(4000);
  await page.fill("#filter-text-box", "");
  await sleep(3000);

  // Hover over Financial Column Group
  await page.mouse.move(750, 320);
  await sleep(3000);

  // Hover over capability mesh
  await page.mouse.move(400, 160);
  await sleep(4000);

  // Final hold
  await sleep(5000);

  await context.close();
  await browser.close();

  const recordedFiles = fs.readdirSync(videosDir).filter(f => f.endsWith(".webm") && !f.includes("launch"));
  const latestWebm = recordedFiles[recordedFiles.length - 1];
  console.log(`✓ Raw Walkthrough recorded: ${latestWebm}`);

  const rawWebmPath = resolve(videosDir, latestWebm);
  const rawMp4Path = resolve(videosDir, "side_by_side_walkthrough.mp4");

  // Convert raw walkthrough to MP4
  console.log("Converting walkthrough to H.264 MP4...");
  await runFfmpeg([
    "-y",
    "-i", rawWebmPath,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "fast",
    "-crf", "18",
    rawMp4Path
  ]);

  // Concatenate: Intro Card (8s) + Walkthrough (~60-70s) + Dashboard (looped to target 2:30) + Outro Card (7s)
  const masterMp4 = resolve(videosDir, "bounty_side_by_side_saas_launch_2m30s.mp4");
  const concatList = resolve(videosDir, "concat_launch_list.txt");

  // Let's create an extended walkthrough or pad with intro and outro
  const listContent = [
    `file '${resolve(videosDir, "intro_card_8s.mp4").replace(/\\/g, "/")}'`,
    `file '${rawMp4Path.replace(/\\/g, "/")}'`,
    `file '${resolve(videosDir, "clip3_dashboard_streaming.mp4").replace(/\\/g, "/")}'`,
    `file '${resolve(videosDir, "outro_card_7s.mp4").replace(/\\/g, "/")}'`
  ].join("\n");

  fs.writeFileSync(concatList, listContent, "utf8");

  console.log("Concatenating into Master 2m 30s SaaS Launch Video...");
  await runFfmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatList,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "fast",
    "-crf", "18",
    "-t", "150", // Exactly 2:30
    masterMp4
  ]);

  console.log(`\n========================================================`);
  console.log(`✓ MASTER 2:30 SIDE-BY-SIDE VIDEO READY:`);
  console.log(`  ${masterMp4}`);
  console.log(`========================================================\n`);
}

main().catch(console.error);
