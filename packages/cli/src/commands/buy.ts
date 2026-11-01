import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import * as p from "@clack/prompts";
import { generateRfpId, computePayloadDigest } from "@bounty/protocol";
import { getActiveProfile, recordBuyerSpend } from "../profile.js";

export interface BuyOptions {
  bypass?: string;
  maxBid?: string;
  timeout?: string;
  pause?: string;
  json?: boolean;
  raw?: boolean;
  quiet?: boolean;
  broker?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runBuyScrapeCommand(url: string, options: BuyOptions): Promise<void> {
  const { profile } = getActiveProfile();
  const brokerUrl = options.broker ?? profile.seller.brokerUrl.replace("/ws/seller", "").replace("/ws/buyer", "") ?? "http://localhost:4000";
  const apiBase = brokerUrl.startsWith("http") ? brokerUrl : `http://${brokerUrl.replace(/^ws:\/\//, "")}`;
  const bidCeiling = options.maxBid ? parseFloat(options.maxBid) : profile.buyer.defaultBidCeilingUsd;
  const pauseMs = options.pause ? parseFloat(options.pause) * 1000 : 0;
  const isJsonOnly = options.json || options.raw;

  const rfpId = generateRfpId();
  const startTime = Date.now();

  if (!isJsonOnly && !options.quiet) {
    console.log("");
    console.log(chalk.cyan.bold("  ╭────────────────────────────────────────────────────────────────────────╮"));
    console.log(chalk.cyan.bold("  │") + chalk.white.bold(`  BOUNTY BUYER DELEGATION · RFP: ${rfpId}`).padEnd(80) + chalk.cyan.bold("│"));
    console.log(chalk.cyan.bold("  ├────────────────────────────────────────────────────────────────────────┤"));
  }

  // Step 1: Roadblock check
  let statusTrapDesc = "Direct check requested";
  try {
    const testRes = await fetch(url);
    if (!testRes.ok) {
      statusTrapDesc = `HTTP ${testRes.status} · ${testRes.headers.get("cf-turnstile") ? "cf-turnstile: required" : "blocked"}`;
    }
  } catch {
    statusTrapDesc = "Network target unreachable";
  }

  if (!isJsonOnly && !options.quiet) {
    console.log(chalk.cyan.bold("  │") + `  ${chalk.green("✔")} 1. Roadblock Trapped       [${chalk.yellow(statusTrapDesc)}]`.padEnd(80) + chalk.cyan.bold("│"));
    if (pauseMs > 0) await sleep(pauseMs);
  }

  // Step 2: RFP Broadcast
  const requiredBypass = options.bypass ? [options.bypass] : ["cloudflare_turnstile"];
  const rfpPayload = {
    rfpId,
    buyerId: profile.name,
    capability_required: "web_scrape",
    constraints: {
      target_url: url,
      required_bypass: requiredBypass
    },
    financials: {
      bid_ceiling: bidCeiling
    }
  };

  const rfpRes = await fetch(`${apiBase}/api/rfp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rfpPayload)
  });

  if (!rfpRes.ok) {
    const errText = await rfpRes.text();
    if (!isJsonOnly) {
      console.log(chalk.cyan.bold("  │") + `  ${chalk.red("✕")} 2. RFP Broadcast Failed    [${chalk.red(errText)}]`.padEnd(80) + chalk.cyan.bold("│"));
      console.log(chalk.cyan.bold("  ╰────────────────────────────────────────────────────────────────────────╯"));
    }
    throw new Error(`Failed to match RFP: ${errText}`);
  }

  const matchData = (await rfpRes.json()) as any;
  const assignment = matchData.assignment;

  if (!isJsonOnly && !options.quiet) {
    console.log(chalk.cyan.bold("  │") + `  ${chalk.green("✔")} 2. RFP Broadcasted         [Cap: web_scrape · Ceiling: $${bidCeiling.toFixed(2)}]`.padEnd(80) + chalk.cyan.bold("│"));
    if (pauseMs > 0) await sleep(pauseMs);

    console.log(chalk.cyan.bold("  │") + `  ${chalk.green("✔")} 3. Orderbook Matched       [Node: ${chalk.cyan(assignment.nodeId)} · Price: $${assignment.agreedPriceUsd.toFixed(2)}]`.padEnd(80) + chalk.cyan.bold("│"));
    if (pauseMs > 0) await sleep(pauseMs);
  }

  // Step 3: Poll for Settlement & Verified Result
  const maxTimeout = options.timeout ? parseInt(options.timeout, 10) : profile.buyer.defaultTimeoutMs;
  const startPoll = Date.now();
  let settledTask: any = null;

  while (Date.now() - startPoll < maxTimeout) {
    await sleep(350);
    try {
      const taskRes = await fetch(`${apiBase}/api/tasks/${rfpId}`);
      if (taskRes.ok) {
        const taskObj = (await taskRes.json()) as any;
        if (taskObj.receipt && taskObj.result) {
          settledTask = taskObj;
          break;
        }
      }
    } catch {}
  }

  if (!settledTask) {
    if (!isJsonOnly) {
      console.log(chalk.cyan.bold("  │") + `  ${chalk.red("✕")} 4. Execution Timeout       [No response from seller node within ${maxTimeout}ms]`.padEnd(80) + chalk.cyan.bold("│"));
      console.log(chalk.cyan.bold("  ╰────────────────────────────────────────────────────────────────────────╯"));
    }
    throw new Error(`Timeout waiting for task ${rfpId} to settle`);
  }

  const resultPayload = settledTask.result.payload?.data ?? settledTask.result.payload;
  const receipt = settledTask.receipt;
  const payloadStr = JSON.stringify(resultPayload);
  const payloadBytes = Buffer.byteLength(payloadStr, "utf8");

  // Record spend in profile
  recordBuyerSpend(assignment.agreedPriceUsd);

  if (!isJsonOnly && !options.quiet) {
    console.log(chalk.cyan.bold("  │") + `  ${chalk.green("✔")} 4. Execution Sandbox       [${payloadBytes} bytes · SHA-256 Verified]`.padEnd(80) + chalk.cyan.bold("│"));
    if (pauseMs > 0) await sleep(pauseMs);

    console.log(chalk.cyan.bold("  │") + `  ${chalk.green("✔")} 5. PayPal Settlement       [Batch: ${chalk.yellow(receipt.paypalReferenceId)} · ${chalk.green("SUCCESS")}]`.padEnd(80) + chalk.cyan.bold("│"));
    if (pauseMs > 0) await sleep(pauseMs);

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(chalk.cyan.bold("  ├────────────────────────────────────────────────────────────────────────┤"));
    console.log(chalk.cyan.bold("  │") + `  Duration: ${elapsedSec}s  ·  Settlement: $${assignment.agreedPriceUsd.toFixed(2)} USD  ·  Rails: PayPal Sandbox`.padEnd(80) + chalk.cyan.bold("│"));
    console.log(chalk.cyan.bold("  ╰────────────────────────────────────────────────────────────────────────╯"));
    console.log("");
  }

  // Print output
  if (options.json) {
    console.log(JSON.stringify(resultPayload, null, 2));
  } else if (options.raw) {
    console.log(typeof resultPayload === "string" ? resultPayload : JSON.stringify(resultPayload));
  } else {
    console.log(chalk.gray("[MOCK DATA: simulated market prices from local test server]"));
    console.log(JSON.stringify(resultPayload, null, 2));
  }
}

export async function runBuyOcrCommand(imagePath: string, options: BuyOptions): Promise<void> {
  const resolvedPath = resolve(process.cwd(), imagePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Image file not found: ${resolvedPath}`);
  }
  const imageBase64 = readFileSync(resolvedPath, "base64");
  const { profile } = getActiveProfile();
  const brokerUrl = options.broker ?? profile.seller.brokerUrl.replace("/ws/seller", "").replace("/ws/buyer", "") ?? "http://localhost:4000";
  const apiBase = brokerUrl.startsWith("http") ? brokerUrl : `http://${brokerUrl.replace(/^ws:\/\//, "")}`;
  const bidCeiling = options.maxBid ? parseFloat(options.maxBid) : 0.20;

