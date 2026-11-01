import {
  SettlementReceipt,
  PayPalPayoutBatchResponseSchema,
  generateEntityId
} from "@bounty/protocol";

export interface PayPalConfig {
  mode: "sandbox" | "live" | "simulator";
  clientId?: string;
  clientSecret?: string;
  senderEmail?: string;
}

export interface PayoutParams {
  rfpId: string;
  taskId: string;
  recipientEmail: string;
  amountUsd: number;
  note?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export class DualModePayPalService {
  private config: PayPalConfig;
  private cachedToken: CachedToken | null = null;
  // In-memory idempotency cache: rfpId -> SettlementReceipt
  private settledBatches: Map<string, SettlementReceipt> = new Map();

  constructor(config?: Partial<PayPalConfig>) {
    const envMode = (process.env.PAYPAL_MODE || "simulator").toLowerCase();
    const clientId = config?.clientId ?? process.env.PAYPAL_CLIENT_ID;
    const clientSecret = config?.clientSecret ?? process.env.PAYPAL_CLIENT_SECRET ?? process.env.PAYPAL_SECRET;

    // Auto-detect mode: if credentials are provided and mode isn't explicitly 'simulator', use sandbox
    let resolvedMode: "sandbox" | "live" | "simulator" = "simulator";
    if (config?.mode) {
      resolvedMode = config.mode;
    } else if (envMode === "live") {
      resolvedMode = "live";
    } else if (envMode === "sandbox" && clientId && clientSecret) {
      resolvedMode = "sandbox";
    } else {
      resolvedMode = "simulator";
    }

    this.config = {
      mode: resolvedMode,
      clientId,
      clientSecret,
      senderEmail: config?.senderEmail ?? process.env.PAYPAL_BUYER_EMAIL ?? process.env.ORCHESTRATOR_PAYPAL_EMAIL ?? "sb-s8vke53470365@business.example.com"
    };
  }

  public getMode(): "sandbox" | "live" | "simulator" {
    return this.config.mode;
  }

  public getSenderEmail(): string {
    return this.config.senderEmail!;
  }

  private getBaseUrl(): string {
    return this.config.mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  }

  /**
   * OAuth 2.0 Client Credentials flow with token caching
   */
  public async getAccessToken(): Promise<string> {
    if (this.config.mode === "simulator") {
      return "simulated_oauth2_access_token";
    }

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken.accessToken;
    }

    const { clientId, clientSecret } = this.config;
    if (!clientId || !clientSecret) {
      throw new Error("PayPal Client ID and Secret are required for live/sandbox mode");
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal OAuth failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in * 1000
    };

    return this.cachedToken.accessToken;
  }

  /**
   * Settles a micro-payout to a seller worker node.
   * IDEMPOTENCY: Maps `params.rfpId` directly to `sender_batch_id`.
   */
  public async settlePayout(params: PayoutParams): Promise<SettlementReceipt> {
    const { rfpId, taskId, recipientEmail, amountUsd, note } = params;

    // Check idempotency cache first
    const existingReceipt = this.settledBatches.get(rfpId);
    if (existingReceipt) {
      return existingReceipt;
    }

    if (this.config.mode === "simulator") {
      return this.settleSimulatedPayout(params);
    }

    return this.settleLivePayout(params);
  }

  /**
   * High-Fidelity Simulator Settlement
   */
  private settleSimulatedPayout(params: PayoutParams): SettlementReceipt {
    const { rfpId, taskId, recipientEmail, amountUsd } = params;
    const feeUsd = Number((amountUsd * 0.02).toFixed(4)); // Simulated PayPal 2% payout fee
    const netPayoutUsd = Number((amountUsd - feeUsd).toFixed(4));
    const batchId = `PAYOUT-SIM-${rfpId}`;

    const receipt: SettlementReceipt = {
      settlementId: generateEntityId("stl"),
      taskId,
      rfpId,
      rail: "PAYPAL_PAYOUTS",
      paypalReferenceId: batchId,
      senderEmail: this.config.senderEmail!,
      recipientEmail,
      amountUsd,
      feeUsd,
      netPayoutUsd,
      currency: "USD",
      status: "SUCCESS",
      sha256Verified: true,
      schemaVerified: true,
      settledAt: new Date().toISOString(),
      explorerUrl: `https://www.sandbox.paypal.com/activity/payment/${batchId}`
    };

    this.settledBatches.set(rfpId, receipt);
    return receipt;
  }

  /**
   * Live PayPal Payouts REST API Execution
   */
  private async settleLivePayout(params: PayoutParams): Promise<SettlementReceipt> {
    const { rfpId, taskId, recipientEmail, amountUsd, note } = params;
    const token = await this.getAccessToken();

    // Map rfpId directly to sender_batch_id for strict idempotency
    const payload = {
      sender_batch_header: {
        sender_batch_id: rfpId,
        email_subject: "Bounty: Instant Micro-Payout for Verified AI Sub-Task",
        email_message: note ?? `Automated settlement for task ${taskId}`
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: amountUsd.toFixed(2),
            currency: "USD"
          },
          receiver: recipientEmail,
          note: `Bounty Subcontract #${taskId}`,
          sender_item_id: taskId,
          recipient_wallet: "PAYPAL"
        }
      ]
    };

    const response = await fetch(`${this.getBaseUrl()}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Handle idempotent duplicate: if batch was already created, retrieve it
      if (response.status === 400 && errorText.includes("DUPLICATE_BATCH_ID")) {
        const existing = this.settledBatches.get(rfpId);
        if (existing) return existing;
      }
      throw new Error(`PayPal Payout failed (${response.status}): ${errorText}`);
    }

    const rawData = await response.json();
    const parsed = PayPalPayoutBatchResponseSchema.parse(rawData);
    const batchId = parsed.batch_header.payout_batch_id;
    const feeUsd = parsed.batch_header.fees ? Number(parsed.batch_header.fees.value) : 0.25;

    const receipt: SettlementReceipt = {
      settlementId: generateEntityId("stl"),
      taskId,
      rfpId,
      rail: "PAYPAL_PAYOUTS",
      paypalReferenceId: batchId,
      senderEmail: this.config.senderEmail!,
      recipientEmail,
      amountUsd,
      feeUsd,
      netPayoutUsd: amountUsd,
      currency: "USD",
      status: parsed.batch_header.batch_status === "DENIED" ? "FAILED" : "SUCCESS",
      sha256Verified: true,
      schemaVerified: true,
      settledAt: new Date().toISOString(),
      explorerUrl: `https://www.sandbox.paypal.com/activity/payment/${batchId}`
    };

    this.settledBatches.set(rfpId, receipt);
    return receipt;
  }

  public getReceiptByRfpId(rfpId: string): SettlementReceipt | undefined {
    return this.settledBatches.get(rfpId);
  }

  public getAllSettlements(): SettlementReceipt[] {
    return Array.from(this.settledBatches.values());
  }
}

