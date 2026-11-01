import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  RFPRequestSchema,
  TaskResultSchema,
  CapabilityRegistrationSchema
} from "@bounty/protocol";
import { DualModePayPalService } from "./paypal.js";
import { MatchingEngine } from "./matching.js";
import {
  SellerInboundMessage,
  TelemetryEvent,
  WebSocketRole
} from "./types.js";

export interface BrokerServerOptions {
  port?: number;
  paypalService?: DualModePayPalService;
  heartbeatIntervalMs?: number;
}

export class BrokerServer {
  public readonly port: number;
  public readonly paypalService: DualModePayPalService;
  public readonly matchingEngine: MatchingEngine;
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private telemetryClients: Set<WebSocket> = new Set();

  constructor(options?: BrokerServerOptions) {
    this.port = options?.port ?? Number(process.env.BOUNTY_BROKER_PORT || 4000);
    this.paypalService = options?.paypalService ?? new DualModePayPalService();
    this.matchingEngine = new MatchingEngine({
      heartbeatIntervalMs: options?.heartbeatIntervalMs,
      paypalService: this.paypalService
    });

    this.httpServer = createServer((req, res) => this.handleHttpRequest(req, res));
    this.wss = new WebSocketServer({ noServer: true });

    this.setupWebSocketRouting();
    this.setupTelemetryRelay();
  }

  private setupWebSocketRouting(): void {
    this.httpServer.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url || "/", `http://${request.headers.host}`).pathname;

      if (pathname === "/ws/seller") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.handleSellerConnection(ws);
        });
      } else if (pathname === "/ws/telemetry") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.handleTelemetryConnection(ws);
        });
      } else {
        socket.destroy();
      }
    });
  }

  private setupTelemetryRelay(): void {
    this.matchingEngine.on("telemetry", (event: TelemetryEvent) => {
      const payload = JSON.stringify(event);
      for (const client of this.telemetryClients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(payload);
          } catch {
            // Socket dead, will be pruned
          }
        }
      }
    });
  }

  private handleSellerConnection(ws: WebSocket): void {
    let registeredNodeId: string | null = null;

    ws.on("message", async (data) => {
      try {
        const raw = JSON.parse(data.toString());
        const msg = raw as SellerInboundMessage;

        switch (msg.type) {
          case "REGISTER_SELLER": {
            // Validate registration capabilities with Zod
            const parsedCaps = msg.capabilities.map((c) =>
              CapabilityRegistrationSchema.parse(c)
            );
            registeredNodeId = msg.nodeId;
            this.matchingEngine.registerNode(
              msg.nodeId,
              msg.paypalEmail,
              parsedCaps,
              ws
            );
            break;
          }

          case "PONG": {
            if (registeredNodeId) {
              this.matchingEngine.recordPong(registeredNodeId);
            }
            break;
          }

          case "TASK_RESULT": {
            // Validate task result with Zod
            const validatedResult = TaskResultSchema.parse(msg.result);
            await this.matchingEngine.handleTaskResult(validatedResult);
            break;
          }

          default:
            ws.send(JSON.stringify({ type: "ERROR", message: `Unknown message type` }));
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: "ERROR", message: err.message || "Invalid payload" }));
      }
    });

    ws.on("close", () => {
      if (registeredNodeId) {
        this.matchingEngine.evictNode(registeredNodeId, "SOCKET_DISCONNECTED");
      }
    });

    ws.on("error", () => {
      if (registeredNodeId) {
        this.matchingEngine.evictNode(registeredNodeId, "SOCKET_ERROR");
      }
    });
  }

  private handleTelemetryConnection(ws: WebSocket): void {
    this.telemetryClients.add(ws);

    // Send initial snapshot
    const snapshot: TelemetryEvent = {
      id: `init_${Date.now()}`,
      type: "NODE_REGISTERED",
      timestamp: new Date().toISOString(),
      data: {
        snapshot: true,
        connectedNodes: this.matchingEngine.getConnectedNodes().length,
        settlements: this.paypalService.getAllSettlements()
      }
    };
    ws.send(JSON.stringify(snapshot));

    ws.on("close", () => {
      this.telemetryClients.delete(ws);
    });

    ws.on("error", () => {
      this.telemetryClients.delete(ws);
    });
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const method = req.method;

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === "/health" && method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          paypalMode: this.paypalService.getMode(),
          uptimeSec: process.uptime(),
          nodesOnline: this.matchingEngine.getConnectedNodes().length
        })
      );
      return;
    }

    if (url.pathname === "/api/nodes" && method === "GET") {
      const nodes = this.matchingEngine.getConnectedNodes().map((n) => ({
        nodeId: n.nodeId,
        paypalEmail: n.paypalEmail,
        isAlive: n.isAlive,
        activeTasks: n.activeTaskCount,
        tasksCompleted: n.tasksCompleted,
        totalEarnedUsd: n.totalEarnedUsd,
        capabilities: Array.from(n.capabilities.values())
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(nodes));
      return;
    }

    if (url.pathname === "/api/settlements" && method === "GET") {
      const settlements = this.paypalService.getAllSettlements();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(settlements));
      return;
    }

    if (url.pathname === "/api/capabilities/toggle" && method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { capability, enabled } = JSON.parse(body);
          this.matchingEngine.emitTelemetry("NODE_REGISTERED", {
            action: "CAPABILITY_TOGGLED",
            capability,
            enabled,
            timestamp: new Date().toISOString()
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "OK", capability, enabled }));
        } catch (err: any) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === "/api/rfp" && method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsedJson = JSON.parse(body);
          const rfp = RFPRequestSchema.parse(parsedJson);
          const assignment = await this.matchingEngine.handleRFP(rfp);

          if (!assignment) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                status: "UNMATCHED",
                message: "No available worker nodes match capability and price floor"
              })
            );
            return;
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "MATCHED", assignment }));
        } catch (err: any) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Invalid RFP payload" }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Endpoint not found" }));
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    this.matchingEngine.stop();
    for (const ws of this.telemetryClients) {
      try {
        ws.close();
      } catch {}
    }
    this.telemetryClients.clear();

    return new Promise((resolve) => {
      this.wss.close(() => {
        this.httpServer.close(() => {
          resolve();
        });
      });
    });
  }
}

