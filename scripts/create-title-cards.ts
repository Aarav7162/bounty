import { chromium } from "playwright";
import { resolve } from "node:path";
import { execFile } from "node:child_process";

const FFMPEG_BIN = `${process.env.APPDATA}\\npm\\ffmpeg.exe`;

async function renderCard(filename: string, htmlContent: string, durationSec: number) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: "docs/videos",
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  await page.setContent(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #080b10;
      color: #f0f6fc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      width: 1280px;
      height: 720px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .bg-radial {
      position: absolute;
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, rgba(0, 112, 186, 0.22) 0%, rgba(8, 11, 16, 0) 70%);
      pointer-events: none;
    }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(0, 112, 186, 0.25);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.4);
      margin-bottom: 20px;
    }
    h1 {
      font-size: 68px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #ffffff;
      margin-bottom: 14px;
    }
    p.sub {
      font-size: 26px;
      color: #38bdf8;
      font-weight: 600;
      max-width: 800px;
      line-height: 1.4;
    }
    p.meta {
      font-size: 15px;
      color: #8b949e;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="bg-radial"></div>
  ${htmlContent}
</body>
</html>
  `);

  await page.waitForTimeout(durationSec * 1000 + 500);

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawPath = await video.path();
    const webmDest = resolve(process.cwd(), `docs/videos/${filename}.webm`);
    const mp4Dest = resolve(process.cwd(), `docs/videos/${filename}.mp4`);

    await new Promise<void>((r, rej) => {
      execFile(FFMPEG_BIN, [
        "-y", "-i", rawPath,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "18",
        "-t", String(durationSec),
        mp4Dest
      ], (err) => err ? rej(err) : r());
    });
    console.log(`✓ Rendered ${mp4Dest} (${durationSec}s)`);
  }
}

async function main() {
  // 8-second Intro Card
  await renderCard("intro_card_8s", `
    <div class="badge">✦ PayPal AI Hackathon 2026 · Agentic Commerce</div>
    <h1>Bounty</h1>
    <p class="sub">Autonomous Agent-to-Agent Commerce via PayPal</p>
    <p class="meta">Machine-to-Machine Subcontracting & Real-Time Liquidity Network</p>
  `, 8);

  // 7-second Outro Card
  await renderCard("outro_card_7s", `
    <div class="badge">✦ Submission Complete</div>
    <h1 style="font-size: 52px;">Built for PayPal AI Hackathon 2026</h1>
    <p class="sub" style="font-size: 28px; color: #38bdf8; font-weight: 700; margin-top: 10px;">
      github.com/Aarav7162/bounty
    </p>
    <p class="meta">October 29 – November 2, 2026 · MIT Licensed</p>
  `, 7);
}

main().catch(console.error);

