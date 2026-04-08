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

  if (arg && arg.includes(":")) {
    const [proxyPort, upstreamPort] = arg.split(":").map(Number);
    if (!isNaN(proxyPort) && !isNaN(upstreamPort)) {
      return {
        PROXY_PORT: proxyPort,
        UPSTREAM_PORT: upstreamPort,
      };
    }
  }

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

  // Mode No-Think: retour brut sans transformation
  if (model.includes("No-Think")) {
    return body;
  }

  // Mode Think: transformation avec enable_thinking
  if (model.includes("Think")) {
    return {
      ...body,
      model: REAL_MODEL,
      chat_template_kwargs: {
        ...(body.chat_template_kwargs || {}),
        enable_thinking: true,
      },
    };
  }

  // Modèle inconnu: retour brut
  return body;
}

/**
 * Collect response body for logging / post-processing
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
  const text = buffer.toString("utf-8");

  try {
    const json = JSON.parse(text);
    return { text, json };
  } catch {
    return { text, json: null };
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function stripReasoningFields(obj) {
  if (!obj || typeof obj !== "object") return obj;
  delete obj.reasoning_content;
  delete obj.reasoning;
  return obj;
}

function extractAllXmlBlocks(text) {
  if (!isNonEmptyString(text)) return [];

  const blocks = [];
  const pattern = /<([a-zA-Z_][\w:-]*)>[\s\S]*?<\/\1>/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const block = match[0]?.trim();
    if (block) blocks.push(block);
  }

  return blocks;
}

function pickBestRecoveredOutput(reasoningText) {
  if (!isNonEmptyString(reasoningText)) return null;

  const trimmed = reasoningText.trim();
  if (!trimmed) return null;

  const xmlBlocks = extractAllXmlBlocks(trimmed);
  if (xmlBlocks.length > 0) {
    return xmlBlocks[xmlBlocks.length - 1];
  }

  // Fallback prudence: si le reasoning ressemble à une sortie XML incomplète,
  // on préfère ne rien reconstruire plutôt que d'envoyer un faux bloc.
  const looksLikeBrokenXml =
    trimmed.includes("<") || trimmed.includes("</") || trimmed.includes("/>");

  if (looksLikeBrokenXml) {
    return null;
  }

  // En dernier recours, on peut récupérer du texte simple non vide.
  return trimmed;
}

function sanitizeJsonChoice(choice) {
  if (!choice || typeof choice !== "object") return null;

  const cleanChoice = { ...choice };

  if (cleanChoice.delta) {
    const cleanDelta = { ...cleanChoice.delta };
    stripReasoningFields(cleanDelta);
    cleanChoice.delta = cleanDelta;
    return cleanChoice;
  }

  if (cleanChoice.message) {
    const cleanMessage = { ...cleanChoice.message };
    stripReasoningFields(cleanMessage);
    cleanChoice.message = cleanMessage;
    return cleanChoice;
  }

  return cleanChoice;
}

function sanitizeJsonText(text) {
  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed?.choices)) {
      parsed.choices = parsed.choices.map(sanitizeJsonChoice).filter(Boolean);
    }

    if (parsed?.message && typeof parsed.message === "object") {
      parsed.message = stripReasoningFields({ ...parsed.message });
    }

    return JSON.stringify(parsed);
  } catch {
    return text;
  }
}

function parseSseLines(text) {
  const lines = text.split(/\r?\n/);
  const events = [];

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;

    const payload = line.slice(6);

    if (payload === "[DONE]") {
      events.push({ type: "done" });
      continue;
    }

    try {
      events.push({ type: "json", data: JSON.parse(payload) });
    } catch {
      events.push({ type: "raw", data: payload });
    }
  }

  return events;
}

function buildCleanSseFromEvents(events) {
  let assistantRoleSent = false;
  const outputLines = [];

  let accumulatedContent = "";
  let accumulatedReasoning = "";
  let sawUsefulContent = false;
  let sawToolCalls = false;
  let sawDone = false;

  for (const event of events) {
    if (event.type === "done") {
      sawDone = true;
      continue;
    }

    if (event.type !== "json") {
      continue;
    }

    const chunk = event.data;
    if (!chunk || !Array.isArray(chunk.choices) || chunk.choices.length === 0) {
      continue;
    }

    for (const choice of chunk.choices) {
      const delta = choice?.delta;
      const message = choice?.message;

      if (delta && typeof delta === "object") {
        if (delta.role === "assistant" && !assistantRoleSent) {
          const roleChunk = {
            ...chunk,
            choices: [
              {
                ...choice,
                delta: { role: "assistant" },
              },
            ],
          };
          outputLines.push(`data: ${JSON.stringify(roleChunk)}`);
          assistantRoleSent = true;
        }

        if (isNonEmptyString(delta.content)) {
          const contentChunk = {
            ...chunk,
            choices: [
              {
                ...choice,
                delta: { content: delta.content },
              },
            ],
          };
          outputLines.push(`data: ${JSON.stringify(contentChunk)}`);
          accumulatedContent += delta.content;
          sawUsefulContent = true;
        } else if (isNonEmptyArray(delta.content)) {
          const contentChunk = {
            ...chunk,
            choices: [
              {
                ...choice,
                delta: { content: delta.content },
              },
            ],
          };
          outputLines.push(`data: ${JSON.stringify(contentChunk)}`);
          sawUsefulContent = true;
        }

        if (isNonEmptyArray(delta.tool_calls)) {
          const toolChunk = {
            ...chunk,
            choices: [
              {
                ...choice,
                delta: { tool_calls: delta.tool_calls },
              },
            ],
          };
          outputLines.push(`data: ${JSON.stringify(toolChunk)}`);
          sawToolCalls = true;
        }

        if (isNonEmptyString(delta.reasoning_content)) {
          accumulatedReasoning += delta.reasoning_content;
        } else if (isNonEmptyString(delta.reasoning)) {
          accumulatedReasoning += delta.reasoning;
        }
      } else if (message && typeof message === "object") {
        if (!assistantRoleSent) {
          const roleChunk = {
            id: chunk.id,
            object: "chat.completion.chunk",
            created: chunk.created,
            model: chunk.model,
            choices: [
              {
                index: choice.index ?? 0,
                delta: { role: "assistant" },
                finish_reason: null,
              },
            ],
          };
          outputLines.push(`data: ${JSON.stringify(roleChunk)}`);
          assistantRoleSent = true;
        }

        if (isNonEmptyString(message.content)) {
          const contentChunk = {
            id: chunk.id,
            object: "chat.completion.chunk",
            created: chunk.created,
            model: chunk.model,
            choices: [
              {
                index: choice.index ?? 0,
                delta: { content: message.content },
                finish_reason: null,
              },
            ],
          };
          outputLines.push(`data: ${JSON.stringify(contentChunk)}`);
          accumulatedContent += message.content;
          sawUsefulContent = true;
        }

        if (isNonEmptyArray(message.tool_calls)) {
          const toolChunk = {
            id: chunk.id,
            object: "chat.completion.chunk",
            created: chunk.created,
            model: chunk.model,
            choices: [
              {
                index: choice.index ?? 0,
                delta: { tool_calls: message.tool_calls },
                finish_reason: null,
              },
            ],
          };
          outputLines.push(`data: ${JSON.stringify(toolChunk)}`);
          sawToolCalls = true;
        }

        if (isNonEmptyString(message.reasoning_content)) {
          accumulatedReasoning += message.reasoning_content;
        } else if (isNonEmptyString(message.reasoning)) {
          accumulatedReasoning += message.reasoning;
        }
      }
    }
  }

  if (!sawUsefulContent && !sawToolCalls) {
    const recovered = pickBestRecoveredOutput(accumulatedReasoning);

    if (isNonEmptyString(recovered)) {
      if (!assistantRoleSent) {
        outputLines.push(
          `data: ${JSON.stringify({
            id: "proxy-recovered-role",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: REAL_MODEL,
            choices: [
              {
                index: 0,
                delta: { role: "assistant" },
                finish_reason: null,
              },
            ],
          })}`
        );
      }

      outputLines.push(
        `data: ${JSON.stringify({
          id: "proxy-recovered-content",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: REAL_MODEL,
          choices: [
            {
              index: 0,
              delta: { content: recovered },
              finish_reason: null,
            },
          ],
        })}`
      );
    }
  }

  if (sawDone) {
    outputLines.push("data: [DONE]");
  }

  return outputLines.join("\n\n") + (outputLines.length ? "\n\n" : "");
}

function sanitizeResponseText(contentType, text, incomingModel) {
  // Mode No-Think: retour brut sans transformation
  if (incomingModel && incomingModel.includes("No-Think")) {
    return text;
  }

  const normalizedType = (contentType || "").toLowerCase();

  if (normalizedType.includes("text/event-stream")) {
    const events = parseSseLines(text);
    return buildCleanSseFromEvents(events);
  }

  if (normalizedType.includes("application/json")) {
    return sanitizeJsonText(text);
  }

  return text;
}

/**
 * Log request with timing and payloads
 */
async function logRequest(req, upstreamPath, startTime, mapped, status, duration, response) {
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

    response = await collectResponse(upstream);

    if (response?.text) {
      const sanitizedText = sanitizeResponseText(contentType, response.text, req.body?.model);
      res.write(Buffer.from(sanitizedText, "utf-8"));
    }

    res.end();
    await logRequest(req, upstreamPath, startTime, mapped, status, duration, response);
  } catch (e) {
    const duration = Date.now() - startTime;
    error("Request failed", `${req.originalUrl} | ${String(e)}`);

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