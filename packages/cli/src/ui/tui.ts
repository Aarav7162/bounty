import logUpdate from "log-update";
import cliSpinners from "cli-spinners";
import chalk from "chalk";
import { BountyConfig } from "../config.js";

export interface LogItem {
  icon: string;
  text: string;
  detail?: string;
  color?: (str: string) => string;
}

export interface TuiState {
  status: "CONNECTING" | "ONLINE" | "PAUSED" | "DISCONNECTED";
  config: BountyConfig;
  brokerUrl: string;
  nodesOnline: number;
  activeStep?: {
    spinner: boolean;
    text: string;
  };
  jobEvents: LogItem[];
  lifetimeEarnedUsd: number;
  jobsCompleted: number;
  lastPayoutBatchId?: string;
}

export class BountyTUI {
  private state: TuiState;
  private spinnerIndex = 0;
  private renderTimer: NodeJS.Timeout | null = null;
  private onQuitCallback?: () => void;
  private onPauseCallback?: (paused: boolean) => void;
  private onCapabilitiesCallback?: () => void;

  constructor(config: BountyConfig, brokerUrl: string) {
    this.state = {
      status: "CONNECTING",
      config,
      brokerUrl,
      nodesOnline: 1,
      jobEvents: [],
      lifetimeEarnedUsd: 0,
      jobsCompleted: 0
    };
  }

  public setOnQuit(cb: () => void): void {
    this.onQuitCallback = cb;
    this.setupKeypress();
  }

  public setOnPause(cb: (paused: boolean) => void): void {
    this.onPauseCallback = cb;
  }

  public setOnCapabilities(cb: () => void): void {
    this.onCapabilitiesCallback = cb;
  }

