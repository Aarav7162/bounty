import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import os from "node:os";
import { z } from "zod";
import { CapabilityTypeEnum } from "@bounty/protocol";
import { loadConfig, DEFAULT_CONFIG_FILE } from "./config.js";

export const CapabilityItemSchema = z.object({
  floorPriceUsd: z.number().min(0.01).max(50.0).default(0.05),
  maxConcurrency: z.number().int().min(1).max(16).default(2),
  enabled: z.boolean().default(true),
  description: z.string().optional()
});
export type CapabilityItem = z.infer<typeof CapabilityItemSchema>;

export const ProfileDataSchema = z.object({
  name: z.string().default("Developer Node"),
  email: z.string().email().default("sb-sqcdl53128062@personal.example.com"),
  role: z.enum(["buyer", "seller", "both"]).default("both"),
  buyer: z.object({
    defaultBidCeilingUsd: z.number().default(0.06),
    defaultTimeoutMs: z.number().default(10000),
    autoApproveBelowUsd: z.number().default(0.10)
  }).default({}),
  seller: z.object({
    nodeId: z.string().default("node_mumbai_01"),
    brokerUrl: z.string().url().default("ws://localhost:4000/ws/seller"),
    payoutDestination: z.object({
      type: z.literal("PAYPAL_EMAIL").default("PAYPAL_EMAIL"),
      value: z.string().email().default("sb-sqcdl53128062@personal.example.com")
    }).default({ type: "PAYPAL_EMAIL", value: "sb-sqcdl53128062@personal.example.com" }),
    capabilities: z.record(CapabilityTypeEnum, CapabilityItemSchema).default({
      python_code: {
        floorPriceUsd: 0.25,
        maxConcurrency: 2,
        enabled: true,
        description: "Python code execution, unit testing and bug fixing"
      },
      ocr: {
        floorPriceUsd: 0.20,
        maxConcurrency: 2,
        enabled: true,
        description: "Tesseract OCR text extraction"
      },
      web_scrape: {
        floorPriceUsd: 0.05,
        maxConcurrency: 2,
        enabled: true,
        description: "httpx + BeautifulSoup web scraping"
      },
      residential_scrape: {
        floorPriceUsd: 0.05,
        maxConcurrency: 2,
        enabled: true,
        description: "Residential proxy routing with Cloudflare challenge bypass"
      }
    })
  }).default({
    nodeId: "node_mumbai_01",
    brokerUrl: "ws://localhost:4000/ws/seller",
    payoutDestination: { type: "PAYPAL_EMAIL", value: "sb-sqcdl53128062@personal.example.com" },
    capabilities: {
      python_code: { floorPriceUsd: 0.25, maxConcurrency: 2, enabled: true },
      ocr: { floorPriceUsd: 0.20, maxConcurrency: 2, enabled: true },
      web_scrape: { floorPriceUsd: 0.05, maxConcurrency: 2, enabled: true },
      residential_scrape: { floorPriceUsd: 0.05, maxConcurrency: 2, enabled: true }
    }
  }),
  stats: z.object({
    lifetimeEarnedUsd: z.number().default(0.0),
    lifetimeSpentUsd: z.number().default(0.0),
    tasksSold: z.number().int().default(0),
    tasksBought: z.number().int().default(0),
    lastSettlementAt: z.string().optional()
  }).default({})
});
export type ProfileData = z.infer<typeof ProfileDataSchema>;

export const GlobalProfileConfigSchema = z.object({
  version: z.literal("1.0.0").default("1.0.0"),
  activeProfile: z.string().default("default"),
  profiles: z.record(z.string(), ProfileDataSchema).default({})
});
export type GlobalProfileConfig = z.infer<typeof GlobalProfileConfigSchema>;

