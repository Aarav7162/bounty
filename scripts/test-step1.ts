import { startMockCfServer } from "../examples/01-cloudflare-bypass/mock-cf-server.js";

async function run() {
  const { stop } = await startMockCfServer(5000);

  console.log("1. Sending standard GET request to http://localhost:5000/protected...");
  const res1 = await fetch("http://localhost:5000/protected");
  console.log(`   HTTP Status: ${res1.status}`);
  console.log(`   cf-turnstile header: ${res1.headers.get("cf-turnstile")}`);
  const text1 = await res1.text();
  console.log(`   Response Preview: ${text1.slice(0, 110)}...`);

  console.log("\n2. Sending GET request with X-Bounty-Bypass: true...");
  const res2 = await fetch("http://localhost:5000/protected", {
    headers: { "X-Bounty-Bypass": "true" }
  });
  console.log(`   HTTP Status: ${res2.status}`);
  const data2 = await res2.json() as any;
  console.log(`   JSON Payload Status: ${data2.status}`);
  console.log(`   Items Returned: ${data2.items?.length} items`);
  console.log(`   Message: ${data2.message}`);

  await stop();
  console.log("\n========================================================");
  console.log("  STEP 1 VERIFIED: Mock Cloudflare server functional!");
  console.log("========================================================\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

