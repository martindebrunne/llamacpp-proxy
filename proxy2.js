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

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function isNonEmptyObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function hasUsableContent(value) {
  return (
    isNonEmptyString(value) ||
    isNonEmptyArray(value) ||
    isNonEmptyObject(value)
  );
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

  const looksLikeBrokenXml =
    trimmed.includes("<") || trimmed.includes("</") || trimmed.includes("/>");

  if (looksLikeBrokenXml) {
    return null;
  }

  return trimmed;
}

function recoverMessageFromReasoning(message) {
  if (!message || typeof message !== "object") return message;

  const cleanMessage = { ...message };

  const hasContent = hasUsableContent(cleanMessage.content);
  const hasToolCalls = isNonEmptyArray(cleanMessage.tool_calls);

  if (!hasContent && !hasToolCalls) {
    const recovered = pickBestRecoveredOutput(
      cleanMessage.reasoning_content ?? cleanMessage.reasoning
    );

    if (isNonEmptyString(recovered)) {
      cleanMessage.content = recovered;
    }
  }

  stripReasoningFields(cleanMessage);
  return cleanMessage;
}

function recoverDeltaFromReasoning(delta) {
  if (!delta || typeof delta !== "object") return null;

  const cleanDelta = { ...delta };

  const hasRole = cleanDelta.role === "assistant";
  const hasContent = hasUsableContent(cleanDelta.content);
  const hasToolCalls = isNonEmptyArray(cleanDelta.tool_calls);

  if (!hasContent && !hasToolCalls && !hasRole) {
    const recovered = pickBestRecoveredOutput(
      cleanDelta.reasoning_content ?? cleanDelta.reasoning
    );

    if (isNonEmptyString(recovered)) {
      cleanDelta.content = recovered;
    }
  }

  stripReasoningFields(cleanDelta);

  const finalHasContent = hasUsableContent(cleanDelta.content);
  const finalHasToolCalls = isNonEmptyArray(cleanDelta.tool_calls);
  const finalHasRole = cleanDelta.role === "assistant";

  if (!finalHasContent && !finalHasToolCalls && !finalHasRole) {
    return null;
  }

  return cleanDelta;
}

function sanitizeJsonChoice(choice) {
  if (!choice || typeof choice !== "object") return null;

  const cleanChoice = { ...choice };

  if (cleanChoice.delta) {
    const recoveredDelta = recoverDeltaFromReasoning(cleanChoice.delta);
    if (!recoveredDelta) return null;
    cleanChoice.delta = recoveredDelta;
    return cleanChoice;
  }

  if (cleanChoice.message) {
    const recoveredMessage = recoverMessageFromReasoning(cleanChoice.message);
    const hasContent = hasUsableContent(recoveredMessage?.content);
    const hasToolCalls = isNonEmptyArray(recoveredMessage?.tool_calls);

    if (!hasContent && !hasToolCalls) return null;

    cleanChoice.message = recoveredMessage;
    return cleanChoice;
  }

  return cleanChoice;
}

function sanitizeJsonText(text) {
  try {
    const parsed = JSON.parse(text);
    const usage = parsed?.usage;

    if (Array.isArray(parsed?.choices)) {
      parsed.choices = parsed.choices.map(sanitizeJsonChoice).filter(Boolean);
    }

    if (parsed?.message && typeof parsed.message === "object") {
      parsed.message = recoverMessageFromReasoning(parsed.message);
    }

    if (usage) {
      parsed.usage = usage;
    }

    return JSON.stringify(parsed);
  } catch {
    return text;
  }
}

function parseSseEventBlock(block) {
  const lines = block.split(/\r?\n/);
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      dataLines.push(line.slice(6));
    }
  }

  if (dataLines.length === 0) return null;

  const payload = dataLines.join("\n");

  if (payload === "[DONE]") {
    return { type: "done" };
  }

  try {
    return { type: "json", data: JSON.parse(payload) };
  } catch {
    return { type: "raw", data: payload };
  }
}

function serializeSseEvent(json) {
  return `data: ${JSON.stringify(json)}\n\n`;
}

