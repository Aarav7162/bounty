import readline from "node:readline";
import chalk from "chalk";
import { spawn } from "node:child_process";
import { getActiveProfile } from "../profile.js";
import { runStartCommand } from "./start.js";
import { runBuyScrapeCommand, runBuyOcrCommand, runBuyWizard } from "./buy.js";
import { runLedgerCommand } from "./ledger.js";
import { runNodesCommand } from "./nodes.js";
import { displayProfileCard, handleProfileSet } from "./profile.js";
import { fitString } from "../ui/layout.js";

export function printHelp(): void {
  console.log("");
  console.log(chalk.white.bold("  Bounty Commands:"));
  console.log(chalk.gray("  " + "─".repeat(64)));
  console.log(`  ${chalk.cyan(fitString("buy scrape <url>", 24))} ${chalk.gray("Delegate web scraping with anti-bot bypass")}`);
  console.log(`  ${chalk.cyan(fitString("buy ocr <file>", 24))} ${chalk.gray("Delegate OCR extraction on image bytes")}`);
  console.log(`  ${chalk.cyan(fitString("buy", 24))} ${chalk.gray("Interactive buyer task wizard")}`);
  console.log(`  ${chalk.cyan(fitString("sell", 24))} ${chalk.gray("Start seller daemon to claim tasks & earn PayPal payouts")}`);
  console.log(`  ${chalk.cyan(fitString("ledger", 24))} ${chalk.gray("Query live settlement ledger & PayPal batch receipts")}`);
  console.log(`  ${chalk.cyan(fitString("nodes", 24))} ${chalk.gray("Inspect active seller nodes in the orderbook")}`);
  console.log(`  ${chalk.cyan(fitString("profile", 24))} ${chalk.gray("View operator profile, balance, and floor prices")}`);
  console.log(`  ${chalk.cyan(fitString("profile set <k> <v>", 24))} ${chalk.gray("Update pricing or PayPal configuration")}`);
  console.log(`  ${chalk.cyan(fitString("server", 24))} ${chalk.gray("Launch Broker Hub (port 4000) & AG Grid Dashboard")}`);
  console.log(`  ${chalk.cyan(fitString("video", 24))} ${chalk.gray("Play official 2m 30s SaaS launch video")}`);
  console.log(`  ${chalk.cyan(fitString("clear", 24))} ${chalk.gray("Clear terminal screen")}`);
  console.log(`  ${chalk.cyan(fitString("exit", 24))} ${chalk.gray("Exit Bounty CLI")}`);
  console.log(chalk.gray("  " + "─".repeat(64)));
  console.log("");
}

export async function runInteractiveShell(): Promise<void> {
  const { profile } = getActiveProfile();

  console.log("");
  console.log(chalk.white.bold("  Bounty") + chalk.gray(" · Autonomous Agent Subcontracting Protocol (v1.0.0)"));
  console.log(chalk.gray(`  Profile: ${profile.name} (${profile.email})`));
  console.log(chalk.gray("  Type ") + chalk.cyan("help") + chalk.gray(" to view commands, or ") + chalk.cyan("exit") + chalk.gray(" to quit."));
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY ?? false,
    prompt: chalk.cyan("bounty > ")
  });

  rl.prompt();

  rl.on("line", async (lineStr) => {
    const trimmed = lineStr.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case "help":
        case "?":
        case "commands":
          printHelp();
          break;

        case "clear":
        case "cls":
          console.clear();
          break;

        case "sell":
        case "start":
        case "worker":
          rl.close();
          await runStartCommand({});
          return;

        case "buy":
          if (!args.length) {
            await runBuyWizard();
          } else if (args[0] === "scrape") {
            const url = args[1] || "http://localhost:5000/protected";
            const bypass = args.includes("--bypass") ? args[args.indexOf("--bypass") + 1] : "cloudflare_turnstile";
            await runBuyScrapeCommand(url, { bypass });
          } else if (args[0] === "ocr") {
            const target = args[1];
            if (!target) {
              console.log(chalk.red("  Usage: buy ocr <path-to-image>"));
            } else {
              await runBuyOcrCommand(target, {});
            }
          } else {
            console.log(chalk.red(`  Unknown capability: ${args[0]}. Supported: scrape, ocr`));
          }
          break;

        case "ledger":
          await runLedgerCommand({});
          break;

        case "nodes":
          await runNodesCommand({});
          break;

        case "profile":
          if (args[0] === "set" && args.length >= 3) {
            handleProfileSet(args[1], args[2]);
          } else {
            displayProfileCard();
          }
          break;

        case "server":
        case "broker": {
          const projectDir = "c:/Users/aarav.SOMEGUYWITHPRET/Bounty";
          console.log(chalk.cyan("  Launching Broker Hub (port 4000) & AG Grid Dashboard (port 5173)..."));
          const isWin = process.platform === "win32";
          spawn(isWin ? "npm.cmd" : "npm", ["run", "start"], {
            cwd: projectDir,
            stdio: "inherit",
            shell: true,
            env: process.env
          });
          break;
        }

        case "video":
        case "watch": {
          const videoPath = "c:\\Users\\aarav.SOMEGUYWITHPRET\\Bounty\\docs\\videos\\bounty_side_by_side_saas_launch_2m30s.mp4";
          console.log(chalk.cyan("  Launching official Bounty 2m 30s SaaS launch video..."));
          const isWin = process.platform === "win32";
          if (isWin) {
            spawn("cmd.exe", ["/c", "start", "", videoPath], { detached: true, stdio: "ignore" }).unref();
          } else {
            spawn("open", [videoPath], { detached: true, stdio: "ignore" }).unref();
          }
          break;
        }

        case "exit":
        case "quit":
        case "q":
          rl.close();
          process.exit(0);
          return;

        default:
          console.log(chalk.yellow(`  Unknown command: "${trimmed}". Type `) + chalk.cyan("help") + chalk.yellow(" for available commands."));
          break;
      }
    } catch (err: any) {
      console.error(chalk.red(`  Error: ${err.message}`));
    }

    console.log("");
    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
