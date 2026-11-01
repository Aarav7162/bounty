import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalJsonStringify,
  computePayloadDigest,
  verifyPayloadDigest,
  generateTaskId,
  generateRfpId,
  RFPRequestSchema,
  BidOfferSchema,
  TaskResultSchema,
  SettlementReceiptSchema,
  StruggleEnvelope,
  PayPalCreatePayoutRequestSchema
} from "../src/index.js";

describe("Bounty Protocol Suite", () => {
  it("computes deterministic SHA-256 digests regardless of object key order", () => {
    const payloadA = { b: 2, a: 1, c: { y: 20, x: 10 } };
    const payloadB = { c: { x: 10, y: 20 }, a: 1, b: 2 };

    assert.equal(canonicalJsonStringify(payloadA), canonicalJsonStringify(payloadB));

    const hashA = computePayloadDigest(payloadA);
    const hashB = computePayloadDigest(payloadB);

    assert.equal(hashA, hashB);
    assert.equal(hashA.length, 64);
    assert.ok(verifyPayloadDigest(payloadA, hashB));
    assert.ok(verifyPayloadDigest(payloadA, `sha256:${hashB}`));
    assert.ok(!verifyPayloadDigest(payloadA, "invalid_hash_value"));
  });

  it("generates correctly formatted entity IDs", () => {
    const taskId = generateTaskId();
    const rfpId = generateRfpId();
    assert.match(taskId, /^bnt_[a-z0-9]+_[a-f0-9]+$/);
    assert.match(rfpId, /^rfp_[a-z0-9]+_[a-f0-9]+$/);
  });

  it("validates RFPRequest and BidOffer schemas rigorously", () => {
    const validRfp = {
      rfpId: generateRfpId(),
      buyerId: "buyer_agent_alpha",
      capability: "residential_scrape",
      taskGoal: "Scrape e-commerce live prices",
      inputPayload: { targetUrl: "https://example.com/products" },
      constraints: {
        maxLatencyMs: 8000,
        requiredFeatures: ["bypass_turnstile"],
        targetUrl: "https://example.com/products",
        outputFormat: "application/json"
      },
      budget: {
        bidCeilingUsd: 0.08,
        currency: "USD",
        settlementRail: "PAYPAL_PAYOUTS"
      },
      verificationSpec: {
        requireSha256: true,
        requiredKeys: ["products", "timestamp"]
      },
      createdAt: new Date().toISOString()
    };

    const parsedRfp = RFPRequestSchema.safeParse(validRfp);
    assert.ok(parsedRfp.success, "Valid RFP should parse without error");

    const validBid = {
      bidId: "bid_123",
      rfpId: validRfp.rfpId,
      nodeId: "node_mumbai_res_01",
      sellerPaypalEmail: "seller@sandbox.paypal.com",
      quotePriceUsd: 0.05,
      estimatedLatencyMs: 1400,
      reputationScore: 98,
      createdAt: new Date().toISOString()
    };

    const parsedBid = BidOfferSchema.safeParse(validBid);
    assert.ok(parsedBid.success, "Valid BidOffer should parse without error");

    // Invalid budget (> $25 ceiling limit)
    const invalidRfp = { ...validRfp, budget: { ...validRfp.budget, bidCeilingUsd: 100.0 } };
    const parsedInvalid = RFPRequestSchema.safeParse(invalidRfp);
    assert.ok(!parsedInvalid.success, "Over-budget RFP must be rejected");
  });

  it("triggers Struggle Envelope on Cloudflare bot detection and emits RFP", () => {
    const envelope = new StruggleEnvelope({
      taskId: "task_test_01",
      taskGoal: "Scrape protected financial data",
      capabilityNeeded: "residential_scrape",
      targetUrl: "https://protected-market.com/rates",
      bidCeilingUsd: 0.07,
      maxLocalAttempts: 2
    });

    assert.equal(envelope.getState(), "INTERNAL_EXECUTION");

    // Simulated local run encountering Cloudflare Turnstile challenge
    const evaluation = envelope.evaluateError(
      new Error("Cloudflare Ray ID: 8847bc12 - Challenge Required"),
      403,
      "<div class='cf-turnstile' data-sitekey='xxx'></div>"
    );

    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.shouldDelegate, true);
    assert.equal(envelope.getState(), "MARKET_BROADCAST");
    assert.ok(evaluation.rfp, "RFP must be automatically generated upon trigger");
    assert.equal(evaluation.rfp?.capability, "residential_scrape");
    assert.equal(evaluation.rfp?.budget.bidCeilingUsd, 0.07);
    assert.equal(evaluation.rfp?.constraints.targetUrl, "https://protected-market.com/rates");
  });

  it("triggers Struggle Envelope on low entropy soft error after max local attempts", () => {
    const envelope = new StruggleEnvelope({
      taskId: "task_test_02",
      taskGoal: "Extract full financial balance sheet",
      capabilityNeeded: "forensic_ocr",
      bidCeilingUsd: 0.25,
      maxLocalAttempts: 2,
      minEntropyCharacters: 100
    });

    // Attempt 1: Garbage / suspiciously short string returned
    const eval1 = envelope.evaluateOutput("Error: blank page");
    assert.equal(eval1.passed, false);
    assert.equal(eval1.shouldDelegate, false); // Still under maxLocalAttempts
    assert.equal(envelope.getState(), "STRUGGLING");

    // Attempt 2: Still suspiciously short
    const eval2 = envelope.evaluateOutput("Scan unreadable");
    assert.equal(eval2.passed, false);
    assert.equal(eval2.shouldDelegate, true); // Reached maxLocalAttempts (2)
    assert.equal(envelope.getState(), "MARKET_BROADCAST");
    assert.ok(eval2.rfp);
    assert.equal(eval2.rfp?.capability, "forensic_ocr");
    assert.equal(eval2.rfp?.budget.bidCeilingUsd, 0.25);
  });

  it("validates PayPal Payout API schema", () => {
    const payoutReq = {
      sender_batch_header: {
        sender_batch_id: "batch_bnt_001",
        email_subject: "Bounty payout",
        email_message: "Automated sub-task settlement"
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: "0.06", currency: "USD" },
          receiver: "seller@sandbox.paypal.com",
          sender_item_id: "task_bnt_001",
          recipient_wallet: "PAYPAL"
        }
      ]
    };

    const parsed = PayPalCreatePayoutRequestSchema.safeParse(payoutReq);
    assert.ok(parsed.success, "PayPal payout payload should be valid");
  });
});

