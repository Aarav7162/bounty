import { spawn, ChildProcess } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { BrokerServer, DualModePayPalService } from "../packages/broker/dist/index.js";
import { generateRfpId } from "../packages/protocol/dist/index.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });

async function main() {
  console.log("\n========================================================");
  console.log("  TESTING BOUNTY CLI + REAL PAYPAL SANDBOX FLOW");
  console.log("========================================================\n");

  const PORT = 4000;

  // Step 1: Write bounty.config.json as configured by bounty init
  const config = {
    nodeId: "node_mumbai_01",
    payoutDestination: {
      type: "PAYPAL_EMAIL",
      value: process.env.PAYPAL_SELLER_EMAIL || "sb-sqcdl53128062@personal.example.com"
    },
    brokerUrl: `ws://localhost:${PORT}/ws/seller`,
    capabilities: {
      python_code: {
        floorPriceUsd: 0.25,
        maxConcurrency: 2,
        description: "Python code execution, unit testing and bug fixing"
      },
      ocr: {
        floorPriceUsd: 0.20,
        maxConcurrency: 2,
        description: "Tesseract OCR engine"
      },
      web_scrape: {
        floorPriceUsd: 0.05,
        maxConcurrency: 2,
        description: "httpx + BeautifulSoup web scraping"
      }
    }
  };

  const configPath = resolve(process.cwd(), "bounty.config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  console.log(`✓ 1. bounty.config.json created with capabilities: python_code ($0.25), ocr ($0.20), web_scrape ($0.05)`);

  // Step 2: Start Broker Server with real PayPal Sandbox
  console.log(`✓ 2. Starting Bounty Broker on port ${PORT} (PAYPAL_MODE=${process.env.PAYPAL_MODE || 'sandbox'})...`);
  const paypal = new DualModePayPalService();
  const broker = new BrokerServer({ port: PORT, paypalService: paypal });
  await broker.start();
  console.log(`   Broker listening on ws://localhost:${PORT}/ws/seller`);

  // Step 3: Launch CLI 'bounty start'
  console.log(`✓ 3. Launching 'bounty start' daemon...`);
  const cliBin = resolve(process.cwd(), "packages/cli/dist/index.js");
  const cliProcess = spawn("node", [cliBin, "start", "--config", configPath], {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"]
  });

  let cliOutputBuffer = "";
  cliProcess.stdout?.on("data", (d) => {
    const text = d.toString();
    cliOutputBuffer += text;
    process.stdout.write(text);
  });
  cliProcess.stderr?.on("data", (d) => {
    process.stderr.write(d.toString());
  });

  // Wait for node to register
  let nodeRegistered = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const nodes = broker.matchingEngine.getConnectedNodes();
    if (nodes.length > 0) {
      nodeRegistered = true;
      console.log(`\n✓ Node registered with broker: ${nodes[0].nodeId} (${nodes[0].capabilities.size} capabilities)`);
      break;
    }
  }

  if (!nodeRegistered) {
    throw new Error("CLI failed to register with broker");
  }

  // Step 4: Emit RFP for python_code: "Fix month-end rollover in billing.py"
  const rfpId = generateRfpId();
  console.log(`\n✓ 4. Emitting RFP to /api/rfp:`);
  console.log(`   Task: "Fix month-end rollover in billing.py"`);
  console.log(`   Ceiling: $0.30 USD | Capability: python_code\n`);

  const rfpPayload = {
    rfpId,
    buyerId: "buyer_agent_alpha",
    capability: "python_code",
    taskGoal: "Fix month-end rollover in billing.py",
    inputPayload: {
      task_description: "Fix month-end rollover in billing.py",
      source_code: "# bug: month rollover crashes on Jan 31"
    },
    constraints: {
      maxLatencyMs: 15000,
      requiredFeatures: ["subprocess_execution"],
      outputFormat: "application/json"
    },
    budget: {
      bidCeilingUsd: 0.30,
      currency: "USD",
      settlementRail: "PAYPAL_PAYOUTS"
    },
    verificationSpec: {
      requireSha256: true,
      requiredKeys: ["fixedCode", "verified"]
    },
    createdAt: new Date().toISOString()
  };

  const rfpRes = await fetch(`http://localhost:${PORT}/api/rfp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rfpPayload)
  });

  const rfpResult = await rfpRes.json() as any;
  console.log(`   RFP Dispatch Status: ${rfpResult.status} (Task ID: ${rfpResult.assignment?.taskId})`);

  // Wait for settlement receipt
  console.log(`\n✓ 5. Awaiting CLI execution & PayPal Payout settlement...`);
  let settledReceipt: any = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const settlements = paypal.getAllSettlements();
    settledReceipt = settlements.find((s) => s.rfpId === rfpId);
    if (settledReceipt) {
      break;
    }
  }

  if (!settledReceipt) {
    throw new Error("Payout settlement was not completed within timeout");
  }

  // Allow TUI to update final frame
  await new Promise((r) => setTimeout(r, 1000));

  console.log("\n========================================================");
  console.log("  REAL PAYPAL PAYOUT VERIFIED FOR CLI TASK");
  console.log("========================================================");
  console.log(`Task ID:         ${settledReceipt.taskId}`);
  console.log(`Real Batch ID:   ${settledReceipt.paypalReferenceId}`);
  console.log(`Settled Amount:  $${settledReceipt.amountUsd.toFixed(2)} USD`);
  console.log(`Recipient:       ${settledReceipt.recipientEmail}`);
  console.log(`Status:          ${settledReceipt.status}`);
  console.log(`Explorer URL:    ${settledReceipt.explorerUrl}`);
  console.log("========================================================\n");

  // Clean shutdown
  cliProcess.kill("SIGTERM");
  await broker.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

