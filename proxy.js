import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 4000;

const LLAMA_ORIGIN = "http://127.0.0.1:8080";

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

async function forwardJsonPost(req, res, upstreamPath) {
  try {
    const mapped = mapRequest(req.body);

    console.log(
      `[POST] ${req.originalUrl} -> ${upstreamPath} | incoming=${req.body?.model} | upstream=${mapped.model} | thinking=${mapped.chat_template_kwargs?.enable_thinking}`
    );

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

    res.status(upstream.status);

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();

    res.on("close", () => {
      try {
        reader.cancel();
      } catch {}
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }

    res.end();
  } catch (e) {
    console.error(`[ERROR] ${req.originalUrl}`, e);
    res.status(500).json({
      error: "proxy_error",
      message: String(e),
    });
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
  console.log(`Proxy listening on http://${PROXY_HOST}:${PROXY_PORT}`);
  console.log(`Passthrough target: ${LLAMA_ORIGIN}`);
  console.log(`Base upstream model: ${REAL_MODEL}`);
});