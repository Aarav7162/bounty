import { WebSocket } from "ws";
import chalk from "chalk";
import { CapabilityRegistration, TaskAssignment } from "@bounty/protocol";
import { loadConfig, createDefaultConfig, saveConfig } from "../config.js";
import { BountyTUI } from "../ui/tui.js";
import { ExecutionSandbox } from "../worker/sandbox.js";

export interface StartCommandOptions {
  config?: string;
  broker?: string;
}

export async function runStartCommand(options: StartCommandOptions): Promise<void> {
  // 1. Load or Generate Config
  let config = loadConfig(options.config);
  if (!config) {
    config = createDefaultConfig(process.env.PAYPAL_SELLER_EMAIL || "sb-sqcdl53128062@personal.example.com");
    saveConfig(config);
  }

  const brokerUrl = options.broker ?? config.brokerUrl ?? (process.env.BOUNTY_BROKER_URL || "ws://localhost:4000/ws/seller");
  const sandbox = new ExecutionSandbox();
  const tui = new BountyTUI(config, brokerUrl);

  let ws: WebSocket | null = null;
  let isShuttingDown = false;
  let isPaused = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connectToBroker = () => {
    if (isShuttingDown) return;

    tui.setStatus("CONNECTING");

    try {
      ws = new WebSocket(brokerUrl);
    } catch (err: any) {
      tui.setStatus("DISCONNECTED");
      tui.addEvent(chalk.red("✕"), "Connection failed", err.message);
      scheduleReconnect();
      return;
    }

    ws.on("open", () => {
      tui.setStatus(isPaused ? "PAUSED" : "ONLINE");

      // Build capability registration list
      const capRegistrations: CapabilityRegistration[] = Object.entries(config!.capabilities).map(
        ([cap, details]) => ({
          capability: cap as any,
          floorPriceUsd: details.floorPriceUsd,
          maxConcurrency: details.maxConcurrency,
          avgLatencyMs: 1200,
          description: details.description
        })
      );

      // Send registration message
      ws?.send(
        JSON.stringify({
          type: "REGISTER_SELLER",
          nodeId: config!.nodeId,
          paypalEmail: config!.payoutDestination.value,
          capabilities: capRegistrations
        })
      );
    });

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "REGISTERED": {
            tui.addEvent(
              chalk.green("✓"),
              `Connected to broker  ·  ${config!.nodeId.slice(0, 14)}`
            );
            tui.setActiveStep({ spinner: true, text: "Waiting for tasks..." });
            break;
          }

          case "PING": {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "PONG" }));
            }
            break;
          }

          case "TASK_ASSIGNMENT": {
            if (isPaused) {
              return;
            }

            const assignment = msg.assignment as TaskAssignment;
            const taskGoal = (assignment.inputPayload as any)?.task_description || (assignment.inputPayload as any)?.taskGoal || assignment.capability;
            const ceilingStr = `$${(assignment.agreedPriceUsd * 1.2).toFixed(2)}`;

            tui.addEvent(
              chalk.green("✓"),
              `Task received: "${taskGoal.slice(0, 34)}"`,
              `${ceilingStr} ceiling`
            );

            tui.addEvent(
              chalk.green("✓"),
              `Bid submitted: $${assignment.agreedPriceUsd.toFixed(2)}`
            );

            tui.setActiveStep({ spinner: true, text: "Executing in sandbox..." });

            // Execute using real capability plugins
            const result = await sandbox.executeTask(assignment);

            tui.addEvent(
              chalk.green("✓"),
              `SHA-256 hash computed: sha256:${result.sha256Digest.slice(0, 10)}...`
            );

            tui.setActiveStep({ spinner: true, text: "Submitting proof & awaiting settlement..." });

            // Submit result to broker
            ws?.send(
              JSON.stringify({
                type: "TASK_RESULT",
                result
              })
            );
            break;
          }

          case "TASK_VERIFIED": {
            // Verification status event
            break;
          }

          case "PAYOUT_SETTLED": {
            const receipt = msg.receipt;
            const shortBatch = receipt.paypalReferenceId;

            tui.setActiveStep({ spinner: true, text: "Waiting for tasks..." });
            tui.recordPaid(receipt.amountUsd, receipt.paypalReferenceId);

            tui.addEvent(
              chalk.green("✓"),
              `PAID  ·  Batch: ${shortBatch}  ·  $${receipt.amountUsd.toFixed(2)}  ·  PAYOUT_SUCCESS`,
              undefined,
              chalk.green.bold
            );
            break;
          }

          default:
            break;
        }
      } catch (err: any) {
        tui.addEvent(chalk.red("✕"), "Message parse error", err.message);
      }
    });

    ws.on("close", () => {
      tui.setStatus("DISCONNECTED");
      tui.setActiveStep(undefined);
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      tui.setStatus("DISCONNECTED");
      tui.addEvent(chalk.red("✕"), "Socket error", err.message);
    });
  };

  const scheduleReconnect = () => {
    if (isShuttingDown) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connectToBroker();
    }, 3000);
  };

  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);

    tui.stop();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "Node exiting cleanly");
    }

    console.log(chalk.gray("\n  ✓ Bounty Node disconnected cleanly.\n"));
    process.exit(0);
  };

  tui.setOnQuit(shutdown);
  tui.setOnPause((paused) => {
    isPaused = paused;
  });

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  tui.start();
  connectToBroker();
}
