import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { requestLog, requestLogConsole, info, error, flushLogs } from "./lib/logger.js";

const app = express();

// Graceful shutdown handler
process.on("SIGTERM", async () => {
  info("Received SIGTERM, flushing logs and shutting down");
  await flushLogs();
  process.exit(0);
});

process.on("SIGINT", async () => {
  info("Received SIGINT, flushing logs and shutting down");
  await flushLogs();
  process.exit(0);
});

/**
 * Parse port configuration from command line or environment
 * Supports formats: "3000", "3000:4000", "PROXY_PORT:UPSTREAM_PORT"
 */
function parsePortConfig() {
  const arg = process.argv[2];
  
  // Check command line argument (e.g., "3000:4000")
  if (arg && arg.includes(":")) {
    const [proxyPort, upstreamPort] = arg.split(":").map(Number);
    if (!isNaN(proxyPort) && !isNaN(upstreamPort)) {
      return {
        PROXY_PORT: proxyPort,
        UPSTREAM_PORT: upstreamPort,
      };
    }
  }
  
  // Check environment variables
  const proxyPort = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : 4000;
  const upstreamPort = process.env.UPSTREAM_PORT ? Number(process.env.UPSTREAM_PORT) : 8080;
  
  return {
    PROXY_PORT: isNaN(proxyPort) ? 4000 : proxyPort,
    UPSTREAM_PORT: isNaN(upstreamPort) ? 8080 : upstreamPort,
  };
}

const { PROXY_PORT, UPSTREAM_PORT } = parsePortConfig();
const PROXY_HOST = process.env.PROXY_HOST || "127.0.0.1";
const LLAMA_ORIGIN = `http://${process.env.UPSTREAM_HOST || "127.0.0.1"}:${UPSTREAM_PORT}`;

// vrai modèle upstream llama.cpp
const REAL_MODEL = "Qwen3.5-35B-A3B-T";

// parse JSON seulement pour les routes qu'on intercepte
app.use(
  ["/chat/completions", "/v1/chat/completions", "/completions", "/v1/completions"],
  express.json({ limit: "5mb" })
);

function mapRequest(body = {}) {
  const model = body.model || "";

  let enableThinking;

  if (model.includes("No-Think")) {
    enableThinking = false;
  } else if (model.includes("Think")) {
    enableThinking = true;
  } else {
    return body;
  }

  return {
    ...body,
    model: REAL_MODEL,
    chat_template_kwargs: {
      ...(body.chat_template_kwargs || {}),
      enable_thinking: enableThinking,
    },
  };
}

/**
 * Collect response body for logging
 */
async function collectResponse(upstream) {
  if (!upstream.body) return null;
  
  const chunks = [];
  const reader = upstream.body.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.cancel();
  }
  
  const buffer = Buffer.concat(chunks);
  const text = buffer.toString('utf-8');
  
  // Try to parse as JSON for structured logging
  try {
    const json = JSON.parse(text);
    return { text, json };
  } catch {
    return { text, json: null };
  }
}

/**
 * Log request with timing and payloads
 */
async function logRequest(req, upstreamPath, startTime, mapped, status, duration, response) {
  // Log to file
  await requestLog({
    method: req.method,
    path: req.originalUrl,
    incomingModel: req.body?.model,
    upstreamModel: mapped?.model,
    thinking: mapped?.chat_template_kwargs?.enable_thinking,
    status,
    duration,
    requestPayload: req.body,
    responsePayload: response?.json || response?.text,
  });
  
  // Log to console (compressed format)
  requestLogConsole({
    method: req.method,
    path: req.originalUrl,
    incomingModel: req.body?.model,
    upstreamModel: mapped?.model,
    thinking: mapped?.chat_template_kwargs?.enable_thinking,
    status,
    duration,
  });
}

async function forwardJsonPost(req, res, upstreamPath) {
  const startTime = Date.now();
  let response = null;

  try {
    const mapped = mapRequest(req.body);

    const upstream = await fetch(`${LLAMA_ORIGIN}${upstreamPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization
          ? { Authorization: req.headers.authorization }
          : {}),
      },
      body: JSON.stringify(mapped),
    });

    const status = upstream.status;
    const duration = Date.now() - startTime;

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    if (!upstream.body) {
      res.end();
      await logRequest(req, upstreamPath, startTime, mapped, status, duration, response);
      return;
    }

    // Collect response first (stream can only be read once)
    response = await collectResponse(upstream);
    
    // Stream collected response to client
    if (response && response.text) {
      const chunks = Buffer.from(response.text);
      res.write(chunks);
    }

    res.end();
    await logRequest(req, upstreamPath, startTime, mapped, status, duration, response);
  } catch (e) {
    const duration = Date.now() - startTime;
    error(`Request failed`, `${req.originalUrl} | ${String(e)}`);
    res.status(500).json({
      error: "proxy_error",
      message: String(e),
    });
    await logRequest(req, upstreamPath, startTime, null, 500, duration, response);
  }
}

// intercepte seulement les routes OpenAI utiles
app.post(["/chat/completions", "/v1/chat/completions"], async (req, res) => {
  await forwardJsonPost(req, res, "/v1/chat/completions");
});

app.post(["/completions", "/v1/completions"], async (req, res) => {
  await forwardJsonPost(req, res, "/v1/completions");
});

// optionnel : exposer une liste simple de modèles logiques à Cline
app.get(["/models", "/v1/models"], (_req, res) => {
  res.json({
    object: "list",
    data: [
      { id: `${REAL_MODEL}-Think`, object: "model", owned_by: "local" },
      { id: `${REAL_MODEL}-No-Think`, object: "model", owned_by: "local" },
    ],
  });
});

// tout le reste = passthrough brut vers llama-server
app.use(
  createProxyMiddleware({
    target: LLAMA_ORIGIN,
    changeOrigin: true,
    ws: true,
    logLevel: "silent",
    proxyTimeout: 300000,
    timeout: 300000,
  })
);

app.listen(PROXY_PORT, PROXY_HOST, () => {
  info("Proxy started", `listening on http://${PROXY_HOST}:${PROXY_PORT}`);
  info("Passthrough target", LLAMA_ORIGIN);
  info("Base upstream model", REAL_MODEL);
});
