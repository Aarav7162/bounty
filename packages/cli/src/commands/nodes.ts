import chalk from "chalk";

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
    console.log(chalk.cyan.bold("  ╭────────────────────────────────────────────────────────────────────────────────────────╮"));
    console.log(chalk.cyan.bold("  │") + chalk.white.bold("  BOUNTY ACTIVE ORDERBOOK NODES (Live Seller Mesh)").padEnd(90) + chalk.cyan.bold("│"));
    console.log(chalk.cyan.bold("  ├─────────────────┬──────────┬──────────────┬──────────────┬─────────────────────────────┤"));
    console.log(chalk.cyan.bold("  │") + chalk.gray(" NODE ID         ") + chalk.cyan("│") + chalk.gray(" STATUS   ") + chalk.cyan("│") + chalk.gray(" JOBS DONE    ") + chalk.cyan("│") + chalk.gray(" EARNED ($)   ") + chalk.cyan("│") + chalk.gray(" CAPABILITIES (FLOOR)        ") + chalk.cyan.bold("│"));
    console.log(chalk.cyan.bold("  ├─────────────────┼──────────┼──────────────┼──────────────┼─────────────────────────────┤"));

    if (nodes.length === 0) {
      console.log(chalk.cyan.bold("  │") + chalk.yellow("  No seller nodes currently online. Start a worker with: bounty sell                      ").padEnd(90) + chalk.cyan.bold("│"));
    } else {
      for (const node of nodes) {
        const nodeId = node.nodeId.length > 15 ? `${node.nodeId.slice(0, 13)}..` : node.nodeId;
        const status = node.isAlive ? chalk.green.bold("ONLINE ") : chalk.red.bold("OFFLINE");
        const jobs = `${node.tasksCompleted ?? 0} jobs`;
        const earned = `$${Number(node.totalEarnedUsd || 0).toFixed(2)}`;

        const caps = (node.capabilities || [])
          .map((c: any) => `${c.capability} ($${c.floorPriceUsd})`)
          .slice(0, 2)
          .join(", ");
        const capsDisplay = caps.length > 27 ? `${caps.slice(0, 25)}..` : caps;

        const line = `  ${chalk.cyan(nodeId).padEnd(24)}│ ${status.padEnd(16)}│ ${jobs.padEnd(13)}│ ${chalk.yellow(earned).padEnd(20)}│ ${capsDisplay.padEnd(28)}`;
        console.log(chalk.cyan.bold("  │") + line + chalk.cyan.bold("│"));
      }
    }

    console.log(chalk.cyan.bold("  ├────────────────────────────────────────────────────────────────────────────────────────┤"));
    console.log(chalk.cyan.bold("  │") + `  Total Active Nodes: ${chalk.green.bold(nodes.length)}  ·  Broker: ${chalk.gray(apiBase)}`.padEnd(90) + chalk.cyan.bold("│"));
    console.log(chalk.cyan.bold("  ╰────────────────────────────────────────────────────────────────────────────────────────╯"));
    console.log("");
  } catch (err: any) {
    console.error(chalk.red(`\n✕ Could not reach Bounty Broker at ${apiBase}/api/nodes`));
    console.error(chalk.yellow(`  Start the broker in another terminal using: bounty server\n`));
  }
}

