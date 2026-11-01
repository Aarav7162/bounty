import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import {
  computePayloadDigest,
  generateRfpId,
  RFPRequest
} from "@bounty/protocol";
import { BrokerServer } from "../src/server.js";
import { DualModePayPalService } from "../src/paypal.js";
import { TelemetryEvent } from "../src/types.js";

describe("Bounty Broker Hub & PayPal Engine Suite", () => {
  const TEST_PORT = 4928;
  let server: BrokerServer;

  before(async () => {
    server = new BrokerServer({
      port: TEST_PORT,
      heartbeatIntervalMs: 200, // Fast heartbeat for test
      paypalService: new DualModePayPalService({ mode: "simulator" })
    });
    await server.start();
  });

  after(async () => {
    await server.stop();
  });

  it("serves HTTP health check with active PayPal mode", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/health`);
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.status, "ok");
    assert.equal(data.paypalMode, "simulator");
  });

  it("enforces strict idempotency in PayPal settlements using rfpId", async () => {
    const paypal = new DualModePayPalService({ mode: "simulator" });
    const rfpId = generateRfpId();

    const payout1 = await paypal.settlePayout({
      rfpId,
      taskId: "task_idemp_01",
      recipientEmail: "seller@sandbox.paypal.com",
      amountUsd: 0.05
    });

    assert.equal(payout1.status, "SUCCESS");
    assert.equal(payout1.amountUsd, 0.05);
    assert.equal(payout1.paypalReferenceId, `PAYOUT-SIM-${rfpId}`);

    // Second call with same rfpId must return the exact same settlement
    const payout2 = await paypal.settlePayout({
      rfpId,
      taskId: "task_idemp_01",
      recipientEmail: "seller@sandbox.paypal.com",
      amountUsd: 0.05
    });

    assert.equal(payout2.settlementId, payout1.settlementId);
    assert.equal(payout2.paypalReferenceId, payout1.paypalReferenceId);
  });

  it("connects seller, matches RFP, verifies SHA-256, settles payout, and streams telemetry", async () => {
    // 1. Connect telemetry listener
    const telemetryEvents: TelemetryEvent[] = [];
    const telemetryWs = new WebSocket(`ws://localhost:${TEST_PORT}/ws/telemetry`);

    await new Promise<void>((resolve) => {
      telemetryWs.on("open", resolve);
    });

    telemetryWs.on("message", (raw) => {
      telemetryEvents.push(JSON.parse(raw.toString()));
    });

    // 2. Connect Seller Node
    const sellerWs = new WebSocket(`ws://localhost:${TEST_PORT}/ws/seller`);
    await new Promise<void>((resolve) => {
      sellerWs.on("open", resolve);
    });

    // Register seller node
    const nodeId = "seller_node_test_01";
    sellerWs.send(
      JSON.stringify({
        type: "REGISTER_SELLER",
        nodeId,
        paypalEmail: "worker-node@sandbox.paypal.com",
        capabilities: [
          {
            capability: "residential_scrape",
            floorPriceUsd: 0.04,
            maxConcurrency: 2,
            avgLatencyMs: 1200
          }
        ]
      })
    );

    // Wait for registration acknowledgement
    await new Promise<void>((resolve) => {
      const handler = (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "REGISTERED") {
          sellerWs.off("message", handler);
          resolve();
        }
      };
      sellerWs.on("message", handler);
    });

    // Verify node is registered in HTTP nodes API
    const nodesRes = await fetch(`http://localhost:${TEST_PORT}/api/nodes`);
    const nodes = await nodesRes.json() as any[];
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].nodeId, nodeId);

    // 3. Buyer Agent broadcasts an RFP
    const rfpId = generateRfpId();
    const rfp: RFPRequest = {
      rfpId,
      buyerId: "buyer_agent_alpha",
      capability: "residential_scrape",
      taskGoal: "Scrape protected prices",
      inputPayload: { targetUrl: "https://protected-site.com/data" },
      constraints: {
        maxLatencyMs: 10000,
        requiredFeatures: ["bypass_turnstile"],
        targetUrl: "https://protected-site.com/data",
        outputFormat: "application/json"
      },
      budget: {
        bidCeilingUsd: 0.06, // ceiling >= floor (0.04) -> match!
        currency: "USD",
        settlementRail: "PAYPAL_PAYOUTS"
      },
      verificationSpec: {
        requireSha256: true,
        requiredKeys: ["extractedItems", "timestamp"]
      },
      createdAt: new Date().toISOString()
    };

    // Seller listens for task assignment
    const assignmentPromise = new Promise<any>((resolve) => {
      sellerWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "TASK_ASSIGNMENT") {
          resolve(msg.assignment);
        }
      });
    });

    // Post RFP via Broker HTTP API
    const rfpRes = await fetch(`http://localhost:${TEST_PORT}/api/rfp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rfp)
    });
    assert.equal(rfpRes.status, 200);

    const assignment = await assignmentPromise;
    assert.equal(assignment.rfpId, rfpId);
    assert.equal(assignment.nodeId, nodeId);
    assert.equal(assignment.agreedPriceUsd, 0.04); // floor price accepted

    // 4. Seller executes task, hashes output, and submits result
    const resultPayload = {
      extractedItems: [{ item: "GPU Model A", price: 499 }],
      timestamp: new Date().toISOString(),
      proxyType: "residential_us"
    };
    const sha256Digest = computePayloadDigest(resultPayload);

    const settlementPromise = new Promise<any>((resolve) => {
      sellerWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "PAYOUT_SETTLED") {
          resolve(msg.receipt);
        }
      });
    });

    sellerWs.send(
      JSON.stringify({
        type: "TASK_RESULT",
        result: {
          taskId: assignment.taskId,
          nodeId,
          success: true,
          payload: resultPayload,
          sha256Digest,
          executionTimeMs: 450,
          completedAt: new Date().toISOString()
        }
      })
    );

    const receipt = await settlementPromise;
    assert.equal(receipt.taskId, assignment.taskId);
    assert.equal(receipt.status, "SUCCESS");
    assert.equal(receipt.recipientEmail, "worker-node@sandbox.paypal.com");
    assert.equal(receipt.amountUsd, 0.04);
    assert.equal(receipt.sha256Verified, true);
    assert.equal(receipt.paypalReferenceId, `PAYOUT-SIM-${rfpId}`);

    // Wait a brief tick for telemetry relay
    await new Promise((r) => setTimeout(r, 100));

    // Verify telemetry captured life cycle events
    const eventTypes = telemetryEvents.map((e) => e.type);
    assert.ok(eventTypes.includes("NODE_REGISTERED"));
    assert.ok(eventTypes.includes("RFP_EMITTED"));
    assert.ok(eventTypes.includes("TASK_MATCHED"));
    assert.ok(eventTypes.includes("HASH_VERIFIED"));
    assert.ok(eventTypes.includes("PAYOUT_SETTLED"));

    // Cleanup
    sellerWs.close();
    telemetryWs.close();
  });

  it("instantly evicts a disconnected seller node from active pool", async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws/seller`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    const tempNodeId = "temp_seller_node";
    ws.send(
      JSON.stringify({
        type: "REGISTER_SELLER",
        nodeId: tempNodeId,
        paypalEmail: "temp@example.com",
        capabilities: [
          {
            capability: "forensic_ocr",
            floorPriceUsd: 0.15,
            maxConcurrency: 1
          }
        ]
      })
    );

    // Wait for registration
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(server.matchingEngine.getConnectedNodes().some((n) => n.nodeId === tempNodeId));

    // Abruptly terminate socket
    ws.terminate();

    // Wait brief tick for close event handler
    await new Promise((r) => setTimeout(r, 100));

    // Node must be evicted immediately
    assert.ok(!server.matchingEngine.getConnectedNodes().some((n) => n.nodeId === tempNodeId));
  });
});

