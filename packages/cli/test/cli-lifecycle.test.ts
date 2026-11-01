import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { BrokerServer, DualModePayPalService } from "@bounty/broker";
import { ExecutionSandbox } from "../src/worker/sandbox.js";
import { computePayloadDigest } from "@bounty/protocol";

describe("Bounty CLI Suite", () => {
  const TEST_PORT = 4955;
  const TEST_CONFIG_PATH = resolve(process.cwd(), "bounty.test.config.json");
  let server: BrokerServer;
  let cliProcess: ChildProcess;

  before(async () => {
    // 1. Start test Broker
    server = new BrokerServer({
      port: TEST_PORT,
      paypalService: new DualModePayPalService({ mode: "simulator" })
    });
    await server.start();

    // 2. Write temporary test config
    const testConfig = {
      nodeId: "test_cli_node_alpha",
      payoutDestination: {
        type: "PAYPAL_EMAIL",
        value: "cli-seller@sandbox.paypal.com"
      },
      brokerUrl: `ws://localhost:${TEST_PORT}/ws/seller`,
      capabilities: {
        residential_scrape: {
          floorPriceUsd: 0.05,
          maxConcurrency: 2,
          description: "Proxy scraping plugin"
        }
      }
    };
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig, null, 2), "utf8");
  });

  after(async () => {
    if (cliProcess) {
      cliProcess.kill("SIGTERM");
    }
    await server.stop();
    if (existsSync(TEST_CONFIG_PATH)) {
      unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it("executes simulated sandbox with realistic payload and valid SHA-256 digest", async () => {
    const sandbox = new ExecutionSandbox();
    const assignment = {
      taskId: "task_sb_01",
      rfpId: "rfp_sb_01",
      buyerId: "buyer_agent_alpha",
      nodeId: "node_sb_01",
      sellerPaypalEmail: "seller@sandbox.paypal.com",
      agreedPriceUsd: 0.05,
      inputPayload: { targetUrl: "https://example.com/products" },
      capability: "residential_scrape" as const,
      deadlineAt: new Date(Date.now() + 10000).toISOString(),
      assignedAt: new Date().toISOString()
    };

    let reportedStages: string[] = [];
    const result = await sandbox.executeTask(assignment, (stage) => {
      reportedStages.push(stage);
    });

    assert.equal(result.success, true);
    assert.equal(result.taskId, "task_sb_01");
    assert.ok(reportedStages.length >= 2, "Sandbox must report progress stages");
    assert.ok(result.executionTimeMs >= 1000, "Execution delay must simulate real workload");
    assert.equal(result.sha256Digest, computePayloadDigest(result.payload));
  });

  it("runs CLI daemon, auto-registers with broker, claims RFP, and receives PayPal payout", async () => {
    // Spawn CLI daemon in background
    const cliPath = resolve(process.cwd(), "packages/cli/dist/index.js");
    cliProcess = spawn("node", [cliPath, "start", "--config", TEST_CONFIG_PATH], {
      env: { ...process.env, NODE_ENV: "test" },
      stdio: "pipe"
    });

    // Wait for node to connect and register with broker
    let registered = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const nodesRes = await fetch(`http://localhost:${TEST_PORT}/api/nodes`);
      const nodes = (await nodesRes.json()) as any[];
      if (nodes.some((n) => n.nodeId === "test_cli_node_alpha")) {
        registered = true;
        break;
      }
    }
    assert.ok(registered, "CLI node must appear in broker connected nodes list");

    // Post RFP to broker
    const rfp = {
      rfpId: "rfp_cli_test_99",
      buyerId: "buyer_test_agent",
      capability: "residential_scrape",
      taskGoal: "Extract dynamic stock quote data",
      inputPayload: { targetUrl: "https://market.example.com" },
      constraints: {
        maxLatencyMs: 15000,
        requiredFeatures: ["bypass_turnstile"],
        targetUrl: "https://market.example.com",
        outputFormat: "application/json"
      },
      budget: {
        bidCeilingUsd: 0.06,
        currency: "USD",
        settlementRail: "PAYPAL_PAYOUTS"
      },
      verificationSpec: {
        requireSha256: true,
        requiredKeys: ["extractedItems", "status"]
      },
      createdAt: new Date().toISOString()
    };

    const rfpRes = await fetch(`http://localhost:${TEST_PORT}/api/rfp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rfp)
    });
    assert.equal(rfpRes.status, 200);

    // Poll until settlement receipt appears in broker
    let settled = false;
    let receipt: any = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const stlRes = await fetch(`http://localhost:${TEST_PORT}/api/settlements`);
      const settlements = (await stlRes.json()) as any[];
      receipt = settlements.find((s) => s.rfpId === "rfp_cli_test_99");
      if (receipt) {
        settled = true;
        break;
      }
    }

    assert.ok(settled, "Settlement receipt must be recorded in broker ledger");
    assert.equal(receipt.status, "SUCCESS");
    assert.equal(receipt.recipientEmail, "cli-seller@sandbox.paypal.com");
    assert.equal(receipt.amountUsd, 0.05);
    assert.equal(receipt.sha256Verified, true);
    assert.equal(receipt.paypalReferenceId, "PAYOUT-SIM-rfp_cli_test_99");
  });
});

