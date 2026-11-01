import chalk from "chalk";

export interface LedgerOptions {
  broker?: string;
  json?: boolean;
  limit?: string;
}

export async function runLedgerCommand(options: LedgerOptions): Promise<void> {
  const brokerUrl = options.broker || "http://localhost:4000";
  const apiBase = brokerUrl.startsWith("http") ? brokerUrl : `http://${brokerUrl.replace(/^ws:\/\//, "")}`;

  try {
    const res = await fetch(`${apiBase}/api/settlements`);
    if (!res.ok) {
      throw new Error(`Broker returned status ${res.status}: ${await res.text()}`);
    }

    const settlements = (await res.json()) as any[];

    if (options.json) {
      console.log(JSON.stringify(settlements, null, 2));
      return;
    }

    console.log("");
    console.log(chalk.cyan.bold("  ╭────────────────────────────────────────────────────────────────────────────────────────╮"));
    console.log(chalk.cyan.bold("  │") + chalk.white.bold("  BOUNTY SETTLEMENT LEDGER (Live PayPal Settlement Records)").padEnd(90) + chalk.cyan.bold("│"));
    console.log(chalk.cyan.bold("  ├──────────┬──────────────────┬─────────────┬─────────────────┬──────────────┬───────────┤"));
    console.log(chalk.cyan.bold("  │") + chalk.gray(" TIME     ") + chalk.cyan("│") + chalk.gray(" RFP ID           ") + chalk.cyan("│") + chalk.gray(" AMOUNT (USD)") + chalk.cyan("│") + chalk.gray(" PAYPAL BATCH ID ") + chalk.cyan("│") + chalk.gray(" STATUS       ") + chalk.cyan("│") + chalk.gray(" RECIPIENT ") + chalk.cyan.bold("│"));
    console.log(chalk.cyan.bold("  ├──────────┼──────────────────┼─────────────┼─────────────────┼──────────────┼───────────┤"));

    if (settlements.length === 0) {
      console.log(chalk.cyan.bold("  │") + chalk.yellow("  No settlement records found yet. Run an autonomous bounty to settle transactions!       ").padEnd(90) + chalk.cyan.bold("│"));
    } else {
      const limit = options.limit ? parseInt(options.limit, 10) : 10;
      const displayList = settlements.slice(-limit).reverse();

      for (const item of displayList) {
        const time = new Date(item.settledAt || Date.now()).toLocaleTimeString("en-US", { hour12: false });
        const rfpId = (item.rfpId || "—").length > 16 ? `${item.rfpId.slice(0, 14)}..` : (item.rfpId || "—");
        const amount = `$${Number(item.amountUsd || 0).toFixed(2)}`;
        const batch = (item.paypalReferenceId || item.settlementId || "—").slice(0, 15);
        const status = item.status === "SUCCESS" ? chalk.green.bold("SETTLED") : chalk.red.bold(item.status);
        const recipient = (item.recipientEmail || "seller").replace(/(.{3})(.*)(@.*)/, "$1***$3");

        const line = `  ${time.padEnd(9)}│ ${rfpId.padEnd(17)}│ ${chalk.yellow(amount).padEnd(20)}│ ${chalk.cyan(batch).padEnd(24)}│ ${status.padEnd(21)}│ ${recipient.padEnd(10)}`;
        console.log(chalk.cyan.bold("  │") + line + chalk.cyan.bold("│"));
      }
    }

    const totalVolume = settlements.reduce((acc, s) => acc + (s.amountUsd || 0), 0);
    console.log(chalk.cyan.bold("  ├────────────────────────────────────────────────────────────────────────────────────────┤"));
    console.log(chalk.cyan.bold("  │") + `  Total Volume: ${chalk.green.bold(`$${totalVolume.toFixed(2)} USD`)}  ·  Transactions: ${chalk.white.bold(settlements.length)}  ·  Rails: ${chalk.yellow("PayPal Sandbox")}`.padEnd(90) + chalk.cyan.bold("│"));
    console.log(chalk.cyan.bold("  ╰────────────────────────────────────────────────────────────────────────────────────────╯"));
    console.log("");
  } catch (err: any) {
    console.error(chalk.red(`\n✕ Could not reach Bounty Broker at ${apiBase}/api/settlements`));
    console.error(chalk.yellow(`  Start the broker in another terminal using: bounty server\n`));
  }
}

