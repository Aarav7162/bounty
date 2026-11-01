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

async function main() {
  console.log("========================================================");
  console.log("  RECORDING IMMERSIVE 3D SAAS MOTION VIDEO (PLAYWRIGHT)");
  console.log("========================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization"
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videosDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  const htmlPath = resolve(process.cwd(), "scripts/immersive-saas-presentation.html");

  console.log(`Loading immersive 3D scene from: ${htmlPath}`);
  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`);

  console.log("Triggering 3D camera zoom/pan timeline (runtime: 150s / 2m 30s)...");
  await page.evaluate(async () => {
    await (window as any).runTimeline();
  });

  await context.close();
  await browser.close();

  const recordedFiles = fs.readdirSync(videosDir).filter(f => f.endsWith(".webm") && !f.includes("launch"));
  const latestWebm = recordedFiles[recordedFiles.length - 1];
  console.log(`✓ Raw WebM recorded: ${latestWebm}`);

  const rawWebmPath = resolve(videosDir, latestWebm);
  const master = resolve(videosDir, "bounty_side_by_side_saas_launch_2m30s.mp4");

  console.log("Encoding 60fps high-quality H.264 Master 2m 30s Video...");
  await runFfmpeg([
    "-y",
    "-i", rawWebmPath,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", "16",
    "-t", "150",
    master
  ]);

  console.log(`\n========================================================`);
  console.log(`✓ IMMERSIVE SAAS LAUNCH VIDEO READY (2m 30s):`);
  console.log(`  ${master}`);
  console.log(`========================================================\n`);
}

main().catch(console.error);

