import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { startMockCfServer } from "../examples/01-cloudflare-bypass/mock-cf-server.js";
import { BrokerServer, DualModePayPalService } from "../packages/broker/dist/index.js";
import { generateRfpId } from "../packages/protocol/dist/index.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });

async function main() {
  console.log("\n========================================================");
  console.log("  TESTING STEP 3: REAL CLI BYPASS & PAYPAL SANDBOX SETTLEMENT");
  console.log("========================================================\n");

  const CF_PORT = 5000;
  const BROKER_PORT = 4000;

  // 1. Start Mock Cloudflare Server on port 5000
  console.log("1. Starting Mock Cloudflare Server on port 5000...");
  const { stop: stopCf } = await startMockCfServer(CF_PORT);

  // 2. Start Broker on port 4000 with real PayPal Sandbox
  console.log(`2. Starting Bounty Broker on port ${BROKER_PORT} (PAYPAL_MODE=${process.env.PAYPAL_MODE})...`);
  const paypal = new DualModePayPalService();
  const broker = new BrokerServer({ port: BROKER_PORT, paypalService: paypal });
  await broker.start();
  console.log(`   Broker listening on ws://localhost:${BROKER_PORT}/ws/seller`);

  // Ensure bounty.config.json has web_scrape enabled
  const config = {
    nodeId: "seller_node_step3",
    payoutDestination: {
      type: "PAYPAL_EMAIL",
      value: process.env.PAYPAL_SELLER_EMAIL || "sb-sqcdl53128062@personal.example.com"
    },
    brokerUrl: `ws://localhost:${BROKER_PORT}/ws/seller`,
    capabilities: {
      web_scrape: {
        floorPriceUsd: 0.05,
        maxConcurrency: 2,
        description: "httpx + BeautifulSoup web scraping with bypass"
      }
    }
  };
  const configPath = resolve(process.cwd(), "bounty.step3.config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  // 3. Launch REAL 'bounty start' CLI process
  console.log("3. Launching real 'bounty start' worker process...");
  const cliBin = resolve(process.cwd(), "packages/cli/dist/index.js");
  const cliProcess = spawn("node", [cliBin, "start", "--config", configPath], {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"]
  });

  let cliRawOutput = "";
  cliProcess.stdout?.on("data", (d) => {
    const text = d.toString();
    cliRawOutput += text;
    process.stdout.write(text);
  });
  cliProcess.stderr?.on("data", (d) => process.stderr.write(d.toString()));

  // Wait for the real CLI to connect and register
  let registered = false;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const nodes = broker.matchingEngine.getConnectedNodes();
    if (nodes.some((n) => n.nodeId === "seller_node_step3")) {
      registered = true;
      console.log(`\n✓ Real CLI connected & registered: seller_node_step3`);
      break;
    }
  }

  if (!registered) {
    throw new Error("CLI failed to register with broker");
  }

  // 4. Manually POST RFP to /api/rfp with bypass constraint
  const rfpId = generateRfpId();
  console.log("\n4. POSTing manual RFP to /api/rfp:");
  console.log(`   capability_required: "web_scrape"`);
  console.log(`   constraints.required_bypass: ["cloudflare_turnstile"]`);
  console.log(`   constraints.target_url: "http://localhost:5000/protected"`);
  console.log(`   financials.bid_ceiling: 0.06\n`);

  const rfpPayload = {
    rfpId,
    buyerId: "buyer_agent_alpha",
    capability_required: "web_scrape",
    constraints: {
      target_url: "http://localhost:5000/protected",
      required_bypass: ["cloudflare_turnstile"],
      maxLatencyMs: 15000
    },
    financials: {
      bid_ceiling: 0.06,
      currency: "USD",
      settlementRail: "PAYPAL_PAYOUTS"
    }
  };

  const rfpRes = await fetch(`http://localhost:${BROKER_PORT}/api/rfp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rfpPayload)
  });

  const rfpResult = (await rfpRes.json()) as any;
  console.log(`   RFP Match Status: ${rfpResult.status} (Task ID: ${rfpResult.assignment?.taskId})`);

  // 5. Await task execution, SHA-256 verification, and real PayPal settlement
  console.log("\n5. Awaiting real execution, hash verification, and PayPal payout...");
  let settlementReceipt: any = null;
  let taskResult: any = null;

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const task = broker.matchingEngine.getTask(rfpResult.assignment?.taskId);
    if (task && task.receipt) {
      settlementReceipt = task.receipt;
      taskResult = task.result;
      break;
    }
  }

  if (!settlementReceipt) {
    throw new Error("Settlement was not completed within timeout");
  }

  // Allow TUI to update final frame
  await new Promise((r) => setTimeout(r, 1000));

  console.log("\n========================================================");
  console.log("  STEP 3 VERIFIED: REAL CLI BYPASS & REAL PAYPAL SETTLEMENT");
  console.log("========================================================");
  console.log("Returned JSON Data:");
  console.log(JSON.stringify(taskResult?.payload, null, 2));
  console.log("\nSHA-256 Digest:");
  console.log(taskResult?.sha256Digest);
  console.log("\nPayPal Settlement Details:");
  console.log(`  Batch ID:       ${settlementReceipt.paypalReferenceId}`);
  console.log(`  Status:         ${settlementReceipt.status}`);
  console.log(`  Amount:         $${settlementReceipt.amountUsd.toFixed(2)} USD`);
  console.log(`  Recipient:      ${settlementReceipt.recipientEmail}`);
  console.log(`  Explorer URL:   ${settlementReceipt.explorerUrl}`);
  console.log(`  PAYOUT_MODE:    ${process.env.PAYPAL_MODE}`);
  console.log("========================================================\n");

  // Cleanup
  cliProcess.kill("SIGTERM");
  await broker.stop();
  await stopCf();
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

