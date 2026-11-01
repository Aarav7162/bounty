import chalk from "chalk";
import { ProcureAgentSupervisor } from "@bounty/agent-sdk";
import { getActiveProfile, recordBuyerSpend } from "../profile.js";

export interface DoOptions {
  broker?: string;
  maxBid?: string;
  timeout?: string;
  json?: boolean;
  raw?: boolean;
}

export async function runDoCommand(taskGoal: string, options: DoOptions = {}): Promise<void> {
  const { profile } = getActiveProfile();
  const rawBroker = options.broker || profile.seller.brokerUrl || "http://localhost:4000";
  const brokerUrl = rawBroker.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/ws\/.*$/, "");
  const bidCeiling = options.maxBid ? parseFloat(options.maxBid) : profile.buyer.defaultBidCeilingUsd;
  const isJsonOnly = options.json || options.raw;

  if (!isJsonOnly) {
    console.log("");
    console.log(chalk.white.bold("  Bounty Autonomous Supervisor") + chalk.gray(` · Task: "${taskGoal}"`));
    console.log(chalk.gray("  " + "─".repeat(68)));
  }

  try {
    const result = await ProcureAgentSupervisor.executeTask(taskGoal, {
      brokerApiUrl: brokerUrl,
      bidCeilingUsd: bidCeiling,
      maxLocalAttempts: profile.buyer.maxLocalAttempts ?? 2,
      timeoutSeconds: profile.buyer.localTimeoutSeconds ?? 15,
      onProgress: (stage: string, detail?: string, meta?: any) => {
        if (isJsonOnly) return;

        switch (stage) {
          case "LOCAL_ATTEMPT":
            console.log(`  ${chalk.cyan("[local]")}    Stage 1: Free local execution attempt ${meta?.attempt ?? 1}/${profile.buyer.maxLocalAttempts ?? 2}...`);
            break;

          case "HARD_ERROR_DETECTED":
            console.log(`  ${chalk.red("[trap]")}     Deterministic Failure: ${chalk.yellow(detail || "HTTP status trap")}`);
            break;

          case "SOFT_ERROR_DETECTED":
            console.log(`  ${chalk.yellow("[judge]")}    Semantic Quality Failure: ${chalk.gray(detail || "Output incomplete")}`);
            break;

          case "LOCAL_SUCCESS":
            console.log(`  ${chalk.green("[local]")}    Local execution succeeded using free resources (zero spend)`);
            break;

          case "STRUGGLE_THRESHOLD_REACHED":
            console.log(`  ${chalk.yellow("[struggle]")} Struggle Envelope Tripped: ${chalk.cyan("INTERNAL_EXECUTION -> MARKET_BROADCAST")}`);
            break;

          case "RFP_GENERATED":
            console.log(`  ${chalk.cyan("[rfp]")}      Automated Machine RFP: ${chalk.white(resultEnvelopeRfp(meta))} ${chalk.gray(`(ceiling: $${bidCeiling.toFixed(2)} USD)`)}`);
            break;

          case "NODE_MATCHED":
            console.log(`  ${chalk.cyan("[match]")}    Orderbook Peer Matched: ${chalk.cyan(detail || "seller node")}`);
            break;

          case "TASK_SETTLED":
            console.log(`  ${chalk.green("[settle]")}   PayPal Rails Settled: ${chalk.green(detail || "batch verified")}`);
            break;
        }
      }
    });

    if (result.delegated && result.agreedPriceUsd) {
      recordBuyerSpend(result.agreedPriceUsd);
    }

    if (!isJsonOnly) {
      console.log(chalk.gray("  " + "─".repeat(68)));
      const costStr = result.delegated ? `$${result.agreedPriceUsd?.toFixed(2)} USD (PayPal Rails)` : "$0.00 USD (Local Free)";
      console.log(`  ${chalk.gray("Status:")} ${chalk.green.bold("COMPLETED")}  ${chalk.gray("·")}  ${chalk.gray("Cost:")} ${chalk.yellow(costStr)}  ${chalk.gray("·")}  ${chalk.gray("Latency:")} ${chalk.white(`${(result.latencyMs / 1000).toFixed(2)}s`)}`);
      console.log("");
    }

    // Output data
    if (options.json) {
      console.log(JSON.stringify(result.data, null, 2));
    } else if (options.raw) {
      console.log(typeof result.data === "string" ? result.data : JSON.stringify(result.data));
    } else {
      console.log(chalk.gray("  [Task Output]"));
      console.log(JSON.stringify(result.data, null, 2));
      console.log("");
    }
  } catch (err: any) {
    if (!isJsonOnly) {
      console.log(chalk.gray("  " + "─".repeat(68)));
      console.error(chalk.red(`  [ERROR] Autonomous Execution Failed: ${err.message}`));
      console.log("");
    } else {
      console.error(JSON.stringify({ error: err.message }));
    }
    process.exit(1);
  }
}

function resultEnvelopeRfp(meta: any): string {
  if (meta?.rfp?.rfpId) return meta.rfp.rfpId;
  return "subtask_rfp";
}