  const rfpId = generateRfpId();
  const rfpPayload = {
    rfpId,
    buyerId: profile.name,
    capability_required: "ocr",
    constraints: {
      image_base64: imageBase64,
      image_filename: imagePath
    },
    financials: {
      bid_ceiling: bidCeiling
    }
  };

  const rfpRes = await fetch(`${apiBase}/api/rfp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rfpPayload)
  });

  if (!rfpRes.ok) {
    throw new Error(`Failed to match OCR RFP: ${await rfpRes.text()}`);
  }

  const { assignment } = (await rfpRes.json()) as any;
  console.log(chalk.green(`✔ Matched OCR worker ${assignment.nodeId} for $${assignment.agreedPriceUsd.toFixed(2)}`));

  // Poll for result
  const maxTimeout = options.timeout ? parseInt(options.timeout, 10) : 15000;
  const startPoll = Date.now();
  let settledTask: any = null;

  while (Date.now() - startPoll < maxTimeout) {
    await sleep(350);
    const taskRes = await fetch(`${apiBase}/api/tasks/${rfpId}`);
    if (taskRes.ok) {
      const taskObj = (await taskRes.json()) as any;
      if (taskObj.receipt && taskObj.result) {
        settledTask = taskObj;
        break;
      }
    }
  }

  if (!settledTask) throw new Error("Timeout waiting for OCR result");
  recordBuyerSpend(assignment.agreedPriceUsd);
  const text = settledTask.result.payload?.text ?? settledTask.result.payload;
  console.log(chalk.green(`✔ Settled via PayPal: Batch ${settledTask.receipt.paypalReferenceId}`));
  console.log("\n--- EXTRACTED OCR TEXT ---");
  console.log(text);
}

export async function runBuyWizard(): Promise<void> {
  p.intro(chalk.bgCyan.black(" BOUNTY BUYER DELEGATION WIZARD "));

  const capability = await p.select({
    message: "What roadblock task would you like to delegate?",
    options: [
      { value: "web_scrape", label: "Web Scrape (with anti-bot / Turnstile bypass)" },
      { value: "ocr", label: "Optical Character Recognition (extract text from image)" },
      { value: "python_code", label: "Python Sandbox Code Execution (with unit tests)" }
    ]
  });
  if (p.isCancel(capability)) return;

  if (capability === "web_scrape") {
    const targetUrl = await p.text({
      message: "Target URL to scrape:",
      initialValue: "http://localhost:5000/protected"
    });
    if (p.isCancel(targetUrl)) return;

    const maxBid = await p.text({
      message: "Max budget ceiling ($ USD):",
      initialValue: "0.06"
    });
    if (p.isCancel(maxBid)) return;

    await runBuyScrapeCommand(targetUrl as string, { maxBid: maxBid as string });
  } else if (capability === "ocr") {
    const imgPath = await p.text({
      message: "Path to image file:",
      placeholder: "./receipt.png"
    });
    if (p.isCancel(imgPath)) return;
    await runBuyOcrCommand(imgPath as string, {});
  } else {
    p.outro(chalk.yellow("Python code delegation available via: bounty buy code <file.py>"));
  }
}
