import chalk from "chalk";
import readline from "node:readline";
import { getActiveProfile, updateActiveProfile, getProfilePath } from "../profile.js";
import { fitString } from "../ui/layout.js";

export function displayProfileCard(): void {
  const { name: profileKey, profile } = getActiveProfile();

  console.log("");
  console.log(chalk.white.bold(`  Bounty Operator Profile · ${profileKey}`) + chalk.gray(" (active)"));
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log(`  ${chalk.gray(fitString("Name", 24))} ${chalk.white.bold(profile.name)}`);
  console.log(`  ${chalk.gray(fitString("Role", 24))} ${chalk.cyan(profile.role.toUpperCase())}`);
  console.log(`  ${chalk.gray(fitString("PayPal Account", 24))} ${chalk.yellow(profile.email)}`);
  console.log(`  ${chalk.gray(fitString("Node ID", 24))} ${chalk.cyan(profile.seller.nodeId)}`);
  console.log(`  ${chalk.gray(fitString("Broker Hub", 24))} ${chalk.gray(profile.seller.brokerUrl)}`);
  
  console.log("");
  console.log(chalk.white.bold("  Network Balance"));
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log(`  ${chalk.gray(fitString("Seller Earned", 24))} ${chalk.green.bold(`$${profile.stats.lifetimeEarnedUsd.toFixed(2)} USD`)} ${chalk.gray(`(${profile.stats.tasksSold} jobs sold)`)}`);
  console.log(`  ${chalk.gray(fitString("Buyer Spent", 24))} ${chalk.magenta.bold(`$${profile.stats.lifetimeSpentUsd.toFixed(2)} USD`)} ${chalk.gray(`(${profile.stats.tasksBought} bounties bought)`)}`);

  console.log("");
  console.log(chalk.white.bold("  Configured Capabilities & Floor Prices"));
  console.log(chalk.gray("  " + "─".repeat(68)));

  for (const [capName, details] of Object.entries(profile.seller.capabilities)) {
    const statusText = details.enabled ? chalk.green("[active]") : chalk.gray("[disabled]");
    const nameCol = fitString(capName, 20);
    const floorCol = fitString(`$${details.floorPriceUsd.toFixed(2)} USD`, 14);
    const concCol = fitString(`concurrency: ${details.maxConcurrency}`, 18);
    console.log(`  ${chalk.cyan(nameCol)} ${chalk.yellow(floorCol)} ${chalk.gray(concCol)} ${statusText}`);
  }

  console.log("");
  console.log(chalk.white.bold("  Buyer Delegation & Struggle Envelope Defaults"));
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log(`  ${chalk.gray(fitString("Default Max Bid", 24))} ${chalk.yellow(`$${profile.buyer.defaultBidCeilingUsd.toFixed(2)} USD`)}`);
  console.log(`  ${chalk.gray(fitString("Max Local Attempts", 24))} ${chalk.white(`${profile.buyer.maxLocalAttempts ?? 2} attempts`)}`);
  console.log(`  ${chalk.gray(fitString("Local Timeout Window", 24))} ${chalk.white(`${profile.buyer.localTimeoutSeconds ?? 15}s`)}`);
  console.log(`  ${chalk.gray(fitString("Network Poll Timeout", 24))} ${chalk.white(`${profile.buyer.defaultTimeoutMs}ms`)}`);
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log(chalk.gray(`  Profile stored at: ${getProfilePath()}`));
  console.log("");
}

export function handleProfileSet(key: string, value: string): void {
  updateActiveProfile((profile) => {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "name") {
      profile.name = value;
      console.log(chalk.green(`  [OK] Set name to: ${value}`));
    } else if (lowerKey === "email" || lowerKey === "paypal") {
      profile.email = value;
      profile.seller.payoutDestination.value = value;
      console.log(chalk.green(`  [OK] Set PayPal email to: ${value}`));
    } else if (lowerKey === "role") {
      if (!["both", "buyer", "seller"].includes(value.toLowerCase())) {
        throw new Error("Role must be 'both', 'buyer', or 'seller'");
      }
      profile.role = value.toLowerCase() as any;
      console.log(chalk.green(`  [OK] Set network role to: ${value}`));
    } else if (lowerKey === "nodeid" || lowerKey === "node_id") {
      profile.seller.nodeId = value;
      console.log(chalk.green(`  [OK] Set Node ID to: ${value}`));
    } else if (lowerKey === "broker" || lowerKey === "brokerurl") {
      profile.seller.brokerUrl = value;
      console.log(chalk.green(`  [OK] Set Broker URL to: ${value}`));
    } else if (lowerKey === "buyer.ceiling" || lowerKey === "bid_ceiling") {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) throw new Error("Invalid bid ceiling amount");
      profile.buyer.defaultBidCeilingUsd = num;
      console.log(chalk.green(`  [OK] Set Buyer default bid ceiling to: $${num.toFixed(2)} USD`));
    } else if (lowerKey.startsWith("floor.")) {
      const cap = lowerKey.replace("floor.", "");
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) throw new Error("Invalid floor price");
      if ((profile.seller.capabilities as any)[cap]) {
        (profile.seller.capabilities as any)[cap].floorPriceUsd = num;
        console.log(chalk.green(`  [OK] Set ${cap} floor price to: $${num.toFixed(2)} USD`));
      } else {
        throw new Error(`Unknown capability: ${cap}. Available: ${Object.keys(profile.seller.capabilities).join(", ")}`);
      }
    } else if (lowerKey.startsWith("enable.")) {
      const cap = lowerKey.replace("enable.", "");
      if ((profile.seller.capabilities as any)[cap]) {
        (profile.seller.capabilities as any)[cap].enabled = true;
        console.log(chalk.green(`  [OK] Enabled capability: ${cap}`));
      }
    } else if (lowerKey.startsWith("disable.")) {
      const cap = lowerKey.replace("disable.", "");
      if ((profile.seller.capabilities as any)[cap]) {
        (profile.seller.capabilities as any)[cap].enabled = false;
        console.log(chalk.yellow(`  [OK] Disabled capability: ${cap}`));
      }
    } else {
      throw new Error(`Unknown configuration key: ${key}. Examples: name, email, role, floor.web_scrape, floor.python_code, buyer.ceiling`);
    }
  });

  displayProfileCard();
}

