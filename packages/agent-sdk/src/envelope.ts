import { generateRfpId } from "@bounty/protocol";

export interface TaskEnvelopeOptions {
  brokerApiUrl?: string;
  bidCeilingUsd?: number;
  maxWaitTimeoutMs?: number;
  entropyMinLength?: number;
}

export interface EmittedRFP {
  rfpId: string;
  buyerId: string;
  capability_required: string;
  constraints: {
    target_url: string;
    required_bypass: string[];
  };
  financials: {
    bid_ceiling: number;
  };
}

export interface WrapFetchResponse<T = any> {
  data: T;
  delegated: boolean;
  rfp?: EmittedRFP;
  assignment?: any;
  settlement?: any;
  rawPayload?: any;
  executionLatencyMs: number;
}

export class TaskEnvelope {
  public static async wrapFetch<T = any>(
    url: string,
    fetchOptions?: RequestInit,
    config?: TaskEnvelopeOptions
  ): Promise<WrapFetchResponse<T>> {
    const startTime = Date.now();
    const brokerUrl = config?.brokerApiUrl || process.env.BOUNTY_API_URL || "http://localhost:4000";
    const bidCeiling = config?.bidCeilingUsd ?? 0.06;
    const entropyMin = config?.entropyMinLength ?? 200;

    let directRes: Response | null = null;
    let directError: any = null;
    let resText = "";

    // 1. Attempt direct local execution
    try {
      directRes = await fetch(url, fetchOptions);
      resText = await directRes.text();
    } catch (err) {
      directError = err;
    }

    // 2. Evaluate Programmatic Blocker Triggers
    const statusCode = directRes ? directRes.status : 503;
    const hasStatusTrap = [403, 429, 503].includes(statusCode);
    const hasTurnstileHeader = Boolean(
      directRes &&
      (directRes.headers.get("cf-turnstile") ||
       directRes.headers.get("challenge-platform") ||
       directRes.headers.get("cf-ray"))
    );
    const hasLowEntropy = resText.trim().length < entropyMin ||
      resText.toLowerCase().includes("just a moment") ||
      resText.toLowerCase().includes("attention required! | cloudflare");

    const isStruggling = directError || hasStatusTrap || hasTurnstileHeader || hasLowEntropy;

    if (!isStruggling && directRes && directRes.ok) {
      // Local fetch succeeded
      try {
        const json = JSON.parse(resText);
        return { data: json, delegated: false, executionLatencyMs: Date.now() - startTime };
      } catch {
        return { data: resText as unknown as T, delegated: false, executionLatencyMs: Date.now() - startTime };
      }
    }

    // 3. Struggle Envelope Trips -> Emits Machine RFP
    const rfpId = generateRfpId();
    const rfpPayload: EmittedRFP = {
      rfpId,
      buyerId: "buyer_agent_alpha",
      capability_required: "web_scrape",
      constraints: {
        target_url: url,
        required_bypass: ["cloudflare_turnstile"]
      },
      financials: {
        bid_ceiling: bidCeiling
      }
    };

    console.log(`\n[Struggle Envelope] Detected blocker (Status: ${statusCode}, cf-turnstile: ${hasTurnstileHeader}).`);
    console.log(`[Struggle Envelope] Emitting RFP to Bounty Broker: ${brokerUrl}/api/rfp ...`);

    // Post RFP to Broker
    const rfpRes = await fetch(`${brokerUrl}/api/rfp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rfpPayload)
    });

    if (!rfpRes.ok) {
      const errText = await rfpRes.text();
      throw new Error(`Failed to broadcast RFP to broker (${rfpRes.status}): ${errText}`);
    }

    const rfpResult = (await rfpRes.json()) as any;
    console.log(`[Struggle Envelope] RFP Matched! Assigned to node ${rfpResult.assignment?.nodeId} at $${rfpResult.assignment?.agreedPriceUsd.toFixed(2)}`);

    // 4. Poll Broker for Task Completion & Verified Result
    const maxTimeout = config?.maxWaitTimeoutMs ?? 15000;
    const pollInterval = 400;
    const startPoll = Date.now();
    let settledData: any = null;
    let taskResultPayload: any = null;

    while (Date.now() - startPoll < maxTimeout) {
      await new Promise((r) => setTimeout(r, pollInterval));
      try {
        const taskRes = await fetch(`${brokerUrl}/api/tasks/${rfpId}`);
        if (taskRes.ok) {
          const taskObj = (await taskRes.json()) as any;
          if (taskObj.receipt && taskObj.result) {
            settledData = taskObj.receipt;
            taskResultPayload = taskObj.result.payload?.data ?? taskObj.result.payload;
            break;
          }
        } else {
          const res = await fetch(`${brokerUrl}/api/settlements`);
          if (res.ok) {
            const settlements = (await res.json()) as any[];
            const receipt = settlements.find((s) => s.rfpId === rfpId);
            if (receipt) {
              settledData = receipt;
              break;
            }
          }
        }
      } catch {}
    }

    if (!settledData) {
      throw new Error(`Timeout waiting for subcontracted task ${rfpId} to settle`);
    }

    const cleanData = (taskResultPayload ?? {
      status: "success",
      delegated: true,
      rfpId,
      settledAmountUsd: settledData.amountUsd,
      paypalBatchId: settledData.paypalReferenceId,
      source: "Bounty Subcontracted Worker"
    }) as unknown as T;

    // Return the clean data to the caller seamlessly
    return {
      data: cleanData,
      delegated: true,
      rfp: rfpPayload,
      assignment: rfpResult.assignment,
      settlement: settledData,
      rawPayload: taskResultPayload,
      executionLatencyMs: Date.now() - startTime
    };
  }
}

