import readline from "node:readline";
import chalk from "chalk";
import { spawn } from "node:child_process";
import { getActiveProfile, isProfileConfigured } from "../profile.js";
import { runStartCommand } from "./start.js";
import { runBuyScrapeCommand, runBuyOcrCommand, runBuyWizard } from "./buy.js";
import { runDoCommand } from "./do.js";
import { runLedgerCommand } from "./ledger.js";
import { runNodesCommand } from "./nodes.js";
import { displayProfileCard, handleProfileSet, runProfileWizard } from "./profile.js";
import { fitString } from "../ui/layout.js";

export function printHelp(): void {
  console.log("");
  console.log(chalk.white.bold("  Bounty Commands:"));
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log(`  ${chalk.cyan(fitString("<any task description>", 26))} ${chalk.gray("Autonomous execution with 4-stage Struggle Envelope")}`);
  console.log(`  ${chalk.cyan(fitString("buy scrape <url>", 26))} ${chalk.gray("Direct buyer delegation with anti-bot bypass")}`);
  console.log(`  ${chalk.cyan(fitString("buy ocr <file>", 26))} ${chalk.gray("Direct OCR extraction on image bytes")}`);
  console.log(`  ${chalk.cyan(fitString("sell", 26))} ${chalk.gray("Start seller daemon to claim tasks & earn PayPal payouts")}`);
  console.log(`  ${chalk.cyan(fitString("ledger", 26))} ${chalk.gray("Query live settlement ledger & PayPal batch receipts")}`);
  console.log(`  ${chalk.cyan(fitString("nodes", 26))} ${chalk.gray("Inspect active seller nodes in the orderbook")}`);
  console.log(`  ${chalk.cyan(fitString("profile", 26))} ${chalk.gray("View operator profile, balance, and floor prices")}`);
  console.log(`  ${chalk.cyan(fitString("config / init", 26))} ${chalk.gray("Run interactive configuration wizard (buyer & seller)")}`);
  console.log(`  ${chalk.cyan(fitString("profile set <k> <v>", 26))} ${chalk.gray("Update pricing or PayPal configuration")}`);
  console.log(`  ${chalk.cyan(fitString("server", 26))} ${chalk.gray("Launch Broker Hub (port 4000) & AG Grid Dashboard")}`);
  console.log(`  ${chalk.cyan(fitString("video", 26))} ${chalk.gray("Play official 2m 30s SaaS launch video")}`);
  console.log(`  ${chalk.cyan(fitString("clear", 26))} ${chalk.gray("Clear terminal screen")}`);
  console.log(`  ${chalk.cyan(fitString("exit", 26))} ${chalk.gray("Exit Bounty CLI")}`);
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log("");
}

export async function runInteractiveShell(): Promise<void> {
  // First-run onboarding wizard if profile has not been explicitly configured
  if (!isProfileConfigured() && process.stdin.isTTY) {
    console.log(chalk.cyan("\n  Welcome to Bounty! First-time setup detected."));
    await runProfileWizard();
  }

  const { profile } = getActiveProfile();

  console.log("");
  console.log(chalk.white.bold("  Bounty") + chalk.gray(" · Autonomous Agent Subcontracting Protocol (v1.0.0)"));
  console.log(chalk.gray(`  Profile: ${profile.name} (${profile.email}) · Role: ${profile.role}`));
  console.log(chalk.gray("  Type any task to execute with autonomous struggle monitoring,"));
  console.log(chalk.gray("  type ") + chalk.cyan("help") + chalk.gray(" for commands, or ") + chalk.cyan("exit") + chalk.gray(" to quit."));
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

        case "do":
        case "run":
          if (!args.length) {
            console.log(chalk.yellow("  Usage: do <free-form task description>"));
            console.log(chalk.gray("  Example: do Fetch market prices from http://localhost:5000/protected"));
          } else {
            await runDoCommand(args.join(" "), {});
          }
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
          } else {
            const sub = args[0].toLowerCase();
            const target = args.slice(1).join(" ");
            if (sub === "scrape" || sub === "web_scrape") {
              if (!target) {
                console.log(chalk.yellow("  Usage: buy scrape <target-url>"));
              } else {
                await runBuyScrapeCommand(target, {});
              }
            } else if (sub === "ocr") {
              if (!target) {
                console.log(chalk.yellow("  Usage: buy ocr <path-to-image>"));
              } else {
                await runBuyOcrCommand(target, {});
              }
            } else {
              console.log(chalk.red(`  Unknown buy sub-command: ${sub}. Supported: scrape, ocr`));
            }
          }
          break;

        case "ledger":
          await runLedgerCommand({});
          break;

        case "nodes":
        case "orderbook":
          await runNodesCommand({});
          break;

        case "profile":
          if (!args.length || args[0] === "show") {
            displayProfileCard();
          } else if (args[0] === "set") {
            if (args.length < 3) {
              console.log(chalk.yellow("  Usage: profile set <key> <value>"));
              console.log(chalk.gray("  Example: profile set floor.web_scrape 0.08"));
            } else {
              handleProfileSet(args[1], args[2]);
            }
          } else if (args[0] === "init" || args[0] === "wizard" || args[0] === "config") {
            rl.close();
            await runProfileWizard();
            runInteractiveShell();
            return;
          }
          break;

        case "config":
        case "init":
          rl.close();
          await runProfileWizard();
          runInteractiveShell();
          return;

        case "server":
        case "broker":
          console.log(chalk.cyan("  Launching Bounty Broker Hub (port 4000) & AG Grid Dashboard..."));
          spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "start"], {
            cwd: "c:/Users/aarav.SOMEGUYWITHPRET/Bounty",
            stdio: "inherit",
            shell: true
          });
          break;

        case "video":
        case "watch": {
          const videoPath = "c:\\Users\\aarav.SOMEGUYWITHPRET\\Bounty\\docs\\videos\\bounty_side_by_side_saas_launch_2m30s.mp4";
          console.log(chalk.cyan("  Launching official Bounty 2m 30s SaaS launch video..."));
          spawn("cmd.exe", ["/c", "start", "", videoPath], { detached: true, stdio: "ignore" }).unref();
          break;
        }

        case "exit":
        case "quit":
        case "q":
          rl.close();
          process.exit(0);
          break;

        default:
          // Any other input is treated as a FREE-FORM TASK!
          await runDoCommand(trimmed, {});
          break;
      }
    } catch (err: any) {
      console.error(chalk.red(`  [ERROR] Command failed: ${err.message}`));
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
