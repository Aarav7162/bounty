import { runProfileWizard } from "./profile.js";
import { BountyConfig, saveConfig } from "../config.js";

export interface InitOptions {
  yes?: boolean;
  email?: string;
  floorPrice?: number;
}

export async function runInitCommand(options?: InitOptions): Promise<void> {
  const isNonInteractive = options?.yes || !process.stdin.isTTY;

  if (isNonInteractive) {
    const defaultEmail = options?.email || process.env.PAYPAL_SELLER_EMAIL || "sb-sqcdl53128062@personal.example.com";
    const floorPrice = options?.floorPrice ?? 0.05;
    const maxConcurrency = 2;
    const nodeId = `node_${Math.random().toString(36).substring(2, 7)}_${Date.now().toString(36)}`;
    const brokerUrl = process.env.BOUNTY_BROKER_URL || "ws://localhost:4000/ws/seller";

    const config: BountyConfig = {
      nodeId,
      payoutDestination: {
        type: "PAYPAL_EMAIL",
        value: defaultEmail
      },
      brokerUrl,
      capabilities: {
        python_code: { floorPriceUsd: 0.25, maxConcurrency, description: "Worker plugin for python_code" },
        ocr: { floorPriceUsd: 0.20, maxConcurrency, description: "Worker plugin for ocr" },
        web_scrape: { floorPriceUsd: floorPrice, maxConcurrency, description: "Worker plugin for web_scrape" },
        residential_scrape: { floorPriceUsd: floorPrice, maxConcurrency, description: "Worker plugin for residential_scrape" }
      }
    };

    saveConfig(config);
    console.log(`[bounty init] Auto-configured node ${config.nodeId} -> bounty.config.json`);
    console.log(`             PayPal Recipient: ${config.payoutDestination.value}`);
    return;
  }

  await runProfileWizard();
}