  private setupKeypress(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (chunk: string) => {
        if (chunk === "q" || chunk === "Q" || chunk === "\u0003") {
          this.onQuitCallback?.();
        } else if (chunk === "p" || chunk === "P") {
          const nextPaused = this.state.status !== "PAUSED";
          this.state.status = nextPaused ? "PAUSED" : "ONLINE";
          this.onPauseCallback?.(nextPaused);
          this.addEvent(
            nextPaused ? chalk.yellow("❚❚") : chalk.green("✓"),
            nextPaused ? "Worker bidding paused" : "Worker bidding resumed"
          );
          this.render();
        } else if (chunk === "c" || chunk === "C") {
          this.onCapabilitiesCallback?.();
        }
      });
    }
  }

  public setNodesOnline(count: number): void {
    this.state.nodesOnline = count;
    this.render();
  }

  public setStatus(status: TuiState["status"]): void {
    this.state.status = status;
    this.render();
  }

  public setActiveStep(step?: { spinner: boolean; text: string }): void {
    this.state.activeStep = step;
    this.render();
  }

  public addEvent(icon: string, text: string, detail?: string, color?: (str: string) => string): void {
    this.state.jobEvents.push({ icon, text, detail, color });
    if (this.state.jobEvents.length > 12) {
      this.state.jobEvents.shift();
    }
    this.render();
  }

  public recordPaid(amountUsd: number, batchId: string): void {
    this.state.lifetimeEarnedUsd += amountUsd;
    this.state.jobsCompleted += 1;
    this.state.lastPayoutBatchId = batchId;
    this.render();
  }

  public start(): void {
    if (this.renderTimer) clearInterval(this.renderTimer);
    const spinner = cliSpinners.dots;
    this.renderTimer = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % spinner.frames.length;
      this.render();
    }, 80);
    this.render();
  }

  public stop(): void {
    if (this.renderTimer) {
      clearInterval(this.renderTimer);
      this.renderTimer = null;
    }
    logUpdate.done();
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch {}
    }
  }

  private render(): void {
    const spinner = cliSpinners.dots.frames[this.spinnerIndex];
    const { status, config, brokerUrl, nodesOnline, activeStep, jobEvents, lifetimeEarnedUsd, jobsCompleted, lastPayoutBatchId } = this.state;

    // Header styling
    const brand = chalk.cyan.bold("BOUNTY NODE");
    const ver = chalk.gray("v1.0.0");
    let statusPill = chalk.bgHex("#065f46").hex("#34d399").bold(" ● ONLINE ");
    if (status === "PAUSED") statusPill = chalk.bgHex("#78350f").hex("#fbbf24").bold(" ❚❚ PAUSED ");
    if (status === "CONNECTING") statusPill = chalk.bgHex("#1e293b").hex("#38bdf8").bold(" ⠋ CONNECTING ");
    if (status === "DISCONNECTED") statusPill = chalk.bgHex("#7f1d1d").hex("#fca5a5").bold(" ✕ DISCONNECTED ");

    const leftColWidth = 52;
    const rightColWidth = 34;

    const leftLines: string[] = [];
    const rightLines: string[] = [];

    // Left Column Content: Job Lifecycle Flow
    leftLines.push(chalk.gray("ACTIVE JOB FLOW"));
    leftLines.push(chalk.gray("─".repeat(leftColWidth)));

    if (jobEvents.length === 0) {
      leftLines.push(chalk.gray("  No jobs processed yet in this session."));
    } else {
      for (const ev of jobEvents.slice(-7)) {
        const text = ev.color ? ev.color(ev.text) : ev.text;
        const detailStr = ev.detail ? chalk.gray(`  ${ev.detail}`) : "";
        leftLines.push(`  ${ev.icon}  ${text}${detailStr}`);
      }
    }

    if (activeStep) {
      const icon = activeStep.spinner ? chalk.cyan(spinner) : chalk.cyan("›");
      leftLines.push(`  ${icon}  ${chalk.white(activeStep.text)}`);
    } else if (status === "ONLINE") {
      leftLines.push(`  ${chalk.cyan(spinner)}  ${chalk.gray("Waiting for tasks...")}`);
    }

    // Right Column Content: Earnings Ticker & Node HUD
    rightLines.push(chalk.gray("EARNINGS TICKER"));
    rightLines.push(chalk.gray("─".repeat(rightColWidth)));
    rightLines.push(`  ${chalk.gray("Lifetime Earned:")} ${chalk.yellow.bold(`$${lifetimeEarnedUsd.toFixed(2)} USD`)}`);
    rightLines.push(`  ${chalk.gray("Jobs Completed:")}  ${chalk.white.bold(String(jobsCompleted))}`);
    rightLines.push(`  ${chalk.gray("Nodes Online:")}    ${chalk.cyan.bold(String(nodesOnline))}`);
    rightLines.push(`  ${chalk.gray("PayPal Account:")}  ${chalk.yellow(config.payoutDestination.value.slice(0, 16) + "...")}`);
    if (lastPayoutBatchId) {
      rightLines.push(`  ${chalk.gray("Latest Batch:")}    ${chalk.hex("#38bdf8")(lastPayoutBatchId.slice(0, 14))}`);
    }
    rightLines.push(chalk.gray("─".repeat(rightColWidth)));
    const caps = Object.keys(config.capabilities).join(", ");
    rightLines.push(`  ${chalk.gray("Capabilities:")}   ${chalk.green(caps.length > 20 ? caps.slice(0, 20) + "..." : caps)}`);

    // Merge into Split View
    const maxRows = Math.max(leftLines.length, rightLines.length, 9);
    const combinedRows: string[] = [];

    for (let i = 0; i < maxRows; i++) {
      const left = leftLines[i] || "";
      const right = rightLines[i] || "";
      // Strip ANSI length for padding
      const leftPlain = left.replace(/\u001b\[[0-9;]*m/g, "");
      const padding = " ".repeat(Math.max(0, leftColWidth - leftPlain.length));
      combinedRows.push(`  ${left}${padding}  ${chalk.gray("│")}  ${right}`);
    }

    const output = [
      "",
      `  ${brand} ${ver}       ${statusPill}        ${chalk.gray("Broker:")} ${chalk.cyan(brokerUrl)}`,
      `  ${chalk.gray("─".repeat(leftColWidth + rightColWidth + 7))}`,
      ...combinedRows,
      `  ${chalk.gray("─".repeat(leftColWidth + rightColWidth + 7))}`,
      `  ${chalk.gray("Keystrokes:")} ${chalk.cyan("[p]")} ${chalk.gray("pause/resume")}  ·  ${chalk.cyan("[c]")} ${chalk.gray("capabilities")}  ·  ${chalk.cyan("[q]")} ${chalk.gray("quit")}`,
      ""
    ];

    logUpdate(output.join("\n"));
  }
}
