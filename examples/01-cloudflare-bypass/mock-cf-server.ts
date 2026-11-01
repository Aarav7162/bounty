import express, { Request, Response } from "express";
import { Server } from "node:http";

export function createMockCfApp() {
  const app = express();

  app.get("/protected", (req: Request, res: Response): void => {
    const bypassHeader = req.headers["x-bounty-bypass"];

    if (bypassHeader === "true" || bypassHeader === "1") {
      res.setHeader("Content-Type", "application/json");
      res.status(200).json({
        status: "success",
        bypass: true,
        source: "Mock Cloudflare Protected API",
        items: [
          { symbol: "NVDA", price: 142.85, change: "+3.2%", volume: "48.2M" },
          { symbol: "AAPL", price: 231.10, change: "+0.8%", volume: "32.1M" },
          { symbol: "GOOGL", price: 184.50, change: "+1.9%", volume: "19.5M" }
        ],
        message: "Authentication cleared via X-Bounty-Bypass residential proxy",
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Default: Simulate Cloudflare 403 Forbidden with Turnstile challenge
    res.setHeader("cf-turnstile", "required");
    res.setHeader("cf-ray", `8847bc12-${Date.now().toString(36)}`);
    res.status(403).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Just a moment...</title>
  <meta charset="UTF-8">
</head>
<body>
  <h1>Attention Required! | Cloudflare</h1>
  <p>Please complete the security check to access market data.</p>
  <div class="cf-turnstile" data-sitekey="0x4AAAAAAABcDeFgHiJkLmNo"></div>
  <p>Cloudflare Ray ID: 8847bc1298ef4a12 · Your IP: 192.0.2.1</p>
</body>
</html>
    `.trim());
  });

  return app;
}

export async function startMockCfServer(port = 5000): Promise<{ server: Server; stop: () => Promise<void> }> {
  const app = createMockCfApp();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`[Mock Cloudflare] Listening on http://localhost:${port}/protected`);
      resolve({
        server,
        stop: () => new Promise<void>((r) => server.close(() => r()))
      });
    });
  });
}

// Direct execution
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const port = Number(process.env.PORT || 5000);
  startMockCfServer(port);
}

