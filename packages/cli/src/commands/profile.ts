import chalk from "chalk";
import * as p from "@clack/prompts";
import { getActiveProfile, updateActiveProfile, loadProfileConfig, saveProfileConfig, getProfilePath } from "../profile.js";
import { fitString } from "../ui/layout.js";

export function displayProfileCard(): void {
  const { name: profileKey, profile } = getActiveProfile();

  console.log("");
  console.log(chalk.white.bold(`  Bounty Operator Profile · ${profileKey}`) + chalk.gray(" (active)"));
  console.log(chalk.gray("  " + "─".repeat(64)));
  console.log(`  ${chalk.gray(fitString("Name", 22))} ${chalk.white.bold(profile.name)}`);
  console.log(`  ${chalk.gray(fitString("PayPal Account", 22))} ${chalk.yellow(profile.email)}`);
  console.log(`  ${chalk.gray(fitString("Node ID", 22))} ${chalk.cyan(profile.seller.nodeId)}`);
  console.log(`  ${chalk.gray(fitString("Broker Hub", 22))} ${chalk.gray(profile.seller.brokerUrl)}`);
  
  console.log("");
  console.log(chalk.white.bold("  Network Balance"));
  console.log(chalk.gray("  " + "─".repeat(64)));
  console.log(`  ${chalk.gray(fitString("Seller Earned", 22))} ${chalk.green.bold(`$${profile.stats.lifetimeEarnedUsd.toFixed(2)} USD`)} ${chalk.gray(`(${profile.stats.tasksSold} jobs sold)`)}`);
  console.log(`  ${chalk.gray(fitString("Buyer Spent", 22))} ${chalk.magenta.bold(`$${profile.stats.lifetimeSpentUsd.toFixed(2)} USD`)} ${chalk.gray(`(${profile.stats.tasksBought} bounties bought)`)}`);

  console.log("");
  console.log(chalk.white.bold("  Configured Capabilities & Floor Prices"));
  console.log(chalk.gray("  " + "─".repeat(64)));

  for (const [capName, details] of Object.entries(profile.seller.capabilities)) {
    const statusText = details.enabled ? chalk.green("active") : chalk.gray("disabled");
    const nameCol = fitString(capName, 20);
    const floorCol = fitString(`$${details.floorPriceUsd.toFixed(2)} USD`, 14);
    const concCol = fitString(`concurrency: ${details.maxConcurrency}`, 18);
    console.log(`  ${chalk.cyan(nameCol)} ${chalk.yellow(floorCol)} ${chalk.gray(concCol)} ${statusText}`);
  }

  console.log("");
  console.log(chalk.white.bold("  Buyer Delegation Defaults"));
  console.log(chalk.gray("  " + "─".repeat(64)));
  console.log(`  ${chalk.gray(fitString("Default Max Bid", 22))} ${chalk.yellow(`$${profile.buyer.defaultBidCeilingUsd.toFixed(2)} USD`)}`);
  console.log(`  ${chalk.gray(fitString("Default Timeout", 22))} ${chalk.white(`${profile.buyer.defaultTimeoutMs}ms`)}`);
  console.log(chalk.gray("  " + "─".repeat(64)));
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
    validate: (val?: string) => (!val || !val.includes("@") ? "Please enter a valid email" : undefined)
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
