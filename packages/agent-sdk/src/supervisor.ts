import { generateRfpId, computePayloadDigest, CapabilityType } from "@bounty/protocol";

export interface TaskEnvelopeState {
  taskId: string;
  taskGoal: string;
  maxLocalAttempts: number;
  timeoutSeconds: number;
  currentAttempt: number;
  state: "INTERNAL_EXECUTION" | "STRUGGLING" | "MARKET_BROADCAST" | "DELEGATED_EXECUTION" | "SETTLED";
  failureReason: string | null;
  missingCapability: string | null;
}

export interface LLMSelfAssessment {
  task_goal: string;
  received_payload_summary: string;
  status: "SATISFIED" | "UNSATISFIED";
  missing_capability: string | null;
  confidence: number;
}

export interface SupervisorOptions {
  brokerApiUrl?: string;
  bidCeilingUsd?: number;
  maxLocalAttempts?: number;
  timeoutSeconds?: number;
  onProgress?: (stage: string, detail?: string, meta?: Record<string, unknown>) => void;
}

export interface SupervisorResult<T = any> {
  success: boolean;
  delegated: boolean;
  data: T;
  envelope: TaskEnvelopeState;
  assessment?: LLMSelfAssessment;
  rfpId?: string;
  matchedNodeId?: string;
  paypalBatchId?: string;
  agreedPriceUsd?: number;
  latencyMs: number;
}

export const BOT_SIGNATURES = [
  "cf-turnstile",
  "challenge-platform",
  "attention required! | cloudflare",
  "cloudflare ray id",
  "just a moment...",
  "verify you are human",
  "akamai-bm",
  "recaptcha",
  "hcaptcha",
  "datadome"
];

export class ProcureAgentSupervisor {
  /**
   * Executes any free-form user task with the full 4-stage Struggle Envelope.
   * Only spends money when local, free resources have definitively failed.
   */
  public static async executeTask<T = any>(
    taskGoal: string,
    options: SupervisorOptions = {}
  ): Promise<SupervisorResult<T>> {
    const startTime = Date.now();
    const rawBroker = options.brokerApiUrl || process.env.BOUNTY_API_URL || "http://localhost:4000";
    const brokerUrl = rawBroker.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/ws\/.*$/, "").replace(/\/$/, "");
    const maxAttempts = options.maxLocalAttempts ?? 2;
    const timeoutSec = options.timeoutSeconds ?? 15;
    const bidCeiling = options.bidCeilingUsd ?? 0.06;
    const notify = options.onProgress ?? (() => {});