function promptLine(rl: readline.Interface, questionText: string, defaultVal: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.gray(`  ${questionText} `) + chalk.cyan(`[${defaultVal}]: `), (ans) => {
      resolve(ans.trim() || defaultVal);
    });
  });
}

export async function runProfileWizard(): Promise<void> {
  const { profile } = getActiveProfile();

  console.log("");
  console.log(chalk.white.bold("  Bounty Profile Configuration Wizard"));
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log(chalk.gray("  Configure your operator profile, autonomous Struggle Envelope,"));
  console.log(chalk.gray("  and PayPal payout routing. Minimalist Claude CLI interface."));
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const name = await promptLine(rl, "Operator / Node display name", profile.name || "Developer Node");

    console.log(chalk.gray("  Select role: 1) Both (Buyer & Seller)  2) Buyer Only  3) Seller Only"));
    const roleInput = await promptLine(rl, "Primary network role", profile.role || "both");
    let role: "both" | "buyer" | "seller" = "both";
    if (roleInput === "2" || roleInput.toLowerCase() === "buyer") role = "buyer";
    else if (roleInput === "3" || roleInput.toLowerCase() === "seller") role = "seller";
    else role = "both";

    let buyerCeiling = profile.buyer.defaultBidCeilingUsd.toString();
    let maxAttempts = (profile.buyer.maxLocalAttempts ?? 2).toString();
    let localTimeout = (profile.buyer.localTimeoutSeconds ?? 15).toString();

    if (role === "both" || role === "buyer") {
      console.log(chalk.gray("\n  ── Buyer Configuration ──"));
      buyerCeiling = await promptLine(rl, "Default max budget ceiling ($ USD)", buyerCeiling);
      maxAttempts = await promptLine(rl, "Struggle Envelope: Max local free attempts before delegation", maxAttempts);
      localTimeout = await promptLine(rl, "Struggle Envelope: Local timeout window (seconds)", localTimeout);
    }

    let email = profile.email;
    let webScrapePrice = (profile.seller.capabilities.web_scrape?.floorPriceUsd ?? 0.05).toString();
    let ocrPrice = (profile.seller.capabilities.ocr?.floorPriceUsd ?? 0.20).toString();
    let pythonPrice = (profile.seller.capabilities.python_code?.floorPriceUsd ?? 0.25).toString();

    if (role === "both" || role === "seller") {
      console.log(chalk.gray("\n  ── Seller Configuration ──"));
      email = await promptLine(rl, "PayPal sandbox receiving email", email);
      webScrapePrice = await promptLine(rl, "Seller floor price for web_scrape ($ USD)", webScrapePrice);
      ocrPrice = await promptLine(rl, "Seller floor price for ocr ($ USD)", ocrPrice);
      pythonPrice = await promptLine(rl, "Seller floor price for python_code ($ USD)", pythonPrice);
    }

    updateActiveProfile((prof) => {
      prof.name = name;
      prof.role = role;
      prof.email = email;
      prof.configured = true;

      prof.buyer.defaultBidCeilingUsd = parseFloat(buyerCeiling) || 0.06;
      prof.buyer.maxLocalAttempts = parseInt(maxAttempts, 10) || 2;
      prof.buyer.localTimeoutSeconds = parseInt(localTimeout, 10) || 15;

      prof.seller.payoutDestination.value = email;
      if (prof.seller.capabilities.web_scrape) {
        prof.seller.capabilities.web_scrape.floorPriceUsd = parseFloat(webScrapePrice) || 0.05;
      }
      if (prof.seller.capabilities.ocr) {
        prof.seller.capabilities.ocr.floorPriceUsd = parseFloat(ocrPrice) || 0.20;
      }
      if (prof.seller.capabilities.python_code) {
        prof.seller.capabilities.python_code.floorPriceUsd = parseFloat(pythonPrice) || 0.25;
      }
    });

    console.log("");
    console.log(chalk.green("  [OK] Profile successfully configured in ~/.bounty/profile.json"));
    displayProfileCard();
  } finally {
    rl.close();
  }
}
