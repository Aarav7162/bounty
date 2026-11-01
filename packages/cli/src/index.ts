#!/usr/bin/env node
import { Command } from "commander";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { runInitCommand } from "./commands/init.js";
import { runStartCommand } from "./commands/start.js";

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
  .command("init")
  .description("Run the interactive configuration wizard for seller node setup")
  .option("-y, --yes", "Accept default configuration automatically without prompt")
  .option("-e, --email <email>", "PayPal recipient email")
  .action(async (options) => {
    await runInitCommand(options);
  });

program
  .command("start", { isDefault: true })
  .description("Start the background seller worker daemon with live split-view TUI (default command)")
  .option("-c, --config <path>", "Path to custom bounty.config.json")
  .option("-b, --broker <url>", "WebSocket URL of the Bounty Broker Hub")
  .action(async (options) => {
    await runStartCommand(options);
  });

program.parse(process.argv);

export * from "./config.js";
export * from "./ui/theme.js";
export * from "./ui/tui.js";
export * from "./worker/sandbox.js";

