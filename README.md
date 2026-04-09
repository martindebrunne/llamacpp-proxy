# llamacpp-proxy

OpenAI-compatible proxy server for [llama.cpp](https://github.com/ggerganov/llama.cpp) with **dynamic model detection** and **thinking mode support**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔄 **Dynamic Model Detection** - Rewrites `*-Think` model names to upstream model IDs
- 🧠 **Thinking Mode Support** - Enable/disable thinking mode via `*-Think` and `*-No-Think` suffixes
- 📡 **OpenAI-Compatible API** - Works with any OpenAI-compatible client
- 🚀 **Streaming Support** - Real-time SSE streaming with response sanitization
- 📝 **Request Logging** - Comprehensive logging with payload capture
- 🛡️ **Graceful Shutdown** - Proper cleanup on SIGTERM/SIGINT

## Quick Start

```bash
# Install dependencies
npm install

# Start proxy (default: port 4000 → upstream 8080)
npm start

# Or with custom ports (PROXY_PORT:UPSTREAM_PORT)
npm start -- 4000:8080
```

## Usage

### Basic Request (Think Mode)

```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MyModel-Think",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### No-Think Mode (Passthrough)

```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MyModel-No-Think",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### List Available Models

```bash
curl -s http://localhost:4000/v1/models | jq .
```

## How It Works

### Model Naming Convention

| Client Model | Upstream Model | Behavior |
|--------------|----------------|----------|
| `MyModel-Think` | `MyModel` | Enables `enable_thinking: true` |
| `MyModel-No-Think` | `MyModel-No-Think` | Passthrough (no transformation) |
| `MyModel` | `MyModel` | Passthrough (no transformation) |

### Request Flow

```
Client Request (MyModel-Think)
         ↓
    Proxy Intercepts
         ↓
Extract Real Model: "MyModel"
         ↓
Transform Request:
  - model: "MyModel"
  - chat_template_kwargs.enable_thinking: true
         ↓
Forward to llama.cpp
         ↓
Stream Response (with sanitization)
         ↓
Return to Client
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PROXY_PORT` | `4000` | Proxy server port |
| `UPSTREAM_PORT` | `8080` | llama.cpp server port |
| `UPSTREAM_HOST` | `127.0.0.1` | llama.cpp server host |
| `PROXY_HOST` | `127.0.0.1` | Proxy bind address |

### Command Line Arguments

```bash
# Format: npm start -- PROXY_PORT:UPSTREAM_PORT
npm start -- 3000:8080
```

## Requirements

- **llama.cpp** server running with `--chat-template` supporting `enable_thinking`
- Compatible models: Qwen3.5-35B-A3B-T and variants with thinking support

## Logging

Requests are logged to:

- **Console** - Compressed format with timing and model info
- **File** - Full payloads in `logs/proxy-YYYY-MM-DD.log`

Log rotation:
- Time-based: 24 hours
- Size-based: 5MB max per file

## API Reference

See [docs/api/exposed/llama-proxy/README.md](docs/api/exposed/llama-proxy/README.md) for complete API documentation.

## License

MIT License - see [LICENSE](LICENSE) file for details.