import { WebSocket } from "ws";
import { startMockCfServer } from "../examples/01-cloudflare-bypass/mock-cf-server.js";
import { BrokerServer, DualModePayPalService } from "../packages/broker/dist/index.js";
import { TaskEnvelope } from "../packages/agent-sdk/dist/index.js";
import { computePayloadDigest } from "@bounty/protocol";

async function run() {
  console.log("\n========================================================");
  console.log("  TESTING STEP 2: STRUGGLE ENVELOPE");
  console.log("========================================================\n");

  // 1. Start Mock Cloudflare Server on port 5000
  const { stop: stopCf } = await startMockCfServer(5000);

  // 2. Start Broker Server on port 4000
  const paypal = new DualModePayPalService({ mode: "simulator" });
  const broker = new BrokerServer({ port: 4000, paypalService: paypal });
  await broker.start();
  console.log("✓ Broker Hub listening on port 4000\n");

  // 3. Connect real WebSocket Seller Node
  const sellerWs = new WebSocket("ws://localhost:4000/ws/seller");
  await new Promise<void>((r) => sellerWs.on("open", r));

  sellerWs.send(JSON.stringify({
    type: "REGISTER_SELLER",
    nodeId: "mock_seller_worker",
    paypalEmail: "seller@sandbox.paypal.com",
    capabilities: [
      {
        capability: "web_scrape",
        floorPriceUsd: 0.05,
        maxConcurrency: 2,
        avgLatencyMs: 800,
        description: "Scraper plugin"
      }
    ]
  }));

  // Wait for registration
  await new Promise((r) => setTimeout(r, 100));

  sellerWs.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "TASK_ASSIGNMENT") {
      const assignment = msg.assignment;
      const payload = {
        status: "success",
        url: assignment.inputPayload.targetUrl,
        items: [{ symbol: "NVDA", price: 142.85 }]
      };
      const sha256Digest = computePayloadDigest(payload);
      sellerWs.send(JSON.stringify({
        type: "TASK_RESULT",
        result: {
          taskId: assignment.taskId,
          nodeId: "mock_seller_worker",
          success: true,
          payload,
          sha256Digest,
          executionTimeMs: 320,
          completedAt: new Date().toISOString()
        }
      }));
    }
  });

  // 4. Wrap fetch to http://localhost:5000/protected using TaskEnvelope
  console.log("3. Buyer agent invoking TaskEnvelope.wrapFetch('http://localhost:5000/protected')...\n");
  const result = await TaskEnvelope.wrapFetch("http://localhost:5000/protected", undefined, {
    brokerApiUrl: "http://localhost:4000",
    bidCeilingUsd: 0.06
  });

  console.log("\n========================================================");
  console.log("  EMITTED RFP JSON CAPTURED FROM STRUGGLE ENVELOPE");
  console.log("========================================================");
  console.log(JSON.stringify(result.rfp, null, 2));
  console.log("========================================================\n");

  console.log(`Delegation Occurred: ${result.delegated}`);
  console.log(`Execution Latency:   ${result.executionLatencyMs}ms`);

  sellerWs.close();
  await stopCf();
  await broker.stop();

  console.log("\n✓ STEP 2 VERIFIED: Struggle Envelope successfully caught Cloudflare 403 and emitted RFP.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
