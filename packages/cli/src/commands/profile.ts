import chalk from "chalk";
import * as p from "@clack/prompts";
import { getActiveProfile, updateActiveProfile, loadProfileConfig, saveProfileConfig, getProfilePath } from "../profile.js";

export function displayProfileCard(): void {
  const { name: profileKey, profile } = getActiveProfile();

  console.log("");
  console.log(chalk.cyan.bold("  ╭────────────────────────────────────────────────────────────────────────╮"));
  console.log(chalk.cyan.bold("  │") + chalk.white.bold(`  BOUNTY OPERATOR PROFILE · ${profileKey} (Active)`).padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  ├────────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.cyan.bold("  │") + `  Name:             ${chalk.white.bold(profile.name)}`.padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  │") + `  PayPal Account:   ${chalk.yellow.bold(profile.email)}`.padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  │") + `  Node ID:          ${chalk.cyan(profile.seller.nodeId)}`.padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  │") + `  Broker Hub:       ${chalk.gray(profile.seller.brokerUrl)}`.padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  ├────────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.cyan.bold("  │") + chalk.white.bold("  LIFETIME NETWORK BALANCE:").padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  │") + `    Seller Earned:  ${chalk.green.bold(`$${profile.stats.lifetimeEarnedUsd.toFixed(2)} USD`)}  (${profile.stats.tasksSold} jobs sold)`.padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  │") + `    Buyer Spent:    ${chalk.magenta.bold(`$${profile.stats.lifetimeSpentUsd.toFixed(2)} USD`)}  (${profile.stats.tasksBought} bounties bought)`.padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  ├────────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.cyan.bold("  │") + chalk.white.bold("  SELLER CAPABILITIES & FLOOR PRICES:").padEnd(80) + chalk.cyan.bold("│"));

  for (const [capName, details] of Object.entries(profile.seller.capabilities)) {
    const statusDot = details.enabled ? chalk.green("●") : chalk.red("○");
    const statusText = details.enabled ? chalk.green("ACTIVE") : chalk.gray("DISABLED");
    const line = `    ${statusDot} ${capName.padEnd(20)} Floor: ${chalk.yellow(`$${details.floorPriceUsd.toFixed(2)} USD`)}   Max: ${details.maxConcurrency}   ${statusText}`;
    console.log(chalk.cyan.bold("  │") + line.padEnd(80) + chalk.cyan.bold("│"));
  }

  console.log(chalk.cyan.bold("  ├────────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.cyan.bold("  │") + chalk.white.bold("  BUYER DELEGATION DEFAULTS:").padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  │") + `    Default Max Bid: ${chalk.yellow(`$${profile.buyer.defaultBidCeilingUsd.toFixed(2)} USD`)}   Timeout: ${profile.buyer.defaultTimeoutMs}ms`.padEnd(80) + chalk.cyan.bold("│"));
  console.log(chalk.cyan.bold("  ╰────────────────────────────────────────────────────────────────────────╯"));
  console.log(chalk.gray(`  Profile stored at: ${getProfilePath()}`));
  console.log("");
}

export function handleProfileSet(key: string, value: string): void {
  updateActiveProfile((profile) => {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "name") {
      profile.name = value;
      console.log(chalk.green(`✓ Set name to: ${value}`));
    } else if (lowerKey === "email" || lowerKey === "paypal") {
      profile.email = value;
      profile.seller.payoutDestination.value = value;
      console.log(chalk.green(`✓ Set PayPal email to: ${value}`));
    } else if (lowerKey === "nodeid" || lowerKey === "node_id") {
      profile.seller.nodeId = value;
      console.log(chalk.green(`✓ Set Node ID to: ${value}`));
    } else if (lowerKey === "broker" || lowerKey === "brokerurl") {
      profile.seller.brokerUrl = value;
      console.log(chalk.green(`✓ Set Broker URL to: ${value}`));
    } else if (lowerKey === "buyer.ceiling" || lowerKey === "bid_ceiling") {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) throw new Error("Invalid bid ceiling amount");
      profile.buyer.defaultBidCeilingUsd = num;
      console.log(chalk.green(`✓ Set Buyer default bid ceiling to: $${num.toFixed(2)} USD`));
    } else if (lowerKey.startsWith("floor.")) {
      const cap = lowerKey.replace("floor.", "");
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) throw new Error("Invalid floor price");
      if ((profile.seller.capabilities as any)[cap]) {
        (profile.seller.capabilities as any)[cap].floorPriceUsd = num;
        console.log(chalk.green(`✓ Set ${cap} floor price to: $${num.toFixed(2)} USD`));
      } else {
        throw new Error(`Unknown capability: ${cap}. Available: ${Object.keys(profile.seller.capabilities).join(", ")}`);
      }
    } else if (lowerKey.startsWith("enable.")) {
      const cap = lowerKey.replace("enable.", "");
      if ((profile.seller.capabilities as any)[cap]) {
        (profile.seller.capabilities as any)[cap].enabled = true;
        console.log(chalk.green(`✓ Enabled capability: ${cap}`));
      }
    } else if (lowerKey.startsWith("disable.")) {
      const cap = lowerKey.replace("disable.", "");
      if ((profile.seller.capabilities as any)[cap]) {
        (profile.seller.capabilities as any)[cap].enabled = false;
        console.log(chalk.yellow(`✓ Disabled capability: ${cap}`));
      }
    } else {
      throw new Error(`Unknown configuration key: ${key}. Examples: name, email, floor.web_scrape, floor.python_code, buyer.ceiling`);
    }
  });

  displayProfileCard();
}

export async function runProfileWizard(): Promise<void> {
  const { profile } = getActiveProfile();

  p.intro(chalk.bgCyan.black(" BOUNTY PROFILE SETUP WIZARD "));

  const name = await p.text({
    message: "Operator / Node display name:",
    initialValue: profile.name
  });
  if (p.isCancel(name)) return;

  const email = await p.text({
    message: "PayPal sandbox receiving email address:",
    initialValue: profile.email,
    validate: (val) => (!val || !val.includes("@") ? "Please enter a valid email" : undefined)
  });
  if (p.isCancel(email)) return;

  const webScrapePrice = await p.text({
    message: "Floor price for web_scrape ($ USD):",
    initialValue: profile.seller.capabilities.web_scrape?.floorPriceUsd.toString() ?? "0.05"
  });
  if (p.isCancel(webScrapePrice)) return;

  const pythonPrice = await p.text({
    message: "Floor price for python_code ($ USD):",
    initialValue: profile.seller.capabilities.python_code?.floorPriceUsd.toString() ?? "0.25"
  });
  if (p.isCancel(pythonPrice)) return;

  updateActiveProfile((prof) => {
    prof.name = name as string;
    prof.email = email as string;
    prof.seller.payoutDestination.value = email as string;
    if (prof.seller.capabilities.web_scrape) {
      prof.seller.capabilities.web_scrape.floorPriceUsd = parseFloat(webScrapePrice as string) || 0.05;
    }
    if (prof.seller.capabilities.python_code) {
      prof.seller.capabilities.python_code.floorPriceUsd = parseFloat(pythonPrice as string) || 0.25;
    }
  });

  p.outro(chalk.green("Profile successfully saved to ~/.bounty/profile.json!"));
  displayProfileCard();
}
