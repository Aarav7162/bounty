#!/usr/bin/env node
import { Command } from "commander";
import dotenv from "dotenv";
import chalk from "chalk";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { runInitCommand } from "./commands/init.js";
import { runStartCommand } from "./commands/start.js";
import { displayProfileCard, handleProfileSet, runProfileWizard } from "./commands/profile.js";
import { runBuyScrapeCommand, runBuyOcrCommand, runBuyWizard } from "./commands/buy.js";
import { runLedgerCommand } from "./commands/ledger.js";
import { runNodesCommand } from "./commands/nodes.js";
import { runRootMenu } from "./commands/menu.js";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), "../../.env") });
dotenv.config({ path: resolve("c:/Users/aarav.SOMEGUYWITHPRET/Bounty/.env") });
dotenv.config();

const program = new Command();

program
  .name("bounty")
  .description("Bounty Seller Node CLI: Autonomous Agent Subcontracting & PayPal Micro-Settlements")
  .version("1.0.0");

program
  .command("video")
  .alias("watch")
  .description("Play the official Bounty 2m 30s SaaS launch video")
  .action(() => {
    const videoPath = "c:\\Users\\aarav.SOMEGUYWITHPRET\\Bounty\\docs\\videos\\bounty_side_by_side_saas_launch_2m30s.mp4";
    console.log(chalk.cyan("Launching official Bounty 2m 30s SaaS launch video..."));
    const isWin = process.platform === "win32";
    if (isWin) {
      spawn("cmd.exe", ["/c", "start", "", videoPath], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("open", [videoPath], { detached: true, stdio: "ignore" }).unref();
    }
  });

const buyCommand = program
  .command("buy [capability] [target]")
  .description("Delegate / subcontract an execution roadblock to the Bounty network (Buyer Mode)")
  .option("-b, --bypass <type>", "Required bypass mechanism (e.g. cloudflare_turnstile)")
  .option("-m, --max-bid <amount>", "Maximum bid ceiling in USD")
  .option("-t, --timeout <ms>", "Maximum wait timeout in ms")
  .option("-p, --pause <seconds>", "Pause seconds between steps for recording/legibility")
  .option("--json", "Output response payload as raw JSON")
  .option("--raw", "Output response payload as plain text")
  .option("-q, --quiet", "Suppress progress card and only output result")
  .action(async (capability, target, options) => {
    if (!capability) {
      await runBuyWizard();
      return;
    }

    if (capability === "scrape" || capability === "web_scrape") {
      if (!target) {
        console.error(chalk.red("Error: Missing target URL. Example: bounty buy scrape http://localhost:5000/protected"));
        process.exit(1);
      }
      await runBuyScrapeCommand(target, options);
    } else if (capability === "ocr") {
      if (!target) {
        console.error(chalk.red("Error: Missing image file path. Example: bounty buy ocr ./receipt.png"));
        process.exit(1);
      }
      await runBuyOcrCommand(target, options);
    } else {
      console.log(chalk.red(`Unknown capability: ${capability}. Supported: scrape, ocr`));
    }
  });

program
  .command("ledger")
  .description("Query the live settlement ledger and PayPal payout batch records")
  .option("-l, --limit <count>", "Maximum number of rows to return", "10")
  .option("-b, --broker <url>", "Broker API URL")
  .option("--json", "Output response as raw JSON")
  .action(async (options) => {
    await runLedgerCommand(options);
  });

program
  .command("nodes")
  .description("List active seller nodes in the orderbook with capabilities and floor prices")
  .option("-b, --broker <url>", "Broker API URL")
  .option("--json", "Output response as raw JSON")
  .action(async (options) => {
    await runNodesCommand(options);
  });

program
  .command("profile [action] [key] [val]")
  .description("View or manage operator profile, PayPal credentials, and capabilities (~/.bounty/profile.json)")
  .action(async (action, key, val) => {
    if (!action || action === "show" || action === "get") {
      displayProfileCard();
    } else if (action === "set") {
      if (!key || val === undefined) {
        console.error(chalk.red("Error: Missing key or value. Example: bounty profile set floor.web_scrape 0.08"));
        process.exit(1);
      }
      handleProfileSet(key, val);
    } else if (action === "init" || action === "wizard") {
      await runProfileWizard();
    } else {
      console.log(chalk.red(`Unknown profile action: ${action}. Use: show, set, or init`));
    }
  });

program
  .command("init")
  .description("Run the interactive configuration wizard for seller node setup")
  .option("-y, --yes", "Accept default configuration automatically without prompt")
  .option("-e, --email <email>", "PayPal recipient email")
  .action(async (options) => {
    await runInitCommand(options);
  });

program
  .command("server")
  .alias("broker")
  .description("Launch the Bounty Broker Hub and AG Grid Telemetry Dashboard")
  .action(() => {
    const projectDir = "c:/Users/aarav.SOMEGUYWITHPRET/Bounty";
    console.log(chalk.cyan("Launching Bounty Broker Hub (port 4000) & AG Grid Dashboard (port 5173)..."));
    const isWin = process.platform === "win32";
    const proc = spawn(isWin ? "npm.cmd" : "npm", ["run", "start"], {
      cwd: projectDir,
      stdio: "inherit",
      shell: true,
      env: process.env
    });
    proc.on("exit", (code) => process.exit(code || 0));
  });

program
  .command("sell")
  .alias("start")
  .alias("worker")
  .description("Start the seller worker daemon with live split-view TUI (Seller Mode)")
  .option("-c, --config <path>", "Path to custom bounty.config.json")
  .option("-b, --broker <url>", "WebSocket URL of the Bounty Broker Hub")
  .action(async (options) => {
    await runStartCommand(options);
  });

if (!process.argv.slice(2).length) {
  if (process.stdin.isTTY) {
    runRootMenu().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    runStartCommand({}).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
} else {
  program.parse(process.argv);
}

export * from "./config.js";
export * from "./ui/theme.js";
export * from "./ui/tui.js";
export * from "./worker/sandbox.js";

