import { z } from "zod";

/**
 * Supported capabilities on the Bounty network
 */
export const CapabilityTypeEnum = z.enum([
  "python_code",
  "ocr",
  "web_scrape",
  "residential_scrape",
  "turnstile_bypass",
  "forensic_ocr",
  "sandbox_math_eval",
  "custom"
]);
export type CapabilityType = z.infer<typeof CapabilityTypeEnum>;

/**
 * Capability definition registered by seller worker nodes
 */
export const CapabilityRegistrationSchema = z.object({
  capability: CapabilityTypeEnum,
  floorPriceUsd: z.number().min(0.01).max(50.0),
  maxConcurrency: z.number().int().min(1).default(1),
  avgLatencyMs: z.number().optional().default(1500),
  description: z.string().optional()
});
export type CapabilityRegistration = z.infer<typeof CapabilityRegistrationSchema>;

/**
 * Rails supported for autonomous payment settlement
 */
export const SettlementRailEnum = z.enum([
  "PAYPAL_PAYOUTS",       // Direct instant micro-payout
  "PAYPAL_ORDERS_ESCROW"  // Pre-authorized hold + capture
]);
export type SettlementRail = z.infer<typeof SettlementRailEnum>;

/**
 * Task state lifecycle in the Bounty network
 */
export const TaskStatusEnum = z.enum([
  "BROADCAST",     // RFP published to market
  "BIDDING",       // Accepting bids from worker nodes
  "ASSIGNED",      // Matched and locked to winning seller node
  "EXECUTING",     // Seller node executing in isolated sandbox
  "VERIFYING",     // Cryptographic & schema proof check in progress
  "SETTLED",       // PayPal micro-payout completed successfully
  "FAILED",        // Failed execution or failed verification
  "DISPUTED"       // Disputed outcome
]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

/**
 * Request for Proposal (RFP) emitted by Buyer Agent when hitting a bottleneck
 */
export const RFPRequestSchema = z.preprocess((val: any) => {
  if (typeof val !== "object" || val === null) return val;
  const copy = { ...val };
  if (!copy.capability && copy.capability_required) {
    copy.capability = copy.capability_required;
  }
  if (!copy.taskGoal && copy.task_goal) {
    copy.taskGoal = copy.task_goal;
  }
  if (!copy.taskGoal) {
    copy.taskGoal = `Execute ${copy.capability || "sub-task"}`;
  }
  if (!copy.buyerId && copy.buyer_id) {
    copy.buyerId = copy.buyer_id;
  }
  if (!copy.buyerId) {
    copy.buyerId = "buyer_agent_alpha";
  }
  if (!copy.inputPayload) {
    copy.inputPayload = copy.input_payload || { targetUrl: copy.constraints?.target_url || copy.constraints?.targetUrl };
  }
  if (copy.constraints) {
    const c = { ...copy.constraints };
    if (!c.targetUrl && c.target_url) c.targetUrl = c.target_url;
    if (!c.requiredFeatures && c.required_bypass) c.requiredFeatures = c.required_bypass;
    if (!c.outputFormat) c.outputFormat = "application/json";
    copy.constraints = c;
  } else {
    copy.constraints = { outputFormat: "application/json", requiredFeatures: [] };
  }
  if (copy.financials && !copy.budget) {
    copy.budget = {
      bidCeilingUsd: copy.financials.bid_ceiling ?? copy.financials.bidCeilingUsd ?? 0.06,
      currency: copy.financials.currency || "USD",
      settlementRail: copy.financials.settlementRail || "PAYPAL_PAYOUTS"
    };
  } else if (copy.budget) {
    const b = { ...copy.budget };
    if (b.bid_ceiling && !b.bidCeilingUsd) b.bidCeilingUsd = b.bid_ceiling;
    copy.budget = b;
  }
  return copy;
}, z.object({
  rfpId: z.string().min(1),
  buyerId: z.string().min(1),
  capability: CapabilityTypeEnum,
  taskGoal: z.string(),
  inputPayload: z.record(z.unknown()),
  constraints: z.object({
    maxLatencyMs: z.number().int().positive().default(15000),
    requiredFeatures: z.array(z.string()).optional().default([]),
    targetUrl: z.string().url().optional(),
    outputFormat: z.string().optional().default("application/json")
  }),
  budget: z.object({
    bidCeilingUsd: z.number().min(0.01).max(25.0),
    currency: z.literal("USD").default("USD"),
    settlementRail: SettlementRailEnum.default("PAYPAL_PAYOUTS")
  }),
  verificationSpec: z.object({
    requireSha256: z.boolean().default(true),
    requiredKeys: z.array(z.string()).optional(),
    semanticCheckPrompt: z.string().optional()
  }).default({ requireSha256: true }),
  createdAt: z.string().datetime().default(() => new Date().toISOString())
}));
export type RFPRequest = z.infer<typeof RFPRequestSchema>;

/**
 * Bid offer submitted by a Seller Node in response to an RFP
 */
export const BidOfferSchema = z.object({
  bidId: z.string().min(1),
  rfpId: z.string().min(1),
  nodeId: z.string().min(1),
  sellerPaypalEmail: z.string().email(),
  quotePriceUsd: z.number().min(0.01),
  estimatedLatencyMs: z.number().int().positive(),
  reputationScore: z.number().min(0).max(100).default(99),
  createdAt: z.string().datetime().default(() => new Date().toISOString())
});
export type BidOffer = z.infer<typeof BidOfferSchema>;

/**
 * Task Assignment: A locked contract between Buyer and Seller
 */
export const TaskAssignmentSchema = z.object({
  taskId: z.string().min(1),
  rfpId: z.string().min(1),
  buyerId: z.string().min(1),
  nodeId: z.string().min(1),
  sellerPaypalEmail: z.string().email(),
  agreedPriceUsd: z.number().min(0.01),
  inputPayload: z.record(z.unknown()),
  capability: CapabilityTypeEnum,
  deadlineAt: z.string().datetime(),
  escrowRef: z.string().optional(),
  assignedAt: z.string().datetime().default(() => new Date().toISOString())
});
export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;

/**
 * Output submitted by Seller Node upon task completion
 */
export const TaskResultSchema = z.object({
  taskId: z.string().min(1),
  nodeId: z.string().min(1),
  success: z.boolean(),
  payload: z.unknown(),
  sha256Digest: z.string().min(64),
  executionTimeMs: z.number().int().nonnegative(),
  workerMetadata: z.object({
    ipType: z.string().optional(),
    memoryUsedMb: z.number().optional(),
    workerVersion: z.string().optional()
  }).optional(),
  error: z.string().optional(),
  completedAt: z.string().datetime().default(() => new Date().toISOString())
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

/**
 * Settlement Receipt: Proof of payment issued via PayPal Payouts or Orders
 */
export const SettlementReceiptSchema = z.object({
  settlementId: z.string().min(1),
  taskId: z.string().min(1),
  rfpId: z.string().min(1),
  rail: SettlementRailEnum,
  paypalReferenceId: z.string(), // Payout batch ID or Order Capture ID
  senderEmail: z.string().email(),
  recipientEmail: z.string().email(),
  amountUsd: z.number().positive(),
  feeUsd: z.number().nonnegative().default(0),
  netPayoutUsd: z.number().nonnegative(),
  currency: z.literal("USD").default("USD"),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]),
  sha256Verified: z.boolean(),
  schemaVerified: z.boolean(),
  settledAt: z.string().datetime().default(() => new Date().toISOString()),
  explorerUrl: z.string().url().optional()
});
export type SettlementReceipt = z.infer<typeof SettlementReceiptSchema>;

