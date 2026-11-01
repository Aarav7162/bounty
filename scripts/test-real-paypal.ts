import dotenv from "dotenv";
import { resolve } from "node:path";
import { DualModePayPalService } from "../packages/broker/dist/paypal.js";
import { generateRfpId, generateTaskId } from "../packages/protocol/dist/crypto.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });

async function main() {
  console.log("\n========================================================");
  console.log("  TESTING REAL PAYPAL SANDBOX SETTLEMENT");
  console.log("========================================================");
  console.log(`PAYPAL_MODE:        ${process.env.PAYPAL_MODE}`);
  console.log(`PAYPAL_CLIENT_ID:   ${process.env.PAYPAL_CLIENT_ID?.slice(0, 10)}...`);
  console.log(`PAYPAL_SELLER:      ${process.env.PAYPAL_SELLER_EMAIL}`);
  console.log(`PAYPAL_BUYER:       ${process.env.PAYPAL_BUYER_EMAIL}`);

  const paypal = new DualModePayPalService();
  console.log(`Active Service Mode: ${paypal.getMode()}`);

  if (paypal.getMode() !== "sandbox" && paypal.getMode() !== "live") {
    throw new Error(`Expected sandbox or live mode, got: ${paypal.getMode()}`);
  }

  console.log("\n1. Testing PayPal OAuth 2.0 Client Credentials token...");
  const token = await paypal.getAccessToken();
  console.log(`✓ Access Token acquired: ${token.slice(0, 15)}... (len: ${token.length})`);

  const rfpId = generateRfpId();
  const taskId = generateTaskId();
  const amountUsd = 0.25;
  const recipientEmail = process.env.PAYPAL_SELLER_EMAIL || "sb-sqcdl53128062@personal.example.com";

  console.log(`\n2. Triggering POST /v1/payments/payouts...`);
  console.log(`   rfpId (sender_batch_id): ${rfpId}`);
  console.log(`   recipient:               ${recipientEmail}`);
  console.log(`   amount:                  $${amountUsd} USD`);

  const receipt = await paypal.settlePayout({
    rfpId,
    taskId,
    recipientEmail,
    amountUsd,
    note: `Bounty Verified Subtask Execution - ${taskId}`
  });

  console.log("\n========================================================");
  console.log("  REAL PAYPAL SANDBOX PAYOUT COMPLETED");
  console.log("========================================================");
  console.log(`Settlement ID:       ${receipt.settlementId}`);
  console.log(`Real Batch ID:       ${receipt.paypalReferenceId}`);
  console.log(`Final Status:        ${receipt.status}`);
  console.log(`Sender:              ${receipt.senderEmail}`);
  console.log(`Recipient:           ${receipt.recipientEmail}`);
  console.log(`Amount:              $${receipt.amountUsd.toFixed(2)} USD`);
  console.log(`Fee:                 $${receipt.feeUsd.toFixed(2)} USD`);
  console.log(`Net Payout:          $${receipt.netPayoutUsd.toFixed(2)} USD`);
  console.log(`Settled At:          ${receipt.settledAt}`);
  console.log(`Explorer URL:        ${receipt.explorerUrl}`);
  console.log("========================================================\n");

  // Query PayPal API directly for confirmation
  console.log(`3. Querying GET /v1/payments/payouts/${receipt.paypalReferenceId} ...`);
  const checkRes = await fetch(`https://api-m.sandbox.paypal.com/v1/payments/payouts/${receipt.paypalReferenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (checkRes.ok) {
    const checkData = await checkRes.json() as any;
    console.log(`✓ PayPal Server Verified: Batch Status = ${checkData.batch_header?.batch_status}`);
    console.log(`  Items Count:           ${checkData.batch_header?.batch_entity_count ?? checkData.items?.length ?? 1}`);
  } else {
    console.log(`Note: Direct batch lookup returned HTTP ${checkRes.status}`);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in PayPal test:", err);
  process.exit(1);
});

