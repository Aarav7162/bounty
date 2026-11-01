import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { CapabilityTypeEnum } from "@bounty/protocol";

export const CapabilityConfigItemSchema = z.object({
  floorPriceUsd: z.number().min(0.01).max(50.0).default(0.05),
  maxConcurrency: z.number().int().min(1).max(16).default(2),
  description: z.string().optional()
});
export type CapabilityConfigItem = z.infer<typeof CapabilityConfigItemSchema>;

export const BountyConfigSchema = z.object({
  nodeId: z.string().min(1),
  payoutDestination: z.object({
    type: z.literal("PAYPAL_EMAIL").default("PAYPAL_EMAIL"),
    value: z.string().email()
  }),
  brokerUrl: z.string().url().default("ws://localhost:4000/ws/seller"),
  capabilities: z.record(CapabilityTypeEnum, CapabilityConfigItemSchema)
});
export type BountyConfig = z.infer<typeof BountyConfigSchema>;

export const DEFAULT_CONFIG_FILE = "bounty.config.json";

export function loadConfig(customPath?: string): BountyConfig | null {
  const filePath = resolve(process.cwd(), customPath ?? DEFAULT_CONFIG_FILE);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    const json = JSON.parse(raw);
    return BountyConfigSchema.parse(json);
  } catch (err: any) {
    throw new Error(`Failed to parse ${filePath}: ${err.message}`);
  }
}

export function saveConfig(config: BountyConfig, customPath?: string): string {
  const filePath = resolve(process.cwd(), customPath ?? DEFAULT_CONFIG_FILE);
  const validated = BountyConfigSchema.parse(config);
  writeFileSync(filePath, JSON.stringify(validated, null, 2), "utf8");
  return filePath;
}

export function createDefaultConfig(paypalEmail: string, nodeId?: string): BountyConfig {
  return {
    nodeId: nodeId ?? `node_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    payoutDestination: {
      type: "PAYPAL_EMAIL",
      value: paypalEmail
    },
    brokerUrl: process.env.BOUNTY_BROKER_URL || "ws://localhost:4000/ws/seller",
    capabilities: {
      python_code: {
        floorPriceUsd: 0.25,
        maxConcurrency: 2,
        description: "Python code execution, unit testing and bug fixing"
      },
      ocr: {
        floorPriceUsd: 0.20,
        maxConcurrency: 2,
        description: "Tesseract OCR text extraction"
      },
      web_scrape: {
        floorPriceUsd: 0.05,
        maxConcurrency: 2,
        description: "httpx + BeautifulSoup web scraping"
      },
      residential_scrape: {
        floorPriceUsd: 0.05,
        maxConcurrency: 2,
        description: "Residential proxy routing with Cloudflare challenge bypass"
      }
    }
  };
}

