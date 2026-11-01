import { z } from "zod";
import { CapabilityType, RFPRequest, CapabilityTypeEnum } from "./rfp.js";
import { generateRfpId } from "./crypto.js";

/**
 * Programmatic failure trigger classifications
 */
export const FailureCategoryEnum = z.enum([
  "HTTP_STATUS_TRAP",       // 403 Forbidden, 429 Rate Limit, 503 Unavailable
  "BOT_DETECTION_SIGNATURE", // Cloudflare Turnstile, Akamai, Captcha
  "TIMEOUT_EXCEEDED",       // Wall-clock execution timeout
  "MEMORY_LIMIT_EXCEEDED",   // OOM or payload buffer overflow
  "SCHEMA_VALIDATION_ERROR", // Output failed Zod schema checks
  "LOW_ENTROPY_COMPLETENESS",// Incomplete payload or suspicious brevity
  "LLM_JUDGE_UNSATISFIED"    // Soft quality assessment failure
]);
export type FailureCategory = z.infer<typeof FailureCategoryEnum>;

/**
 * Known anti-bot / WAF fingerprints
 */
export const BOT_DETECTION_INDICATORS = [
  "cf-turnstile",
  "challenge-platform",
  "cf-chl-widget",
  "attention required! | cloudflare",
  "cloudflare ray id",
  "just a moment...",
  "verify you are human",
  "akamai-bm",
  "recaptcha",
  "hcaptcha",
  "incapsula",
  "datadome"
] as const;

/**
 * Diagnostic record of an execution failure
 */
export const ExecutionFailureRecordSchema = z.object({
  attemptNumber: z.number().int().positive(),
  category: FailureCategoryEnum,
  statusCode: z.number().int().optional(),
  message: z.string(),
  detectedSignatures: z.array(z.string()).optional(),
  timestamp: z.string().datetime().default(() => new Date().toISOString())
});
export type ExecutionFailureRecord = z.infer<typeof ExecutionFailureRecordSchema>;

/**
 * State machine stages for task execution
 */
export const EnvelopeStateEnum = z.enum([
  "INTERNAL_EXECUTION",     // Running locally on primary worker
  "STRUGGLING",             // Detected potential roadblock
  "MARKET_BROADCAST",       // Local threshold exceeded -> Emitting RFP
  "DELEGATED_EXECUTION",    // RFP matched -> Executing on seller node
  "VERIFYING_OUTPUT",       // Output received -> Verifying hash & schema
  "SETTLED",                // Payment settled via PayPal
  "UNRECOVERABLE"           // Failed locally and on network
]);
export type EnvelopeState = z.infer<typeof EnvelopeStateEnum>;

/**
 * Configuration options for the Struggle Envelope
 */
export interface StruggleEnvelopeOptions<TOutput> {
  taskId: string;
  taskGoal: string;
  capabilityNeeded: CapabilityType;
  maxLocalAttempts?: number;
  timeoutMs?: number;
  bidCeilingUsd: number;
  expectedSchema?: z.ZodSchema<TOutput>;
  minEntropyCharacters?: number;
  requiredKeys?: string[];
  targetUrl?: string;
}

/**
 * Result of evaluating an output or error through the Struggle Envelope
 */
export interface EvaluationResult {
  passed: boolean;
  shouldDelegate: boolean;
  failure?: ExecutionFailureRecord;
  rfp?: RFPRequest;
}

/**
 * The Struggle Envelope: Monitors worker execution and transitions
 * failed local subtasks to autonomous market RFPs.
 */
export class StruggleEnvelope<TOutput = unknown> {
  public readonly taskId: string;
  public readonly taskGoal: string;
  public readonly capabilityNeeded: CapabilityType;
  public readonly maxLocalAttempts: number;
  public readonly timeoutMs: number;
  public readonly bidCeilingUsd: number;
  public readonly targetUrl?: string;
  public readonly expectedSchema?: z.ZodSchema<TOutput>;
  public readonly minEntropyCharacters: number;
  public readonly requiredKeys: string[];

  private currentAttempt: number = 0;
  private state: EnvelopeState = "INTERNAL_EXECUTION";
  private failureHistory: ExecutionFailureRecord[] = [];

  constructor(options: StruggleEnvelopeOptions<TOutput>) {
    this.taskId = options.taskId;
    this.taskGoal = options.taskGoal;
    this.capabilityNeeded = options.capabilityNeeded;
    this.maxLocalAttempts = options.maxLocalAttempts ?? 2;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.bidCeilingUsd = options.bidCeilingUsd;
    this.targetUrl = options.targetUrl;
    this.expectedSchema = options.expectedSchema;
    this.minEntropyCharacters = options.minEntropyCharacters ?? 150;
    this.requiredKeys = options.requiredKeys ?? [];
  }

  public getState(): EnvelopeState {
    return this.state;
  }

  public getAttempts(): number {
    return this.currentAttempt;
  }

  public getFailures(): ReadonlyArray<ExecutionFailureRecord> {
    return this.failureHistory;
  }

