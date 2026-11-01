/**
 * Minimalist, ANSI-safe CLI layout and alignment engine.
 * Inspired by GitHub CLI, Claude CLI, and Vercel CLI.
 */

// Standard ECMA-48 ANSI escape pattern
const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export function fitString(str: string, width: number): string {
  const len = visibleLength(str);
  if (len === width) return str;
  if (len < width) {
    return str + " ".repeat(width - len);
  }
  // Truncate cleanly while preserving text
  const plain = stripAnsi(str);
  return plain.slice(0, Math.max(0, width - 3)) + "...";
}

export function createBoxRow(content: string, innerWidth: number, border = "│"): string {
  const fitted = fitString(content, innerWidth);
  return `  ${border}  ${fitted}  ${border}`;
}

