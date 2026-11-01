import type { WebSocket } from "ws";
import type {
  CapabilityType,
  CapabilityRegistration,
  RFPRequest,
  BidOffer,
  TaskAssignment,
  TaskResult,
  SettlementReceipt
} from "@bounty/protocol";

export type WebSocketRole = "seller" | "telemetry";

export interface ConnectedSellerNode {
  nodeId: string;
  paypalEmail: string;
  capabilities: Map<CapabilityType, CapabilityRegistration>;
  socket: WebSocket;
  isAlive: boolean;
  activeTaskCount: number;
  lastSeenAt: number;
  totalEarnedUsd: number;
  tasksCompleted: number;
}

export type SellerInboundMessage =
  | {
      type: "REGISTER_SELLER";
      nodeId: string;
      paypalEmail: string;
      capabilities: CapabilityRegistration[];
    }
  | {
      type: "BID_OFFER";
      bid: BidOffer;
    }
  | {
      type: "TASK_RESULT";
      result: TaskResult;
    }
  | {
      type: "PONG";
    };

export type SellerOutboundMessage =
  | {
      type: "REGISTERED";
      nodeId: string;
      message: string;
      timestamp: string;
    }
  | {
      type: "RFP_BROADCAST";
      rfp: RFPRequest;
    }
  | {
      type: "TASK_ASSIGNMENT";
      assignment: TaskAssignment;
    }
  | {
      type: "TASK_VERIFIED";
      taskId: string;
      verified: boolean;
      reason?: string;
    }
  | {
      type: "PAYOUT_SETTLED";
      receipt: SettlementReceipt;
    }
  | {
      type: "PING";
    }
  | {
      type: "ERROR";
      message: string;
    };

export type TelemetryEventType =
  | "NODE_REGISTERED"
  | "NODE_DISCONNECTED"
  | "NODE_EVICTED"
  | "RFP_EMITTED"
  | "BID_SUBMITTED"
  | "TASK_MATCHED"
  | "TASK_ASSIGNED"
  | "TASK_EXECUTING"
  | "RESULT_SUBMITTED"
  | "HASH_VERIFIED"
  | "PAYOUT_INITIATED"
  | "PAYOUT_SETTLED"
  | "TASK_FAILED";

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