function createSseChunkFromTemplate(baseChunk, choice, delta) {
  return {
    id: baseChunk?.id ?? "proxy-stream",
    object: baseChunk?.object ?? "chat.completion.chunk",
    created: baseChunk?.created ?? Math.floor(Date.now() / 1000),
    model: baseChunk?.model ?? REAL_MODEL,
    choices: [
      {
        index: choice?.index ?? 0,
        delta,
        finish_reason: null,
      },
    ],
  };
}

function splitSseBlocks(buffer) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const complete = parts.slice(0, -1);
  const remainder = parts[parts.length - 1] ?? "";
  return { complete, remainder };
}

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

async function forwardStreamingResponse(req, res, upstream, mapped, upstreamPath, startTime) {
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let rawResponseText = "";
  let sseBuffer = "";

  let assistantRoleSent = false;
  let accumulatedReasoning = "";
  let sawUsefulContent = false;
  let sawToolCalls = false;
  let sawDone = false;
  let lastUsage = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      rawResponseText += chunkText;
      sseBuffer += chunkText;

      const { complete, remainder } = splitSseBlocks(sseBuffer);
      sseBuffer = remainder;

      for (const block of complete) {
        if (!block.trim()) continue;

        const event = parseSseEventBlock(block);
        if (!event) continue;

        if (event.type === "done") {
          sawDone = true;
          continue;
        }

        if (event.type !== "json") {
          continue;
        }

        const chunk = event.data;

        if (!chunk || !Array.isArray(chunk.choices) || chunk.choices.length === 0) {
          if (chunk?.usage) {
            lastUsage = chunk.usage;
          }
          continue;
        }

        if (chunk?.usage) {
          lastUsage = chunk.usage;
        }

        for (const choice of chunk.choices) {
          const delta = choice?.delta;
          const message = choice?.message;

          if (delta && typeof delta === "object") {
            if (delta.role === "assistant" && !assistantRoleSent) {
              res.write(
                serializeSseEvent(
                  createSseChunkFromTemplate(chunk, choice, { role: "assistant" })
                )
              );
              assistantRoleSent = true;
            }

            if (hasUsableContent(delta.content)) {
              res.write(
                serializeSseEvent(
                  createSseChunkFromTemplate(chunk, choice, { content: delta.content })
                )
              );
              sawUsefulContent = true;
            }

            if (isNonEmptyArray(delta.tool_calls)) {
              res.write(
                serializeSseEvent(
                  createSseChunkFromTemplate(chunk, choice, { tool_calls: delta.tool_calls })
                )
              );
              sawToolCalls = true;
            }

            if (isNonEmptyString(delta.reasoning_content)) {
              accumulatedReasoning += delta.reasoning_content;
            } else if (isNonEmptyString(delta.reasoning)) {
              accumulatedReasoning += delta.reasoning;
            }
          } else if (message && typeof message === "object") {
            if (!assistantRoleSent) {
              res.write(
                serializeSseEvent(
                  createSseChunkFromTemplate(chunk, choice, { role: "assistant" })
                )
              );
              assistantRoleSent = true;
            }

            if (hasUsableContent(message.content)) {
              res.write(
                serializeSseEvent(
                  createSseChunkFromTemplate(chunk, choice, { content: message.content })
                )
              );
              sawUsefulContent = true;
            }

            if (isNonEmptyArray(message.tool_calls)) {
              res.write(
                serializeSseEvent(
                  createSseChunkFromTemplate(chunk, choice, { tool_calls: message.tool_calls })
                )
              );
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
    }

    const trailing = decoder.decode();
    if (trailing) {
      rawResponseText += trailing;
      sseBuffer += trailing;
    }

    if (sseBuffer.trim()) {
      const event = parseSseEventBlock(sseBuffer);
      if (event?.type === "done") {
        sawDone = true;
      } else if (event?.type === "json" && event.data?.usage) {
        lastUsage = event.data.usage;
      }
    }

    if (!sawUsefulContent && !sawToolCalls) {
      const recovered = pickBestRecoveredOutput(accumulatedReasoning);

      if (isNonEmptyString(recovered)) {
        if (!assistantRoleSent) {
          res.write(
            serializeSseEvent({
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
            })
          );
        }

        const recoveredChunk = {
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
        };

        if (lastUsage) {
          recoveredChunk.usage = lastUsage;
        }

        res.write(serializeSseEvent(recoveredChunk));
      }
    }

    if (lastUsage && (sawUsefulContent || sawToolCalls)) {
      res.write(
        serializeSseEvent({
          id: "proxy-usage",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: REAL_MODEL,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: null,
            },
          ],
          usage: lastUsage,
        })
      );
    }

    if (sawDone) {
      res.write("data: [DONE]\n\n");
    } else {
      res.write("data: [DONE]\n\n");
    }

    res.end();

    const duration = Date.now() - startTime;
    let responseForLog = { text: rawResponseText, json: null };
    try {
      responseForLog.json = JSON.parse(rawResponseText);
    } catch {}

    await logRequest(req, upstreamPath, startTime, mapped, upstream.status, duration, responseForLog);
  } catch (e) {
    const duration = Date.now() - startTime;
    error("Streaming request failed", `${req.originalUrl} | ${String(e)}`);

    if (!res.headersSent) {
      res.status(500).json({
        error: "proxy_error",
        message: String(e),
      });
    } else {
      try {
        res.end();
      } catch {}
    }

    await logRequest(req, upstreamPath, startTime, mapped, 500, duration, { text: rawResponseText, json: null });
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}

function sanitizeResponseText(contentType, text, incomingModel) {
  // Mode No-Think: retour brut sans transformation
  if (incomingModel && incomingModel.includes("No-Think")) {
    return text;
  }

  const normalizedType = (contentType || "").toLowerCase();

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

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    if (!upstream.body) {
      res.end();
      const duration = Date.now() - startTime;
      await logRequest(req, upstreamPath, startTime, mapped, upstream.status, duration, response);
      return;
    }

    const isNoThink = req.body?.model?.includes("No-Think");
    const isEventStream = (contentType || "").toLowerCase().includes("text/event-stream");

    if (isEventStream && !isNoThink) {
      return await forwardStreamingResponse(req, res, upstream, mapped, upstreamPath, startTime);
    }

    response = await collectResponse(upstream);

    if (response?.text) {
      const sanitizedText = sanitizeResponseText(contentType, response.text, req.body?.model);
      res.write(Buffer.from(sanitizedText, "utf-8"));
    }

    res.end();

    const duration = Date.now() - startTime;
    await logRequest(req, upstreamPath, startTime, mapped, upstream.status, duration, response);
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

// Exposer la liste des modèles avec variantes Think/No-Think
app.get(["/models", "/v1/models"], async (_req, res) => {
  try {
    // Fetch upstream models
    const upstreamResponse = await fetch(`${LLAMA_ORIGIN}/v1/models`);
    let upstreamModels = [];
    
    if (upstreamResponse.ok) {
      const upstreamData = await upstreamResponse.json();
      upstreamModels = upstreamData.data || [];
    }
    
    // Build model list with Think/No-Think variants
    const modelData = upstreamModels.map(model => {
      const modelId = model.id;
      return [
        { id: `${modelId}-Think`, object: "model", owned_by: "local" },
        { id: `${modelId}-No-Think`, object: "model", owned_by: "local" },
      ];
    }).flat();
    
    // Add upstream models without variants
    modelData.push(...upstreamModels);
    
    res.json({
      object: "list",
      data: modelData,
    });
  } catch (e) {
    // Fallback to basic model list if upstream is unavailable
    res.json({
      object: "list",
      data: [
        { id: `${REAL_MODEL}-Think`, object: "model", owned_by: "local" },
        { id: `${REAL_MODEL}-No-Think`, object: "model", owned_by: "local" },
      ],
    });
  }
});

// Middleware de logging pour les requêtes passthrough
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Hook pour logger après la réponse
  const originalEnd = res.end.bind(res);
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    requestLogConsole({
      method: req.method,
      path: req.originalUrl || req.url,
      incomingModel: req.body?.model,
      upstreamModel: "-",
      thinking: "-",
      status: res.statusCode,
      duration,
    });
    originalEnd(...args);
  };
  
  next();
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