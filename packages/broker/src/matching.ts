import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import {
  RFPRequest,
  TaskAssignment,
  TaskResult,
  SettlementReceipt,
  CapabilityRegistration,
  generateTaskId,
  verifyPayloadDigest
} from "@bounty/protocol";
import {
  ConnectedSellerNode,
  SellerOutboundMessage,
  TelemetryEvent,
  TelemetryEventType
} from "./types.js";
import { DualModePayPalService } from "./paypal.js";

export interface MatchingEngineOptions {
  heartbeatIntervalMs?: number;
  paypalService: DualModePayPalService;
}

export class MatchingEngine extends EventEmitter {
  private nodes: Map<string, ConnectedSellerNode> = new Map();
  private tasks: Map<string, { rfp: RFPRequest; assignment?: TaskAssignment; result?: TaskResult; receipt?: SettlementReceipt }> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs: number;
  private readonly paypalService: DualModePayPalService;

  constructor(options: MatchingEngineOptions) {
    super();
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5000;
    this.paypalService = options.paypalService;
    this.startHeartbeatMonitor();
  }

  public emitTelemetry(type: TelemetryEventType, data: Record<string, unknown>): void {
    const event: TelemetryEvent = {
      id: `tel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      timestamp: new Date().toISOString(),
      data
    };
    this.emit("telemetry", event);
  }

  /**
   * Register a new or reconnecting Seller Node
   */
  public registerNode(
    nodeId: string,
    paypalEmail: string,
    capabilities: CapabilityRegistration[],
    socket: WebSocket
  ): ConnectedSellerNode {
    // If node was previously registered, evict prior connection
    const existing = this.nodes.get(nodeId);
    if (existing && existing.socket !== socket) {
      this.evictNode(nodeId, "RECONNECTED_NEW_SOCKET");
    }

    const capMap = new Map<string, CapabilityRegistration>();
    for (const cap of capabilities) {
      capMap.set(cap.capability, cap);
    }

    const node: ConnectedSellerNode = {
      nodeId,
      paypalEmail,
      capabilities: capMap as Map<any, any>,
      socket,
      isAlive: true,
      activeTaskCount: 0,
      lastSeenAt: Date.now(),
      totalEarnedUsd: existing ? existing.totalEarnedUsd : 0,
      tasksCompleted: existing ? existing.tasksCompleted : 0
    };

    this.nodes.set(nodeId, node);

    this.emitTelemetry("NODE_REGISTERED", {
      nodeId,
      paypalEmail,
      capabilities: capabilities.map((c) => ({
        capability: c.capability,
        floorPriceUsd: c.floorPriceUsd,
        maxConcurrency: c.maxConcurrency
      }))
    });

    const ack: SellerOutboundMessage = {
      type: "REGISTERED",
      nodeId,
      message: `Node successfully registered with ${capabilities.length} capabilities.`,
      timestamp: new Date().toISOString()
    };
    this.sendToNode(node, ack);

    return node;
  }

  /**
   * Instantly evicts a seller node from the active matching pool
   */
  public evictNode(nodeId: string, reason: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    this.nodes.delete(nodeId);

    try {
      if (node.socket.readyState === node.socket.OPEN) {
        node.socket.close(1000, `Evicted: ${reason}`);
      }
    } catch {
      // Ignore socket close errors
    }

    this.emitTelemetry("NODE_EVICTED", {
      nodeId,
      reason,
      tasksCompleted: node.tasksCompleted,
      totalEarnedUsd: node.totalEarnedUsd
    });
  }

  /**
   * Handle incoming heartbeat pong from seller node
   */
  public recordPong(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.isAlive = true;
      node.lastSeenAt = Date.now();
    }
  }

  /**
   * Ping/Pong Keepalive Monitor:
   * Periodically pings connected nodes. If a node fails to pong, evict instantly.
   */
  private startHeartbeatMonitor(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      const pingMsg: SellerOutboundMessage = { type: "PING" };
      const serialized = JSON.stringify(pingMsg);

      for (const [nodeId, node] of this.nodes.entries()) {
        if (!node.isAlive) {
          // Node did not respond to previous ping -> Evict immediately
          this.evictNode(nodeId, "HEARTBEAT_TIMEOUT");
          continue;
        }

        // Mark unconfirmed until next pong
        node.isAlive = false;
        try {
          if (node.socket.readyState === node.socket.OPEN) {
            node.socket.send(serialized);
          } else {
            this.evictNode(nodeId, "SOCKET_NOT_OPEN");
          }
        } catch {
          this.evictNode(nodeId, "SEND_PING_FAILED");
        }
      }
    }, this.heartbeatIntervalMs);

    // Prevent timer from keeping the process alive unnecessarily
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Match an incoming RFP against eligible Seller nodes
   */
  public async handleRFP(rfp: RFPRequest): Promise<TaskAssignment | null> {
    this.emitTelemetry("RFP_EMITTED", {
      rfpId: rfp.rfpId,
      capability: rfp.capability,
      bidCeilingUsd: rfp.budget.bidCeilingUsd,
      taskGoal: rfp.taskGoal
    });

    this.tasks.set(rfp.rfpId, { rfp });

    // Find eligible active seller nodes
    const candidates: Array<{ node: ConnectedSellerNode; floorPrice: number; avgLatency: number }> = [];

    for (const node of this.nodes.values()) {
      if (!node.socket || node.socket.readyState !== (node.socket.OPEN ?? 1)) {
        continue;
      }
      let capConfig = node.capabilities.get(rfp.capability);
      if (!capConfig && rfp.capability === "residential_scrape") {
        capConfig = node.capabilities.get("web_scrape");
      } else if (!capConfig && rfp.capability === "web_scrape") {
        capConfig = node.capabilities.get("residential_scrape");
      }
      if (!capConfig) continue;

      // Check concurrency capacity
      if (node.activeTaskCount >= capConfig.maxConcurrency) continue;

      // Check economic compatibility: bid_ceiling >= floor_price
      if (rfp.budget.bidCeilingUsd < capConfig.floorPriceUsd) continue;

      candidates.push({
        node,
        floorPrice: capConfig.floorPriceUsd,
        avgLatency: capConfig.avgLatencyMs ?? 2000
      });
    }

    if (candidates.length === 0) {
      this.emitTelemetry("TASK_FAILED", {
        rfpId: rfp.rfpId,
        reason: "NO_CAPABLE_OR_AVAILABLE_WORKER_MATCH"
      });
      return null;
    }

    // Spot selection strategy: Lowest floor price -> Lowest latency -> Lowest active tasks
    candidates.sort((a, b) => {
      if (a.floorPrice !== b.floorPrice) return a.floorPrice - b.floorPrice;
      if (a.avgLatency !== b.avgLatency) return a.avgLatency - b.avgLatency;
      return a.node.activeTaskCount - b.node.activeTaskCount;
    });

    const winner = candidates[0];
    const agreedPrice = Math.min(rfp.budget.bidCeilingUsd, winner.floorPrice);
    const taskId = generateTaskId();

    const assignment: TaskAssignment = {
      taskId,
      rfpId: rfp.rfpId,
      buyerId: rfp.buyerId,
      nodeId: winner.node.nodeId,
      sellerPaypalEmail: winner.node.paypalEmail,
      agreedPriceUsd: agreedPrice,
      inputPayload: {
        ...rfp.inputPayload,
        constraints: rfp.constraints
      },
      capability: rfp.capability,
      deadlineAt: new Date(Date.now() + rfp.constraints.maxLatencyMs).toISOString(),
      assignedAt: new Date().toISOString()
    };

    // Lock the node
    winner.node.activeTaskCount += 1;
    this.tasks.get(rfp.rfpId)!.assignment = assignment;

    this.emitTelemetry("TASK_MATCHED", {
      taskId,
      rfpId: rfp.rfpId,
      nodeId: winner.node.nodeId,
      agreedPriceUsd: agreedPrice
    });

    // Dispatch assignment to the winning seller node
    const dispatchMsg: SellerOutboundMessage = {
      type: "TASK_ASSIGNMENT",
      assignment
    };
    this.sendToNode(winner.node, dispatchMsg);

    // Watchdog: If node does not return result within 10 seconds, evict unresponsive node
    setTimeout(() => {
      const taskState = this.tasks.get(rfp.rfpId);
      if (taskState && !taskState.result) {
        this.evictNode(winner.node.nodeId, "TASK_EXECUTION_TIMEOUT");
      }
    }, 10000);

    this.emitTelemetry("TASK_ASSIGNED", {
      taskId,
      rfpId: rfp.rfpId,
      nodeId: winner.node.nodeId
    });

    return assignment;
  }

  /**
   * Process submitted Task Result from a Seller Node
   */
  public async handleTaskResult(result: TaskResult): Promise<SettlementReceipt | null> {
    const taskEntry = Array.from(this.tasks.values()).find(
      (t) => t.assignment?.taskId === result.taskId
    );

    if (!taskEntry || !taskEntry.assignment) {
      return null;
    }

    const { rfp, assignment } = taskEntry;
    taskEntry.result = result;
    const node = this.nodes.get(result.nodeId);

    // Release node lock
    if (node) {
      node.activeTaskCount = Math.max(0, node.activeTaskCount - 1);
    }

    this.emitTelemetry("RESULT_SUBMITTED", {
      taskId: result.taskId,
      nodeId: result.nodeId,
      executionTimeMs: result.executionTimeMs,
      sha256Digest: result.sha256Digest
    });

    // 1. Verify Cryptographic Integrity (SHA-256 Digest)
    const isHashValid = verifyPayloadDigest(result.payload, result.sha256Digest);
    if (!isHashValid) {
      this.emitTelemetry("TASK_FAILED", {
        taskId: result.taskId,
        reason: "SHA256_HASH_VERIFICATION_FAILED"
      });
      if (node) {
        this.sendToNode(node, {
          type: "TASK_VERIFIED",
          taskId: result.taskId,
          verified: false,
          reason: "Cryptographic SHA-256 payload digest mismatch"
        });
      }
      return null;
    }

    this.emitTelemetry("HASH_VERIFIED", {
      taskId: result.taskId,
      sha256Digest: result.sha256Digest
    });

    // 2. Validate Required Keys if specified in RFP
    if (rfp.verificationSpec?.requiredKeys && typeof result.payload === "object" && result.payload !== null) {
      const payloadObj = result.payload as Record<string, unknown>;
      for (const reqKey of rfp.verificationSpec.requiredKeys) {
        if (!(reqKey in payloadObj)) {
          this.emitTelemetry("TASK_FAILED", {
            taskId: result.taskId,
            reason: `MISSING_REQUIRED_KEY_${reqKey}`
          });
          return null;
        }
      }
    }

    // 2b. Block payment if execution failed or hidden unit tests failed
    if (!result.success) {
      this.emitTelemetry("TASK_FAILED", {
        taskId: result.taskId,
        reason: "WORKER_REPORTED_FAILURE"
      });
      return null;
    }

    if (typeof result.payload === "object" && result.payload !== null) {
      const p = result.payload as Record<string, unknown>;
      if (p.verified === false || p.status === "EXECUTION_ERROR" || (p.exitCode !== undefined && p.exitCode !== 0)) {
        this.emitTelemetry("TASK_FAILED", {
          taskId: result.taskId,
          reason: "HIDDEN_UNIT_TESTS_OR_ASSERTIONS_FAILED"
        });
        if (node) {
          this.sendToNode(node, {
            type: "TASK_VERIFIED",
            taskId: result.taskId,
            verified: false,
            reason: "Payment blocked: Fixed code failed unit test assertions."
          });
        }
        return null;
      }
    }

    // 3. Trigger Autonomous PayPal Settlement
    this.emitTelemetry("PAYOUT_INITIATED", {
      taskId: result.taskId,
      rfpId: rfp.rfpId,
      recipientEmail: assignment.sellerPaypalEmail,
      amountUsd: assignment.agreedPriceUsd
    });

    const receipt = await this.paypalService.settlePayout({
      rfpId: rfp.rfpId,
      taskId: assignment.taskId,
      recipientEmail: assignment.sellerPaypalEmail,
      amountUsd: assignment.agreedPriceUsd,
      note: `Bounty Subcontract ${assignment.taskId} - ${rfp.capability}`
    });

    taskEntry.receipt = receipt;

    // Update node metrics
    if (node) {
      node.totalEarnedUsd += receipt.amountUsd;
      node.tasksCompleted += 1;

      // Notify seller node of verified result and settlement
      this.sendToNode(node, {
        type: "TASK_VERIFIED",
        taskId: result.taskId,
        verified: true
      });

      this.sendToNode(node, {
        type: "PAYOUT_SETTLED",
        receipt
      });
    }

    this.emitTelemetry("PAYOUT_SETTLED", {
      taskId: result.taskId,
      rfpId: rfp.rfpId,
      batchId: receipt.paypalReferenceId,
      amountUsd: receipt.amountUsd,
      recipientEmail: receipt.recipientEmail,
      status: receipt.status
    });

    return receipt;
  }

  public getConnectedNodes(): ConnectedSellerNode[] {
    return Array.from(this.nodes.values());
  }

  public getTask(taskId: string) {
    for (const entry of this.tasks.values()) {
      if (entry.assignment?.taskId === taskId) return entry;
    }
    return undefined;
  }

  public getTaskByRfpId(rfpId: string) {
    return this.tasks.get(rfpId);
  }

  public stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const node of this.nodes.values()) {
      try {
        node.socket.close(1000, "Broker shutting down");
      } catch {}
    }
    this.nodes.clear();
  }

  private sendToNode(node: ConnectedSellerNode, msg: SellerOutboundMessage): void {
    try {
      if (node.socket.readyState === node.socket.OPEN) {
        node.socket.send(JSON.stringify(msg));
      }
    } catch {
      this.evictNode(node.nodeId, "SOCKET_WRITE_FAILED");
    }
  }
}

