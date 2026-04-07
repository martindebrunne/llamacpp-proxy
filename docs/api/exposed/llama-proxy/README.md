# Llama Proxy API

OpenAI-compatible API endpoints exposed by the proxy server.

## Base URL
```
http://127.0.0.1:4000
```

## Endpoints

### POST /chat/completions
Forward to upstream `/v1/chat/completions`.

### POST /v1/chat/completions
Forward to upstream `/v1/chat/completions`.

### POST /completions
Forward to upstream `/v1/completions`.

### POST /v1/completions
Forward to upstream `/v1/completions`.

### GET /models
Return logical model list.

### GET /v1/models
Return logical model list.

## Model Names
- `Qwen3.5-35B-A3B-T-Think` - enables thinking mode
- `Qwen3.5-35B-A3B-T-No-Think` - disables thinking mode