import chalk from "chalk";

export const theme = {
  // Brand accents
  brand: chalk.cyan.bold,
  brandDim: chalk.cyan,
  accent: chalk.hex("#38bdf8"), // Sky cyan
  gold: chalk.hex("#fbbf24").bold, // Amber / PayPal gold
  emerald: chalk.hex("#34d399").bold, // Success green
  crimson: chalk.hex("#f87171").bold, // Error red
  muted: chalk.hex("#94a3b8"), // Slate gray
  dim: chalk.hex("#64748b"), // Deep slate
  white: chalk.white.bold,

  // Semantic Badges
  badgeOnline: chalk.bgHex("#065f46").hex("#34d399").bold(" ● ONLINE "),
  badgeConnecting: chalk.bgHex("#1e293b").hex("#38bdf8").bold(" ⠋ CONNECTING "),
  badgeExecuting: chalk.bgHex("#78350f").hex("#fbbf24").bold(" ⚙ EXECUTING "),
  badgeSettled: chalk.bgHex("#1e3a8a").hex("#60a5fa").bold(" 💰 SETTLED "),
  badgePaused: chalk.bgHex("#334155").hex("#94a3b8").bold(" ❚❚ PAUSED "),
  badgeDisconnected: chalk.bgHex("#7f1d1d").hex("#fca5a5").bold(" ✕ DISCONNECTED "),

  // Glyphs
  glyphs: {
    dot: "●",
    check: "✓",
    cross: "✕",
    bolt: "⚡",
    gear: "⚙",
    money: "💰",
    sparkle: "✦",
    arrowRight: "➔",
    bullet: "›",
    barH: "─",
    barV: "│",
    cornerTL: "┌",
    cornerTR: "┐",
    cornerBL: "└",
    cornerBR: "┘"
  }
};
