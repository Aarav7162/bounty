export interface BountyRow {
  id: string;
  time: string;
  rfpId: string;
  capability: string;
  sellerNode: string; // Masked email
  bidUsd: number;
  status: "CLAIMED" | "EXECUTING" | "VERIFIED" | "SETTLED" | "FAILED";
  paypalBatchId: string;
  latencyMs: number;
  amountPaidUsd: number;
  rawPayload?: any;
}

export interface KPIData {
  jobsToday: number;
  totalSettledUsd: number;
  avgLatencyMs: number;
  activeNodes: number;
}