  /**
   * Evaluates an exception or raw error against deterministic triggers.
   */
  public evaluateError(
    error: Error | unknown,
    statusCode?: number,
    responseBody?: string
  ): EvaluationResult {
    this.currentAttempt += 1;
    let category: FailureCategory = "HTTP_STATUS_TRAP";
    let detectedSignatures: string[] = [];
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 1. Check HTTP Status Traps
    if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
      category = "HTTP_STATUS_TRAP";
    }

    // 2. Check Bot / WAF Signatures in response text or error message
    const combinedText = `${errorMessage} ${responseBody ?? ""}`.toLowerCase();
    for (const sig of BOT_DETECTION_INDICATORS) {
      if (combinedText.includes(sig)) {
        category = "BOT_DETECTION_SIGNATURE";
        detectedSignatures.push(sig);
      }
    }

    // 3. Check Timeout Exceptions
    if (
      errorMessage.toLowerCase().includes("timeout") ||
      errorMessage.toLowerCase().includes("etimedout") ||
      errorMessage.toLowerCase().includes("econnaborted")
    ) {
      category = "TIMEOUT_EXCEEDED";
    }

    const failureRecord: ExecutionFailureRecord = {
      attemptNumber: this.currentAttempt,
      category,
      statusCode,
      message: errorMessage,
      detectedSignatures: detectedSignatures.length > 0 ? detectedSignatures : undefined,
      timestamp: new Date().toISOString()
    };

    this.failureHistory.push(failureRecord);

    // If bot detection or max attempts reached, trigger delegation
    const shouldDelegate =
      category === "BOT_DETECTION_SIGNATURE" ||
      this.currentAttempt >= this.maxLocalAttempts;

    if (shouldDelegate) {
      this.state = "MARKET_BROADCAST";
    } else {
      this.state = "STRUGGLING";
    }

    return {
      passed: false,
      shouldDelegate,
      failure: failureRecord,
      rfp: shouldDelegate ? this.generateRFP() : undefined
    };
  }

  /**
   * Evaluates successful responses for soft semantic/quality failures.
   */
  public evaluateOutput(output: unknown): EvaluationResult {
    this.currentAttempt += 1;

    // 1. Zod Schema Validation
    if (this.expectedSchema) {
      const parseResult = this.expectedSchema.safeParse(output);
      if (!parseResult.success) {
        return this.recordSoftFailure(
          "SCHEMA_VALIDATION_ERROR",
          `Schema validation failed: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
        );
      }
    }

    // 2. Entropy / Text Length Heuristic
    if (typeof output === "string") {
      if (output.trim().length < this.minEntropyCharacters) {
        return this.recordSoftFailure(
          "LOW_ENTROPY_COMPLETENESS",
          `Output length (${output.trim().length}) below threshold (${this.minEntropyCharacters})`
        );
      }
    } else if (typeof output === "object" && output !== null) {
      const serialized = JSON.stringify(output);
      if (serialized.length < this.minEntropyCharacters) {
        return this.recordSoftFailure(
          "LOW_ENTROPY_COMPLETENESS",
          `Serialized output size (${serialized.length}) below required entropy`
        );
      }

      // 3. Required Keys Check
      for (const key of this.requiredKeys) {
        if (!(key in output)) {
          return this.recordSoftFailure(
            "SCHEMA_VALIDATION_ERROR",
            `Missing expected key in payload: "${key}"`
          );
        }
      }
    }

    // Output passed all programmatic checks
    return {
      passed: true,
      shouldDelegate: false
    };
  }

  private recordSoftFailure(category: FailureCategory, message: string): EvaluationResult {
    const failureRecord: ExecutionFailureRecord = {
      attemptNumber: this.currentAttempt,
      category,
      message,
      timestamp: new Date().toISOString()
    };
    this.failureHistory.push(failureRecord);

    const shouldDelegate = this.currentAttempt >= this.maxLocalAttempts;
    if (shouldDelegate) {
      this.state = "MARKET_BROADCAST";
    } else {
      this.state = "STRUGGLING";
    }

    return {
      passed: false,
      shouldDelegate,
      failure: failureRecord,
      rfp: shouldDelegate ? this.generateRFP() : undefined
    };
  }

  /**
   * Generates a standardized RFP when delegation threshold is triggered.
   */
  public generateRFP(customPayload?: Record<string, unknown>): RFPRequest {
    return {
      rfpId: generateRfpId(),
      buyerId: `buyer_${this.taskId}`,
      capability: this.capabilityNeeded,
      taskGoal: this.taskGoal,
      inputPayload: customPayload ?? {
        targetUrl: this.targetUrl,
        reason: this.failureHistory[this.failureHistory.length - 1]?.message,
        originalTaskId: this.taskId
      },
      constraints: {
        maxLatencyMs: this.timeoutMs,
        targetUrl: this.targetUrl,
        outputFormat: "application/json",
        requiredFeatures: this.capabilityNeeded === "residential_scrape"
          ? ["bypass_turnstile", "residential_ip"]
          : []
      },
      budget: {
        bidCeilingUsd: this.bidCeilingUsd,
        currency: "USD",
        settlementRail: "PAYPAL_PAYOUTS"
      },
      verificationSpec: {
        requireSha256: true,
        requiredKeys: this.requiredKeys.length > 0 ? this.requiredKeys : undefined
      },
      createdAt: new Date().toISOString()
    };
  }
}
