import dotenv from "dotenv";
import { resolve } from "node:path";
import { BrokerServer } from "./server.js";

// Load .env from root workspace if present
dotenv.config({ path: resolve(process.cwd(), "../../.env") });
dotenv.config();

export * from "./types.js";
export * from "./paypal.js";
export * from "./matching.js";
export * from "./server.js";

// If run directly via node/tsx
const isDirectRun = process.argv[1]?.includes("broker") || process.argv[1]?.includes("src/index.ts");
if (isDirectRun) {
  const port = Number(process.env.BOUNTY_BROKER_PORT || 4000);
  const server = new BrokerServer({ port });

  server.start().then(() => {
    console.log(`\n========================================================`);
    console.log(`  BOUNTY BROKER HUB ONLINE`);
    console.log(`  HTTP API:        http://localhost:${port}`);
    console.log(`  Seller WS:       ws://localhost:${port}/ws/seller`);
    console.log(`  Telemetry WS:    ws://localhost:${port}/ws/telemetry`);
    console.log(`  PayPal Mode:     ${server.paypalService.getMode().toUpperCase()}`);
    console.log(`========================================================\n`);
  });

  const shutdown = async () => {
    console.log("\nShutting down Bounty Broker...");
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

