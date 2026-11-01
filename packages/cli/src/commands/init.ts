import * as p from "@clack/prompts";
import chalk from "chalk";
import { BountyConfig, saveConfig } from "../config.js";
import { CapabilityType } from "@bounty/protocol";

export async function runInitCommand(): Promise<void> {
  console.clear();
  p.intro(chalk.cyan.bold("✦ Bounty Worker Setup Wizard"));

  // 1. PayPal Recipient Email
  const defaultEmail = process.env.PAYPAL_SELLER_EMAIL || "sb-sqcdl53128062@personal.example.com";
  const paypalEmail = await p.text({
    message: "PayPal sandbox receiving email:",
    placeholder: defaultEmail,
    initialValue: defaultEmail,
    validate(value) {
      if (!value || !value.includes("@")) return "Please enter a valid PayPal email address";
    }
  });

  if (p.isCancel(paypalEmail)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  // 2. Select Capabilities
  const selectedCapabilities = await p.multiselect({
    message: "Worker capabilities (multi-select):",
    options: [
      {
        value: "python_code",
        label: "python_code",
        hint: "Subprocess execution, returns verified code + SHA-256"
      },
      {
        value: "ocr",
        label: "ocr",
        hint: "Pytesseract on image bytes, returns text + SHA-256"
      },
      {
        value: "web_scrape",
        label: "web_scrape",
        hint: "httpx + BeautifulSoup, returns clean text + SHA-256"
      },
      {
        value: "residential_scrape",
        label: "residential_scrape",
        hint: "Residential IP routing with Cloudflare challenge clearance"
      }
    ],
    initialValues: ["python_code", "ocr", "web_scrape"],
    required: true
  });

  if (p.isCancel(selectedCapabilities)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  // 3. Floor Price per Task
  const floorPriceStr = await p.text({
    message: "Floor price per task (USD):",
    initialValue: "0.25",
    validate(val) {
      const num = parseFloat(val);
      if (isNaN(num) || num <= 0) return "Please enter a valid positive dollar amount (e.g. 0.25)";
    }
  });

  if (p.isCancel(floorPriceStr)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  const floorPrice = parseFloat(floorPriceStr as string);

  // 4. Max Concurrent Jobs
  const concurrencyStr = await p.text({
    message: "Max concurrent jobs:",
    initialValue: "2",
    validate(val) {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1 || num > 16) return "Please enter a number between 1 and 16";
    }
  });

  if (p.isCancel(concurrencyStr)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  const maxConcurrency = parseInt(concurrencyStr as string, 10);

  // Construct config
  const capabilitiesRecord: Record<string, any> = {};
  for (const cap of selectedCapabilities as CapabilityType[]) {
    capabilitiesRecord[cap] = {
      floorPriceUsd: floorPrice,
      maxConcurrency,
      description: `Worker plugin for ${cap}`
    };
  }

  const nodeId = `node_${Math.random().toString(36).substring(2, 7)}_${Date.now().toString(36)}`;
  const brokerUrl = process.env.BOUNTY_BROKER_URL || "ws://localhost:4000/ws/seller";

  const config: BountyConfig = {
    nodeId,
    payoutDestination: {
      type: "PAYPAL_EMAIL",
      value: paypalEmail as string
    },
    brokerUrl,
    capabilities: capabilitiesRecord
  };

  const savedPath = saveConfig(config);

  p.note(
    `Node ID:             ${chalk.cyan(config.nodeId)}\n` +
    `PayPal Recipient:    ${chalk.yellow(config.payoutDestination.value)}\n` +
    `Floor Price:         ${chalk.green(`$${floorPrice.toFixed(2)} USD`)}\n` +
    `Max Concurrency:     ${chalk.white(maxConcurrency)}\n` +
    `Active Capabilities: ${chalk.green(Object.keys(config.capabilities).join(", "))}`,
    "Saved bounty.config.json"
  );

  p.outro(
    chalk.green(
      `✓ Setup complete! Run ${chalk.cyan.bold("bounty start")} to launch.`
    )
  );
}
