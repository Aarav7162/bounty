import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, extname } from "node:path";

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function main() {
  console.log("\n========================================================");
  console.log("  VERIFYING AG GRID DASHBOARD VIA PLAYWRIGHT");
  console.log("========================================================");

  const screenshotsDir = resolve(process.cwd(), "docs/screenshots");
  if (!existsSync(screenshotsDir)) {
    mkdirSync(screenshotsDir, { recursive: true });
  }

  const distDir = resolve(process.cwd(), "packages/dashboard/dist");
  if (!existsSync(resolve(distDir, "index.html"))) {
    throw new Error(`Dashboard build not found in ${distDir}. Run 'npm run build --workspace=@bounty/dashboard' first.`);
  }

  const PORT = 5173;
  console.log(`1. Serving production dashboard on http://localhost:${PORT}...`);

  const server = createServer((req, res) => {
    let reqPath = req.url?.split("?")[0] || "/";
    if (reqPath === "/") reqPath = "/index.html";
    const filePath = resolve(distDir, `.${reqPath}`);

    if (existsSync(filePath)) {
      const ext = extname(filePath);
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
      res.end(readFileSync(filePath));
    } else {
      // SPA Fallback
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(readFileSync(resolve(distDir, "index.html")));
    }
  });

  await new Promise<void>((resolveServer) => {
    server.listen(PORT, () => {
      console.log(`✓ Dashboard server listening on http://localhost:${PORT}`);
      resolveServer();
    });
  });

  try {
    // 2. Launch Playwright Chromium
    console.log("2. Launching Playwright Chromium...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    const consoleErrors: string[] = [];
    const page = await context.newPage();

    page.on("console", (msg) => {
      const text = msg.text();
      // Filter harmless dev or network warnings
      if (msg.type() === "error" && !text.includes("WebSocket") && !text.includes("Failed to load resource")) {
        console.error(`   [Browser Error] ${text}`);
        consoleErrors.push(text);
      }
    });

    page.on("pageerror", (err) => {
      console.error(`   [Page Uncaught Error] ${err.message}`);
      consoleErrors.push(err.message);
    });

    // 3. Test at 1440px Viewport
    console.log("\n3. Testing Viewport: 1440x900 ...");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" });

    // Wait for AG Grid canvas to be mounted
    await page.waitForSelector(".ag-root-wrapper", { timeout: 10000 });
    await page.waitForSelector(".ag-header-cell", { timeout: 10000 });
    await page.waitForTimeout(1000); // Allow styles and custom cell renderers to stabilize

    const screenshot1440Path = resolve(screenshotsDir, "dashboard_1440px.png");
    await page.screenshot({ path: screenshot1440Path, fullPage: true });
    console.log(`✓ Saved 1440px screenshot: ${screenshot1440Path}`);

    // 4. Test at 1280px Viewport
    console.log("\n4. Testing Viewport: 1280x800 ...");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(800);

    const screenshot1280Path = resolve(screenshotsDir, "dashboard_1280px.png");
    await page.screenshot({ path: screenshot1280Path, fullPage: true });
    console.log(`✓ Saved 1280px screenshot: ${screenshot1280Path}`);

    // 5. Test Quick Filter Interactivity
    console.log("\n5. Testing Quick Filter input...");
    const filterInput = page.locator("#filter-text-box");
    await filterInput.fill("python");
    await page.waitForTimeout(500);

    const rowsCount = await page.locator(".ag-row:not(.ag-row-pinned)").count();
    console.log(`   Rows matching 'python' filter: ${rowsCount}`);
    await filterInput.fill(""); // Clear

    // 6. Test CSV Export Button
    console.log("\n6. Testing Export CSV button presence and interactivity...");
    const exportBtn = page.locator("button:has-text('Export CSV')");
    await exportBtn.click();
    console.log("✓ Export CSV button clicked successfully");

    await browser.close();

    console.log("\n========================================================");
    console.log("  PLAYWRIGHT VERIFICATION SUMMARY");
    console.log("========================================================");
    console.log(`Console Errors:      ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log("Errors logged:", consoleErrors);
    } else {
      console.log("✓ Zero fatal console errors detected!");
    }
    console.log(`1440px Screenshot:   ${screenshot1440Path}`);
    console.log(`1280px Screenshot:   ${screenshot1280Path}`);
    console.log("========================================================\n");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("Playwright verification error:", err);
  process.exit(1);
});
