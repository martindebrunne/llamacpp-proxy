/**
 * Llama Proxy - Main Entry Point
 * 
 * A lightweight Node.js proxy server that bridges OpenAI-compatible clients
 * with local llama.cpp servers, providing model abstraction and thinking mode control.
 */

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "./config/index.js";
import routes from "./routes/index.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { info, consoleInfo } from "../lib/logger.js";
import { findAvailablePort } from "./utils/portChecker.js";
import { MAX_PORT_FALLBACK_ATTEMPTS } from "./config/index.js";

const app = express();

// Graceful shutdown handlers
process.on("SIGTERM", async () => {
  info("Received SIGTERM, flushing logs and shutting down");
  const { flushLogs } = await import("../lib/logger.js");
  await flushLogs();
  process.exit(0);
});

process.on("SIGINT", async () => {
  info("Received SIGINT, flushing logs and shutting down");
  const { flushLogs } = await import("../lib/logger.js");
  await flushLogs();
  process.exit(0);
});

// Parse JSON for intercepted routes
app.use(
  ["/chat/completions", "/v1/chat/completions", "/completions", "/v1/completions"],
  express.json({ limit: "5mb" })
);

// Use routes
app.use("/", routes);

// Logging middleware for passthrough requests
app.use(loggingMiddleware);

// Proxy everything else to upstream
app.use(
  createProxyMiddleware({
    target: config.LLAMA_ORIGIN,
    changeOrigin: true,
    ws: true,
    logLevel: "silent",
    proxyTimeout: 300000,
    timeout: 300000,
  })
);

// Error handler
app.use(errorHandler);

// Start server with port fallback
async function startServer() {
  let actualPort = config.PROXY_PORT;
  
  try {
    actualPort = await findAvailablePort(config.PROXY_PORT, MAX_PORT_FALLBACK_ATTEMPTS);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    info("Fatal error", `Could not find an available port: ${errorMessage}`);
    process.exit(1);
  }
  
  const server = app.listen(actualPort, config.PROXY_HOST, () => {
    if (actualPort !== config.PROXY_PORT) {
      consoleInfo(
        "Port fallback",
        `Primary port ${config.PROXY_PORT} was in use, using port ${actualPort} instead`
      );
    }
    consoleInfo("Proxy started", `listening on http://${config.PROXY_HOST}:${actualPort}`);
    consoleInfo("Passthrough target", config.LLAMA_ORIGIN);
    consoleInfo("Dynamic model detection enabled - real model extracted from incoming requests");
  });
  
  // Handle server errors
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      info("Fatal error", `Port ${actualPort} is already in use`);
    } else {
      info("Server error", err.message);
    }
  });
}

startServer();
