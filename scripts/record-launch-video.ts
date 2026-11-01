import { chromium } from "playwright";
import { resolve } from "node:path";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { execFile } from "node:child_process";

const FFMPEG_BIN = `${process.env.APPDATA}\\npm\\ffmpeg.exe`;

async function main() {
  console.log("========================================================");
  console.log("  RECORDING BOUNTY SAAS LAUNCH PRESENTATION (2:30)");
  console.log("  Resolution: 1280x720 · 60 FPS · Exact Duration: 150s");
  console.log("========================================================\n");

  const videosDir = resolve(process.cwd(), "docs/videos");
  if (!existsSync(videosDir)) {
    mkdirSync(videosDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videosDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  const htmlPath = resolve(process.cwd(), "scripts/saas-launch-presentation.html");
  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`);

  console.log("Recording live playback across all 6 scenes (150 seconds)...");
  // Total presentation runtime: 150,000 ms (2m 30s)
  await page.waitForTimeout(151000);

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawVideoPath = await video.path();
    const webmDest = resolve(videosDir, "bounty_saas_launch_demo.webm");
    const mp4Dest = resolve(videosDir, "bounty_saas_launch_demo.mp4");
    renameSync(rawVideoPath, webmDest);
    console.log(`✓ Saved WebM master to ${webmDest}`);

    console.log("Converting to high-profile H.264 MP4 via FFmpeg v7.1...");
    await new Promise<void>((res, rej) => {
      execFile(FFMPEG_BIN, [
        "-y",
        "-i", webmDest,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "19",
        "-movflags", "+faststart",
        mp4Dest
      ], (err, stdout, stderr) => {
        if (err) {
          console.error("FFmpeg conversion error:", err);
          return rej(err);
        }
        console.log(`✓ Saved MP4 master to ${mp4Dest}`);
        res();
      });
    });
  }

  console.log("\n========================================================");
  console.log("  SAAS LAUNCH VIDEO RECORDING COMPLETE");
  console.log("========================================================\n");
}

main().catch(console.error);

