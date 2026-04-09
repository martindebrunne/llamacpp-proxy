# Llama Proxy API

## Overview
OpenAI-compatible proxy server for llama.cpp with **dynamic model detection** and model name abstraction for controlling thinking mode.

## Endpoints

### POST /chat/completions, /v1/chat/completions
Create chat completion.

### GET /models, /v1/models
List available models with Think/No-Think variants.

## Model Naming

### Dynamic Model Detection
The proxy rewrites model names only for `*-Think` requests. Other modes are passed through unchanged:

| Incoming Model | Upstream Model | Behavior |
|----------------|----------------|----------|
| `MyModel-Think` | `MyModel` | Enables thinking mode |
| `MyModel-No-Think` | `MyModel-No-Think` | Passthrough (no transformation) |
| `MyModel` | `MyModel` | Passthrough (no transformation) |

### Think Mode
Use `*-Think` suffix to enable thinking mode:
- `Qwen3.5-35B-A3B-T-Think` → upstream: `Qwen3.5-35B-A3B-T`

### No-Think Mode
Use `*-No-Think` suffix for passthrough:
- `Qwen3.5-35B-A3B-T-No-Think` → upstream: `Qwen3.5-35B-A3B-T-No-Think` (unchanged)

### Other Models
Models without `*-Think` or `*-No-Think` suffix are passed through without modification.

---

## ⚠️ Important: llama.cpp Compatibility

**Pour que le mode thinking fonctionne, le modèle servi par llama.cpp DOIT être compatible avec l'option `enable_thinking` dans `chat_template_kwargs`.**

Si le modèle upstream ne supporte pas cette option, la requête échouera avec une erreur 400.

### Compatible Models
- Tout modèle llama.cpp configuré avec `--chat-template` supportant `enable_thinking`

### Incompatible Models
- Modèles llama.cpp standard sans support thinking
- Modèles configurés avec des chat templates incompatibles

---

## Usage

```bash
# Start proxy
npm start

# Or with custom ports
npm start -- 4000:8080
```

### Example Request (Think Mode)
```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MyModel-Think",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Example Request (No-Think Mode)
```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MyModel-No-Think",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Example: List Models
```bash
curl -s http://localhost:4000/v1/models | jq .
```

## Logging

Requests are logged to:
- Console (compressed format)
- File (full payloads, no truncation)

Log files are located in `logs/` directory.