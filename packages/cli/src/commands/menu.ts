import chalk from "chalk";
import * as p from "@clack/prompts";
import { getActiveProfile } from "../profile.js";
import { runStartCommand } from "./start.js";
import { runBuyWizard } from "./buy.js";
import { runLedgerCommand } from "./ledger.js";
import { runNodesCommand } from "./nodes.js";
import { displayProfileCard } from "./profile.js";

export async function runRootMenu(): Promise<void> {
  const { profile } = getActiveProfile();

  console.log("");
  console.log(chalk.cyan.bold("  ╔════════════════════════════════════════════════════════════════════════╗"));
  console.log(chalk.cyan.bold("  ║") + chalk.white.bold("   BOUNTY · Autonomous Agent Commerce & Micro-Delegation Protocol   ") + chalk.cyan.bold("║"));
  console.log(chalk.cyan.bold("  ║") + chalk.gray(`   Active Profile: ${profile.name} (${profile.email})`).padEnd(75) + chalk.cyan.bold("║"));
  console.log(chalk.cyan.bold("  ╚════════════════════════════════════════════════════════════════════════╝"));
  console.log("");

  const choice = await p.select({
    message: "Select an operation:",
    options: [
      { value: "sell", label: "⚡ Start Seller Node", hint: "Monetize compute & earn PayPal payouts" },
      { value: "buy", label: "🛒 Buy / Delegate Task", hint: "Subcontract web scrape, OCR, or Python compute" },
      { value: "ledger", label: "📊 Settlement Ledger", hint: "Inspect live PayPal batches & transaction proofs" },
      { value: "nodes", label: "🌐 Orderbook Mesh", hint: "View active seller nodes and floor prices" },
      { value: "profile", label: "👤 Operator Profile", hint: "View & configure identity, pricing, and limits" },
      { value: "exit", label: "✕ Exit" }
    ]
  });

  if (p.isCancel(choice) || choice === "exit") {
    process.exit(0);
  }

  if (choice === "sell") {
    await runStartCommand({});
  } else if (choice === "buy") {
    await runBuyWizard();
  } else if (choice === "ledger") {
    await runLedgerCommand({});
  } else if (choice === "nodes") {
    await runNodesCommand({});
  } else if (choice === "profile") {
    displayProfileCard();
  }
}
