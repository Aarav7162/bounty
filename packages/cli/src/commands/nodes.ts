import chalk from "chalk";
import { fitString } from "../ui/layout.js";

export interface NodesOptions {
  broker?: string;
  json?: boolean;
}

export async function runNodesCommand(options: NodesOptions): Promise<void> {
  const brokerUrl = options.broker || "http://localhost:4000";
  const apiBase = brokerUrl.startsWith("http") ? brokerUrl : `http://${brokerUrl.replace(/^ws:\/\//, "")}`;

  try {
    const res = await fetch(`${apiBase}/api/nodes`);
    if (!res.ok) {
      throw new Error(`Broker returned status ${res.status}: ${await res.text()}`);
    }

    const nodes = (await res.json()) as any[];

    if (options.json) {
      console.log(JSON.stringify(nodes, null, 2));
      return;
    }

    console.log("");
    console.log(chalk.white.bold("  Bounty Active Orderbook Nodes") + chalk.gray(` · ${nodes.length} online · Broker: ${apiBase}`));
    console.log(chalk.gray("  " + "─".repeat(84)));

    const colNode = fitString("NODE ID", 20);
    const colStatus = fitString("STATUS", 12);
    const colJobs = fitString("COMPLETED", 14);
    const colEarned = fitString("EARNED", 14);
    const colCaps = fitString("CAPABILITIES (FLOOR)", 24);

    console.log(`  ${chalk.gray(colNode)} ${chalk.gray(colStatus)} ${chalk.gray(colJobs)} ${chalk.gray(colEarned)} ${chalk.gray(colCaps)}`);
    console.log(chalk.gray("  " + "─".repeat(84)));

    if (nodes.length === 0) {
      console.log(chalk.yellow("  No seller nodes currently online. Start a worker with: bounty sell"));
    } else {
      for (const node of nodes) {
        const nodeId = fitString(node.nodeId.length > 18 ? `${node.nodeId.slice(0, 16)}..` : node.nodeId, 20);
        const statusStr = node.isAlive ? chalk.green("ONLINE") : chalk.red("OFFLINE");
        const status = fitString(statusStr, 12);
        const jobs = fitString(`${node.tasksCompleted ?? 0} jobs`, 14);
        const earned = fitString(`$${Number(node.totalEarnedUsd || 0).toFixed(2)} USD`, 14);

        const caps = (node.capabilities || [])
          .map((c: any) => `${c.capability} ($${c.floorPriceUsd})`)
          .join(", ");
        const capsDisplay = fitString(caps.length > 24 ? `${caps.slice(0, 22)}..` : caps, 24);

        console.log(`  ${chalk.cyan(nodeId)} ${status} ${chalk.white(jobs)} ${chalk.yellow(earned)} ${chalk.gray(capsDisplay)}`);
      }
    }

    console.log(chalk.gray("  " + "─".repeat(84)));
    console.log(`  ${chalk.gray("Nodes Active:")} ${chalk.green.bold(nodes.length)}  ${chalk.gray("·")}  ${chalk.gray("Orderbook:")} ${chalk.cyan(apiBase)}`);
    console.log("");
  } catch (err: any) {
    console.error(chalk.red(`\n  ✕ Could not reach Bounty Broker at ${apiBase}/api/nodes`));
    console.error(chalk.yellow(`    Start the broker in another terminal using: bounty server\n`));
  }
}
