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
  const intro = resolve(videosDir, "intro_card_8s.mp4");
  const walkthrough = resolve(videosDir, "side_by_side_walkthrough.mp4");
  const dash = resolve(videosDir, "clip3_dashboard_streaming.mp4");
  const outro = resolve(videosDir, "outro_card_7s.mp4");
  const master = resolve(videosDir, "bounty_side_by_side_saas_launch_2m30s.mp4");

  const concatList = resolve(videosDir, "concat_launch_list.txt");
  const list = [
    `file '${intro.replace(/\\/g, "/")}'`,
    `file '${walkthrough.replace(/\\/g, "/")}'`,
    `file '${dash.replace(/\\/g, "/")}'`,
    `file '${dash.replace(/\\/g, "/")}'`,
    `file '${dash.replace(/\\/g, "/")}'`,
    `file '${outro.replace(/\\/g, "/")}'`
  ].join("\n");

  fs.writeFileSync(concatList, list, "utf8");

  console.log("Assembling exact 2m 30s Master Video...");
  await runFfmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatList,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "fast",
    "-crf", "18",
    "-t", "150",
    master
  ]);

  console.log(`✓ Master 2m 30s video built: ${master}`);
}

main().catch(console.error);
