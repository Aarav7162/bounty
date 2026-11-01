import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";
import chalk from "chalk";
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
    console.log(chalk.white.bold("  Bounty Buyer Delegation") + chalk.gray(` · RFP: ${rfpId}`));
    console.log(chalk.gray("  " + "─".repeat(68)));
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
    console.log(`  ${chalk.cyan("[trap]")}     ${chalk.white("Roadblock Trapped")}       ${chalk.gray(`[${statusTrapDesc}]`)}`);
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
      console.log(`  ${chalk.red("[ERR]")}      ${chalk.red("RFP Broadcast Failed")}    ${chalk.gray(`[${errText}]`)}`);
      console.log(chalk.gray("  " + "─".repeat(68)));
    }
    throw new Error(`Failed to match RFP: ${errText}`);
  }

  const matchData = (await rfpRes.json()) as any;
  const assignment = matchData.assignment;

  if (!isJsonOnly && !options.quiet) {
    console.log(`  ${chalk.cyan("[rfp]")}      ${chalk.white("RFP Broadcasted")}         ${chalk.gray(`[web_scrape · Ceiling: $${bidCeiling.toFixed(2)}]`)}`);
    if (pauseMs > 0) await sleep(pauseMs);

    console.log(`  ${chalk.cyan("[match]")}    ${chalk.white("Orderbook Matched")}       ${chalk.gray(`[Node: ${chalk.cyan(assignment.nodeId)} · $${assignment.agreedPriceUsd.toFixed(2)} USD]`)}`);
    if (pauseMs > 0) await sleep(pauseMs);
  }

  // Step 3: Poll for Settlement & Verified Result
  const maxTimeout = options.timeout ? parseInt(options.timeout, 10) : (profile.buyer.defaultTimeoutMs || 30000);
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
      console.log(`  ${chalk.red("[ERR]")}      ${chalk.red("Settlement Timeout")}       ${chalk.gray(`[Node ${assignment.nodeId} failed to report]`)}`);
      console.log(chalk.gray("  " + "─".repeat(68)));
    }
    throw new Error(`Execution timed out waiting for worker ${assignment.nodeId}`);
  }

  const result = settledTask.result;
  const receipt = settledTask.receipt;
  const verifiedDigest = computePayloadDigest(result.payload);
  const isDigestValid = verifiedDigest === result.sha256Digest;

  recordBuyerSpend(assignment.agreedPriceUsd);

  if (!isJsonOnly && !options.quiet) {
    const proofLabel = isDigestValid ? `${result.sha256Digest.slice(0, 10)}... [verified]` : "INVALID";
    console.log(`  ${chalk.cyan("[proof]")}    ${chalk.white("SHA-256 Verified")}        ${chalk.green(`[${proofLabel}]`)}`);
    if (pauseMs > 0) await sleep(pauseMs);

    console.log(`  ${chalk.green("[settle]")}   ${chalk.white("PayPal Rails Settled")}    ${chalk.green(`[Batch: ${receipt.paypalReferenceId} · $${assignment.agreedPriceUsd.toFixed(2)} USD]`)}`);
    console.log(chalk.gray("  " + "─".repeat(68)));

    const latencySec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`  ${chalk.gray("Status:")} ${chalk.green.bold("COMPLETED")}  ${chalk.gray("·")}  ${chalk.gray("Paid:")} ${chalk.yellow(`$${assignment.agreedPriceUsd.toFixed(2)} USD`)}  ${chalk.gray("·")}  ${chalk.gray("Time:")} ${chalk.white(`${latencySec}s`)}`);
    console.log("");
  }

  const payload = result.payload?.data ?? result.payload;
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else if (options.raw) {
    console.log(typeof payload === "string" ? payload : JSON.stringify(payload));
  } else if (!options.quiet) {
    console.log(chalk.gray("  [Task Output]"));
    console.log(JSON.stringify(payload, null, 2));
    console.log("");
  }
}

export async function runBuyOcrCommand(imagePath: string, options: BuyOptions): Promise<void> {
  const fullPath = resolve(process.cwd(), imagePath);
  if (!existsSync(fullPath)) {
    console.error(chalk.red(`  [ERROR] Image file not found: ${fullPath}`));
    process.exit(1);
  }

  const imageBuffer = readFileSync(fullPath);
  const imageBase64 = imageBuffer.toString("base64");

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
  console.log(`  ${chalk.cyan("[match]")}    Matched OCR worker ${assignment.nodeId} for $${assignment.agreedPriceUsd.toFixed(2)} USD`);

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
  console.log(`  ${chalk.green("[settle]")}   Settled via PayPal: Batch ${settledTask.receipt.paypalReferenceId}`);
  console.log("\n  [Extracted OCR Text]");
  console.log(text);
}

export async function runBuyWizard(): Promise<void> {
  console.log("");
  console.log(chalk.white.bold("  Bounty Buyer Delegation Wizard"));
  console.log(chalk.gray("  " + "─".repeat(68)));
  console.log(chalk.gray("  1) Web Scrape (with anti-bot / Turnstile bypass)"));
  console.log(chalk.gray("  2) OCR Text Extraction (extract text from image bytes)"));
  console.log(chalk.gray("  3) Python Sandbox Code Execution"));
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = (q: string, def: string) =>
    new Promise<string>((res) =>
      rl.question(chalk.gray(`  ${q} `) + chalk.cyan(`[${def}]: `), (ans) => res(ans.trim() || def))
    );

  try {
    const choice = await prompt("Select delegation capability (1/2/3)", "1");

    if (choice === "1" || choice.toLowerCase() === "scrape") {
      const targetUrl = await prompt("Target URL to scrape", "http://localhost:5000/protected");
      const maxBid = await prompt("Max budget ceiling ($ USD)", "0.06");
      await runBuyScrapeCommand(targetUrl, { maxBid });
    } else if (choice === "2" || choice.toLowerCase() === "ocr") {
      const imgPath = await prompt("Path to image file", "./receipt.png");
      await runBuyOcrCommand(imgPath, {});
    } else {
      console.log(chalk.yellow("  Python code delegation available via: bounty buy code <file.py>"));
    }
  } finally {
    rl.close();
  }
}
