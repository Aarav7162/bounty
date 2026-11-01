import chalk from "chalk";
import { fitString } from "../ui/layout.js";

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

    const totalVolume = settlements.reduce((acc, s) => acc + (s.amountUsd || 0), 0);

    console.log("");
    console.log(chalk.white.bold("  Bounty Settlement Ledger") + chalk.gray(` · ${settlements.length} entries · Rails: PayPal Sandbox`));
    console.log(chalk.gray("  " + "─".repeat(84)));

    const colTime = fitString("TIME", 10);
    const colRfp = fitString("RFP ID", 18);
    const colAmount = fitString("AMOUNT", 14);
    const colBatch = fitString("PAYPAL BATCH ID", 20);
    const colStatus = fitString("STATUS", 12);
    const colRecipient = fitString("RECIPIENT", 18);

    console.log(`  ${chalk.gray(colTime)} ${chalk.gray(colRfp)} ${chalk.gray(colAmount)} ${chalk.gray(colBatch)} ${chalk.gray(colStatus)} ${chalk.gray(colRecipient)}`);
    console.log(chalk.gray("  " + "─".repeat(84)));

    if (settlements.length === 0) {
      console.log(chalk.yellow("  No settlement records found yet."));
    } else {
      const limit = options.limit ? parseInt(options.limit, 10) : 10;
      const displayList = settlements.slice(-limit).reverse();

      for (const item of displayList) {
        const time = fitString(new Date(item.settledAt || Date.now()).toLocaleTimeString("en-US", { hour12: false }), 10);
        const rfpId = fitString((item.rfpId || "—").length > 16 ? `${item.rfpId.slice(0, 14)}..` : (item.rfpId || "—"), 18);
        const amount = fitString(`$${Number(item.amountUsd || 0).toFixed(2)} USD`, 14);
        const batch = fitString((item.paypalReferenceId || item.settlementId || "—").slice(0, 18), 20);
        const statusStr = item.status === "SUCCESS" ? chalk.green("SETTLED") : chalk.red(item.status);
        const status = fitString(statusStr, 12);
        const recipient = fitString((item.recipientEmail || "seller").replace(/(.{3})(.*)(@.*)/, "$1***$3"), 18);

        console.log(`  ${chalk.gray(time)} ${chalk.cyan(rfpId)} ${chalk.yellow(amount)} ${chalk.cyan(batch)} ${status} ${chalk.gray(recipient)}`);
      }
    }

    console.log(chalk.gray("  " + "─".repeat(84)));
    console.log(`  ${chalk.gray("Total Settled:")} ${chalk.green.bold(`$${totalVolume.toFixed(2)} USD`)}  ${chalk.gray("·")}  ${chalk.gray("Transactions:")} ${chalk.white.bold(settlements.length)}  ${chalk.gray("·")}  ${chalk.gray("Rails:")} ${chalk.yellow("PayPal Sandbox Payouts")}`);
    console.log("");
  } catch (err: any) {
    console.error(chalk.red(`\n  ✕ Could not reach Bounty Broker at ${apiBase}/api/settlements`));
    console.error(chalk.yellow(`    Start the broker in another terminal using: bounty server\n`));
  }
}
