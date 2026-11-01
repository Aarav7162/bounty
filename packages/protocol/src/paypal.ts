import { z } from "zod";

/**
 * PayPal Payout Item Definition
 */
export const PayPalPayoutItemSchema = z.object({
  recipient_type: z.enum(["EMAIL", "PHONE", "PAYPAL_ID"]).default("EMAIL"),
  amount: z.object({
    value: z.string(), // e.g. "0.06"
    currency: z.literal("USD").default("USD")
  }),
  receiver: z.string().email(),
  note: z.string().optional(),
  sender_item_id: z.string(), // e.g. "task_bnt_1234"
  recipient_wallet: z.literal("PAYPAL").default("PAYPAL")
});
export type PayPalPayoutItem = z.infer<typeof PayPalPayoutItemSchema>;

/**
 * PayPal Create Payout Request
 */
export const PayPalCreatePayoutRequestSchema = z.object({
  sender_batch_header: z.object({
    sender_batch_id: z.string(),
    email_subject: z.string().default("Bounty: Automated Machine Payout for Verified Task"),
    email_message: z.string().default("You received an automated micro-payout for completing an agent sub-task.")
  }),
  items: z.array(PayPalPayoutItemSchema)
});
export type PayPalCreatePayoutRequest = z.infer<typeof PayPalCreatePayoutRequestSchema>;

/**
 * PayPal Payout Batch Header Response
 */
export const PayPalPayoutBatchResponseSchema = z.object({
  batch_header: z.object({
    payout_batch_id: z.string(),
    batch_status: z.enum(["PENDING", "PROCESSING", "SUCCESS", "DENIED", "CANCELED"]),
    time_created: z.string().optional(),
    sender_batch_header: z.object({
      sender_batch_id: z.string()
    }),
    amount: z.object({
      currency: z.string(),
      value: z.string()
    }).optional(),
    fees: z.object({
      currency: z.string(),
      value: z.string()
    }).optional()
  }),
  links: z.array(
    z.object({
      href: z.string(),
      rel: z.string(),
      method: z.string()
    })
  ).optional()
});
export type PayPalPayoutBatchResponse = z.infer<typeof PayPalPayoutBatchResponseSchema>;

/**
 * PayPal Orders v2 Authorize / Escrow Schema
 */
export const PayPalAuthorizeOrderRequestSchema = z.object({
  intent: z.literal("AUTHORIZE"),
  purchase_units: z.array(
    z.object({
      reference_id: z.string(),
      amount: z.object({
        currency_code: z.literal("USD"),
        value: z.string()
      }),
      description: z.string().optional()
    })
  )
});
export type PayPalAuthorizeOrderRequest = z.infer<typeof PayPalAuthorizeOrderRequestSchema>;

export const PayPalCaptureAuthorizedPaymentSchema = z.object({
  amount: z.object({
    currency_code: z.literal("USD"),
    value: z.string()
  }),
  is_final_capture: z.boolean().default(true),
  note_to_payer: z.string().optional()
});
export type PayPalCaptureAuthorizedPayment = z.infer<typeof PayPalCaptureAuthorizedPaymentSchema>;

/**
 * Model Context Protocol (MCP) Tool Definitions for PayPal
 */
export const PayPalMCPTools = {
  check_spending_allowance: {
    name: "paypal_check_spending_allowance",
    description: "Inspects the agent's pre-authorized spending envelope and remaining PayPal budget.",
    parameters: z.object({
      agent_id: z.string()
    })
  },
  authorize_escrow: {
    name: "paypal_authorize_escrow",
    description: "Places a bounded hold on PayPal balance via Orders v2 to reserve budget for sub-tasks.",
    parameters: z.object({
      task_id: z.string(),
      max_budget_usd: z.number().positive(),
      purpose: z.string()
    })
  },
  settle_micro_payout: {
    name: "paypal_settle_micro_payout",
    description: "Triggers an instantaneous micro-payout to a worker node via the PayPal Payouts API.",
    parameters: z.object({
      task_id: z.string(),
      recipient_email: z.string().email(),
      amount_usd: z.number().positive(),
      sha256_proof: z.string()
    })
  }
} as const;

