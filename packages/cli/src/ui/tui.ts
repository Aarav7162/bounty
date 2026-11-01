import logUpdate from "log-update";
import cliSpinners from "cli-spinners";
import chalk from "chalk";
import readline from "node:readline";
import { BountyConfig } from "../config.js";
import { fitString } from "./layout.js";

export interface LogItem {
  tag: string;
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
  private rl: readline.Interface | null = null;

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
    this.setupCommands();
  }

  public setOnPause(cb: (paused: boolean) => void): void {
    this.onPauseCallback = cb;
  }

  public setOnCapabilities(cb: () => void): void {
    this.onCapabilitiesCallback = cb;
  }

  private setupCommands(): void {
    if (process.stdin.isTTY && !this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan("bounty(seller) > ")
      });

      this.rl.on("line", (line) => {
        const cmd = line.trim().toLowerCase();
        if (!cmd) {
          this.rl?.prompt();
          return;
        }

        if (cmd === "exit" || cmd === "quit" || cmd === "q") {
          this.onQuitCallback?.();
        } else if (cmd === "pause" || cmd === "p") {
          this.state.status = "PAUSED";
          this.onPauseCallback?.(true);
          this.addEvent("[PAUSED]", "Worker bidding paused");
        } else if (cmd === "resume" || cmd === "r") {
          this.state.status = "ONLINE";
          this.onPauseCallback?.(false);
          this.addEvent("[ONLINE]", "Worker bidding resumed");
        } else if (cmd === "balance" || cmd === "b") {
          this.addEvent("[BAL]", `Lifetime Earned: $${this.state.lifetimeEarnedUsd.toFixed(2)} USD`);
        } else if (cmd === "caps" || cmd === "capabilities" || cmd === "c") {
          const capList = Object.entries(this.state.config.capabilities)
            .map(([k, v]) => `${k} ($${v.floorPriceUsd.toFixed(2)})`)
            .join(", ");
          this.addEvent("[CAPS]", `Capabilities: ${capList}`);
        } else if (cmd === "stats" || cmd === "s") {
          this.addEvent("[STAT]", `Jobs: ${this.state.jobsCompleted} · Active Nodes: ${this.state.nodesOnline}`);
        } else if (cmd === "clear") {
          this.state.jobEvents = [];
          this.render();
        } else if (cmd === "help" || cmd === "?") {
          this.addEvent("[INFO]", "Commands: pause | resume | balance | caps | stats | clear | exit");
        } else {
          this.addEvent("[WARN]", `Unknown command: ${cmd} (type help for list)`);
        }

        this.render();
        this.rl?.prompt();
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

  public addEvent(tag: string, text: string, detail?: string, color?: (str: string) => string): void {
    this.state.jobEvents.push({ tag, text, detail, color });
    if (this.state.jobEvents.length > 10) {
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
    }, 250);
    this.render();
    if (this.rl) {
      this.rl.prompt();
    }
  }

  public stop(): void {
    if (this.renderTimer) {
      clearInterval(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    logUpdate.done();
  }

  private render(): void {
    const spinner = cliSpinners.dots.frames[this.spinnerIndex];
    const { status, config, brokerUrl, nodesOnline, activeStep, jobEvents, lifetimeEarnedUsd, jobsCompleted, lastPayoutBatchId } = this.state;

    // Header styling
    const brand = chalk.white.bold("BOUNTY NODE");
    const ver = chalk.gray("v1.0.0");
    let statusPill = chalk.bgHex("#065f46").white.bold(" [ONLINE] ");
    if (status === "PAUSED") statusPill = chalk.bgHex("#78350f").yellow.bold(" [PAUSED] ");
    if (status === "CONNECTING") statusPill = chalk.bgHex("#1e293b").cyan.bold(" [CONNECTING] ");
    if (status === "DISCONNECTED") statusPill = chalk.bgHex("#7f1d1d").white.bold(" [DISCONNECTED] ");

    const leftColWidth = 52;
    const rightColWidth = 36;

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
        leftLines.push(`  ${chalk.cyan(ev.tag)}  ${text}${detailStr}`);
      }
    }

    if (activeStep) {
      const icon = activeStep.spinner ? chalk.cyan(spinner) : chalk.cyan(">");
      leftLines.push(`  ${icon}  ${chalk.white(activeStep.text)}`);
    } else if (status === "ONLINE") {
      leftLines.push(`  ${chalk.cyan(spinner)}  ${chalk.gray("Waiting for tasks on orderbook...")}`);
    }

    // Right Column Content: Earnings Ticker & Node HUD
    rightLines.push(chalk.gray("EARNINGS TICKER"));
    rightLines.push(chalk.gray("─".repeat(rightColWidth)));
    rightLines.push(`  ${chalk.gray(fitString("Lifetime Earned:", 18))} ${chalk.yellow.bold(`$${lifetimeEarnedUsd.toFixed(2)} USD`)}`);
    rightLines.push(`  ${chalk.gray(fitString("Jobs Completed:", 18))} ${chalk.white.bold(String(jobsCompleted))}`);
    rightLines.push(`  ${chalk.gray(fitString("Nodes Online:", 18))} ${chalk.cyan.bold(String(nodesOnline))}`);
    rightLines.push(`  ${chalk.gray(fitString("PayPal Account:", 18))} ${chalk.yellow(config.payoutDestination.value.slice(0, 16) + "...")}`);
    if (lastPayoutBatchId) {
      rightLines.push(`  ${chalk.gray(fitString("Latest Batch:", 18))} ${chalk.hex("#38bdf8")(lastPayoutBatchId.slice(0, 14))}`);
    }
    rightLines.push(chalk.gray("─".repeat(rightColWidth)));
    const caps = Object.keys(config.capabilities).join(", ");
    rightLines.push(`  ${chalk.gray(fitString("Capabilities:", 18))} ${chalk.green(caps.length > 16 ? caps.slice(0, 16) + "..." : caps)}`);

    // Merge into Split View with STRICT fixed-width alignment
    const maxRows = Math.max(leftLines.length, rightLines.length, 9);
    const combinedRows: string[] = [];

    for (let i = 0; i < maxRows; i++) {
      const left = leftLines[i] || "";
      const right = rightLines[i] || "";
      const leftFormatted = fitString(left, leftColWidth);
      const rightFormatted = fitString(right, rightColWidth);
      combinedRows.push(`  ${leftFormatted}  ${chalk.gray("│")}  ${rightFormatted}`);
    }

    const totalWidth = leftColWidth + rightColWidth + 7;
    const output = [
      "",
      `  ${brand} ${ver}       ${statusPill}        ${chalk.gray("Broker:")} ${chalk.cyan(brokerUrl)}`,
      `  ${chalk.gray("─".repeat(totalWidth))}`,
      ...combinedRows,
      `  ${chalk.gray("─".repeat(totalWidth))}`,
      `  ${chalk.gray("Commands:")} ${chalk.cyan("pause")}  ·  ${chalk.cyan("resume")}  ·  ${chalk.cyan("balance")}  ·  ${chalk.cyan("caps")}  ·  ${chalk.cyan("stats")}  ·  ${chalk.cyan("help")}  ·  ${chalk.cyan("exit")}`,
      ""
    ];

    logUpdate(output.join("\n"));
    if (this.rl) {
      this.rl.prompt(true);
    }
  }
}
