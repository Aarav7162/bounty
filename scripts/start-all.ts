import { spawn } from "node:child_process";

console.log("========================================================");
console.log("  STARTING BOUNTY BROKER HUB + AG GRID DASHBOARD");
console.log("========================================================\n");

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

// 1. Start Broker
const brokerProc = spawn("npx", ["tsx", "packages/broker/src/index.ts"], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

// 2. Start Dashboard
const dashProc = spawn(npmCmd, ["run", "dev", "--workspace=@bounty/dashboard"], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

const cleanup = () => {
  try { brokerProc.kill(); } catch {}
  try { dashProc.kill(); } catch {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

