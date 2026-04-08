# Llama Proxy API

## Overview
OpenAI-compatible proxy server for llama.cpp with model name abstraction for controlling thinking mode.

## Endpoints

### POST /chat/completions, /v1/chat/completions
Create chat completion.

### GET /models, /v1/models
List available models with Think/No-Think variants.

## Model Naming

### Think Mode
Use `*-Think` suffix to enable thinking mode:
- `Qwen3.5-35B-A3B-T-Think`

### No-Think Mode
Use `*-No-Think` suffix for passthrough:
- `Qwen3.5-35B-A3B-T-No-Think`

### Other Models
Models without `*-Think` or `*-No-Think` suffix are passed through without modification.

---

## ⚠️ Important: llama.cpp Compatibility

**Pour que le mode thinking fonctionne, le modèle servi par llama.cpp DOIT être compatible avec l'option `enable_thinking` dans `chat_template_kwargs`.**

Si le modèle upstream ne supporte pas cette option, la requête échouera avec une erreur 400.

### Compatible Models
- Qwen3.5-35B-A3B-T (et variantes avec support thinking)
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
node proxy2.js 4000:8080
```

### Example Request (Think Mode)
```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen3.5-35B-A3B-T-Think",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Example Request (No-Think Mode)
```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen3.5-35B-A3B-T-No-Think",
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