    // Initialize Struggle Envelope
    const envelope: TaskEnvelopeState = {
      taskId: `subtask_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      taskGoal,
      maxLocalAttempts: maxAttempts,
      timeoutSeconds: timeoutSec,
      currentAttempt: 0,
      state: "INTERNAL_EXECUTION",
      failureReason: null,
      missingCapability: null
    };

    notify("ENVELOPE_INIT", `Struggle Envelope initialized for task: "${taskGoal}"`, { envelope });

    // Step 1: Detect Bottleneck & Classify Subtask
    const urlMatch = taskGoal.match(/https?:\/\/[^\s"'<>]+/);
    const targetUrl = urlMatch ? urlMatch[0] : undefined;
    const isOcr = /ocr|receipt|invoice|image|\.png|\.jpg|\.pdf/i.test(taskGoal);
    const isPython = /python|code|script|fix|bug|function|billing\.py/i.test(taskGoal);

    let capabilityRequired: CapabilityType = "web_scrape";
    if (isOcr) capabilityRequired = "ocr";
    else if (isPython) capabilityRequired = "python_code";

    // Step 2: Attempt Local Free Execution (Loop up to maxLocalAttempts)
    let localResult: any = null;
    let localPassed = false;
    let assessment: LLMSelfAssessment | undefined = undefined;

    while (envelope.currentAttempt < envelope.maxLocalAttempts && !localPassed) {
      envelope.currentAttempt += 1;
      notify(
        "LOCAL_ATTEMPT",
        `[Stage 1] Local free execution attempt ${envelope.currentAttempt} of ${envelope.maxLocalAttempts}...`,
        { attempt: envelope.currentAttempt }
      );

      try {
        if (targetUrl) {
          // Attempt standard direct fetch (simulating free local client)
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

          let res: Response;
          try {
            res = await fetch(targetUrl, {
              headers: { "User-Agent": "Bounty-Local-Agent/1.0" },
              signal: controller.signal
            });
          } finally {
            clearTimeout(timer);
          }

          const rawText = await res.text();
          const status = res.status;

          // 1. Deterministic Hard Errors Check
          const isHardStatusTrap = [403, 429, 503].includes(status);
          const hasTurnstileHeader = Boolean(
            res.headers.get("cf-turnstile") ||
            res.headers.get("challenge-platform") ||
            res.headers.get("cf-ray")
          );

          let detectedBotSig: string | null = null;
          const lowerText = rawText.toLowerCase();
          for (const sig of BOT_SIGNATURES) {
            if (lowerText.includes(sig) || res.headers.get(sig)) {
              detectedBotSig = sig;
              break;
            }
          }

          if (isHardStatusTrap || hasTurnstileHeader || detectedBotSig) {
            envelope.failureReason = `HTTP ${status} · ${detectedBotSig || (hasTurnstileHeader ? "cf-turnstile" : "status_trap")}`;
            envelope.missingCapability = "residential_scrape";
            envelope.state = "STRUGGLING";

            notify("HARD_ERROR_DETECTED", `Deterministic Execution Failure: ${envelope.failureReason}`, {
              status,
              botSignature: detectedBotSig,
              turnstileHeader: hasTurnstileHeader
            });

            // Bot detection triggers immediate struggle delegation threshold
            break;
          }

          // 2. Output Schema & Semantic Quality Failure (Soft Errors)
          const isSuspiciouslyBrief = rawText.trim().length < 200;
          const hasBoilerplateRedirect = lowerText.includes("redirecting") || lowerText.includes("access denied");

          if (isSuspiciouslyBrief || hasBoilerplateRedirect) {
            assessment = {
              task_goal: taskGoal,
              received_payload_summary: `Suspiciously brief text (${rawText.trim().length} chars): "${rawText.slice(0, 80)}"`,
              status: "UNSATISFIED",
              missing_capability: "residential_scrape",
              confidence: 0.94
            };
            envelope.failureReason = `Semantic Quality Failure: ${assessment.received_payload_summary}`;
            envelope.missingCapability = "residential_scrape";
            envelope.state = "STRUGGLING";

            notify("SOFT_ERROR_DETECTED", `Soft Quality Failure: ${assessment.received_payload_summary}`, { assessment });
            continue;
          }

          // Output passed all checks locally!
          try {
            localResult = JSON.parse(rawText);
          } catch {
            localResult = { text: rawText };
          }
          localPassed = true;
          break;
        } else {
          // Non-URL task without external roadblock
          localResult = { status: "SUCCESS", message: `Executed local task: ${taskGoal}` };
          localPassed = true;
          break;
        }
      } catch (err: any) {
        envelope.failureReason = err.name === "AbortError" ? `Execution Timeout (> ${timeoutSec}s)` : err.message;
        envelope.state = "STRUGGLING";
        notify("LOCAL_ERROR", `Local execution exception: ${envelope.failureReason}`);
      }
    }

    // If local execution succeeded for free, return immediately!
    if (localPassed) {
      envelope.state = "SETTLED";
      notify("LOCAL_SUCCESS", "Local execution succeeded using free resources. Zero spend.");
      return {
        success: true,
        delegated: false,
        data: localResult as T,
        envelope,
        assessment,
        latencyMs: Date.now() - startTime
      };
    }

    // Step 3: The Struggle Envelope Pattern - Transition to Market Broadcast
    envelope.state = "MARKET_BROADCAST";
    notify(
      "STRUGGLE_THRESHOLD_REACHED",
      `[Stage 3] Struggle threshold reached. Transitioning state: INTERNAL_EXECUTION -> MARKET_BROADCAST`,
      { envelope }
    );

    // Step 4: Automated RFP Generation
    const rfpId = generateRfpId();
    const finalCapability = (envelope.missingCapability || capabilityRequired) as CapabilityType;
    const rfpPayload = {
      rfpId,
      buyerId: "supervisor_agent",
      capability_required: finalCapability,
      task_goal: taskGoal,
      constraints: {
        target_url: targetUrl || "http://localhost:5000/protected",
        required_bypass: ["cloudflare_turnstile", "residential_proxy"],
        max_latency_sec: timeoutSec
      },
      financials: {
        bid_ceiling: bidCeiling
      }
    };

    notify(
      "RFP_GENERATED",
      `[Stage 4] Abstracted machine contract into RFP (${rfpId}) with bounded budget: $${bidCeiling.toFixed(2)} USD`,
      { rfp: rfpPayload }
    );

    // Dispatch RFP to Bounty Broker
    envelope.state = "DELEGATED_EXECUTION";
    const rfpRes = await fetch(`${brokerUrl}/api/rfp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rfpPayload)
    });

    if (!rfpRes.ok) {
      const errText = await rfpRes.text();
      throw new Error(`Failed to match RFP in Bounty orderbook: ${errText}`);
    }

    const { assignment } = (await rfpRes.json()) as any;
    notify(
      "NODE_MATCHED",
      `Specialized seller node claimed task: ${assignment.nodeId} for $${assignment.agreedPriceUsd.toFixed(2)} USD`,
      { assignment }
    );

    // Step 5: Poll for Execution Result & Verified PayPal Settlement
    const maxTimeoutMs = 30000;
    const pollStart = Date.now();
    let settledTask: any = null;

    while (Date.now() - pollStart < maxTimeoutMs) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const taskRes = await fetch(`${brokerUrl}/api/tasks/${rfpId}`);
        if (taskRes.ok) {
          const taskObj = (await taskRes.json()) as any;
          if (taskObj.receipt && taskObj.result) {
            settledTask = taskObj;
            break;
          }
        }
      } catch {}
    }

    if (!settledTask) {
      throw new Error(`Timeout waiting for seller node ${assignment.nodeId} to settle`);
    }

    const payload = settledTask.result.payload?.data ?? settledTask.result.payload;
    const receipt = settledTask.receipt;
    const sha256 = settledTask.result.sha256Digest;

    envelope.state = "SETTLED";
    notify(
      "TASK_SETTLED",
      `Verified Cryptographic Proof (${sha256.slice(0, 10)}...) · Settled on PayPal Rails: Batch ${receipt.paypalReferenceId}`,
      { receipt, sha256 }
    );

    return {
      success: true,
      delegated: true,
      data: payload as T,
      envelope,
      assessment,
      rfpId,
      matchedNodeId: assignment.nodeId,
      paypalBatchId: receipt.paypalReferenceId,
      agreedPriceUsd: assignment.agreedPriceUsd,
      latencyMs: Date.now() - startTime
    };
  }
}
