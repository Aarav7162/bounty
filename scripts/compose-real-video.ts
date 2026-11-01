import { execFile } from "node:child_process";
import { resolve } from "node:path";

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
  console.log("Composing 2:25 Master Video from REAL CLI & REAL DASHBOARD footage...");

  // 1. Loop clip1 to 45s
  const clip1Extended = resolve(videosDir, "clip1_45s.mp4");
  await runFfmpeg([
    "-y", "-stream_loop", "3",
    "-i", resolve(videosDir, "clip1_demo_cloudflare.mp4"),
    "-c", "copy",
    "-t", "45",
    clip1Extended
  ]);
  console.log("✓ Prepared 45s Buyer CLI real footage");

  // 2. Loop clip2 to 40s
  const clip2Extended = resolve(videosDir, "clip2_40s.mp4");
  await runFfmpeg([
    "-y", "-stream_loop", "3",
    "-i", resolve(videosDir, "clip2_bounty_start.mp4"),
    "-c", "copy",
    "-t", "40",
    clip2Extended
  ]);
  console.log("✓ Prepared 40s Seller CLI real footage");

  // 3. Loop clip3 (real AG Grid dashboard) to 45s
  const clip3Extended = resolve(videosDir, "clip3_45s.mp4");
  await runFfmpeg([
    "-y", "-stream_loop", "1",
    "-i", resolve(videosDir, "clip3_dashboard_streaming.mp4"),
    "-c", "copy",
    "-t", "45",
    clip3Extended
  ]);
  console.log("✓ Prepared 45s AG Grid real dashboard footage");

  // 4. Concatenate: Intro (8s) + Buyer (45s) + Seller (40s) + Dashboard (45s) + Outro (7s)
  const concatList = resolve(videosDir, "concat_list.txt");
  const fs = await import("node:fs");
  const listContent = [
    `file '${resolve(videosDir, "intro_card_8s.mp4").replace(/\\/g, "/")}'`,
    `file '${clip1Extended.replace(/\\/g, "/")}'`,
    `file '${clip2Extended.replace(/\\/g, "/")}'`,
    `file '${clip3Extended.replace(/\\/g, "/")}'`,
    `file '${resolve(videosDir, "outro_card_7s.mp4").replace(/\\/g, "/")}'`
  ].join("\n");

  fs.writeFileSync(concatList, listContent, "utf8");

  const masterMp4 = resolve(videosDir, "bounty_real_footage_2m25s.mp4");
  await runFfmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatList,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "fast",
    "-crf", "18",
    masterMp4
  ]);

  console.log(`\n========================================================`);
  console.log(`✓ MASTER REAL-FOOTAGE VIDEO BUILT: ${masterMp4}`);
  console.log(`========================================================\n`);
}

main().catch(console.error);