export function getProfileDir(): string {
  const dir = resolve(os.homedir(), ".bounty");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getProfilePath(): string {
  return resolve(getProfileDir(), "profile.json");
}

export function loadProfileConfig(): GlobalProfileConfig {
  const filePath = getProfilePath();
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, "utf8");
      return GlobalProfileConfigSchema.parse(JSON.parse(raw));
    } catch {
      // Fall through to initialize or migrate
    }
  }

  // Create default profile config
  const legacyConfig = loadConfig();
  const defaultProfile = ProfileDataSchema.parse({
    name: "Developer Node",
    email: legacyConfig?.payoutDestination?.value ?? "sb-sqcdl53128062@personal.example.com",
    role: "both",
    seller: {
      nodeId: legacyConfig?.nodeId ?? "node_mumbai_01",
      brokerUrl: legacyConfig?.brokerUrl ?? "ws://localhost:4000/ws/seller",
      payoutDestination: legacyConfig?.payoutDestination ?? {
        type: "PAYPAL_EMAIL",
        value: "sb-sqcdl53128062@personal.example.com"
      },
      capabilities: legacyConfig?.capabilities ? {
        python_code: {
          floorPriceUsd: legacyConfig.capabilities.python_code?.floorPriceUsd ?? 0.25,
          maxConcurrency: legacyConfig.capabilities.python_code?.maxConcurrency ?? 2,
          enabled: true,
          description: legacyConfig.capabilities.python_code?.description ?? "Python execution"
        },
        ocr: {
          floorPriceUsd: legacyConfig.capabilities.ocr?.floorPriceUsd ?? 0.20,
          maxConcurrency: legacyConfig.capabilities.ocr?.maxConcurrency ?? 2,
          enabled: true,
          description: legacyConfig.capabilities.ocr?.description ?? "OCR engine"
        },
        web_scrape: {
          floorPriceUsd: legacyConfig.capabilities.web_scrape?.floorPriceUsd ?? 0.05,
          maxConcurrency: legacyConfig.capabilities.web_scrape?.maxConcurrency ?? 2,
          enabled: true,
          description: legacyConfig.capabilities.web_scrape?.description ?? "Web scraping"
        },
        residential_scrape: {
          floorPriceUsd: legacyConfig.capabilities.residential_scrape?.floorPriceUsd ?? 0.05,
          maxConcurrency: legacyConfig.capabilities.residential_scrape?.maxConcurrency ?? 2,
          enabled: true,
          description: legacyConfig.capabilities.residential_scrape?.description ?? "Residential bypass"
        }
      } : undefined
    }
  });

  const globalConfig: GlobalProfileConfig = {
    version: "1.0.0",
    activeProfile: "default",
    profiles: {
      default: defaultProfile
    }
  };

  saveProfileConfig(globalConfig);
  return globalConfig;
}

export function saveProfileConfig(config: GlobalProfileConfig): void {
  const filePath = getProfilePath();
  const validated = GlobalProfileConfigSchema.parse(config);
  writeFileSync(filePath, JSON.stringify(validated, null, 2), "utf8");
}

export function getActiveProfile(): { name: string; profile: ProfileData } {
  const config = loadProfileConfig();
  const profile = config.profiles[config.activeProfile] || config.profiles["default"] || ProfileDataSchema.parse({});
  return { name: config.activeProfile, profile };
}

export function updateActiveProfile(updater: (profile: ProfileData) => ProfileData | void): ProfileData {
  const config = loadProfileConfig();
  const activeName = config.activeProfile;
  const current = config.profiles[activeName] || ProfileDataSchema.parse({});
  const result = updater(current);
  const updated = result || current;
  config.profiles[activeName] = ProfileDataSchema.parse(updated);
  saveProfileConfig(config);
  return config.profiles[activeName];
}

export function recordSellerEarnings(amountUsd: number): void {
  updateActiveProfile((p) => {
    p.stats.lifetimeEarnedUsd = Number((p.stats.lifetimeEarnedUsd + amountUsd).toFixed(2));
    p.stats.tasksSold += 1;
    p.stats.lastSettlementAt = new Date().toISOString();
  });
}

export function recordBuyerSpend(amountUsd: number): void {
  updateActiveProfile((p) => {
    p.stats.lifetimeSpentUsd = Number((p.stats.lifetimeSpentUsd + amountUsd).toFixed(2));
    p.stats.tasksBought += 1;
  });
}
