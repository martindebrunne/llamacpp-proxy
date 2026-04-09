# Llama Server API

## Overview

This document describes the upstream llama.cpp server API that the proxy forwards requests to.

## Base URL

```
http://127.0.0.1:8080
```

## Endpoints

### POST /v1/chat/completions

Create chat completion with streaming support.

**Request Body:**
```json
{
  "model": "Qwen3.5-35B-A3B-T",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": true,
  "chat_template_kwargs": {
    "enable_thinking": true
  }
}
```

**Response:**
- `text/event-stream` - SSE stream with completion chunks
- `application/json` - Non-streaming response

### GET /v1/models

List available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "Qwen3.5-35B-A3B-T",
      "object": "model",
      "owned_by": "local"
    }
  ]
}
```

## Chat Template Kwargs

The proxy passes `chat_template_kwargs` to the upstream server:

| Parameter | Type | Description |
|-----------|------|-------------|
| `enable_thinking` | boolean | Enable thinking mode for reasoning |

## Streaming Format

The upstream server returns SSE-formatted chunks:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"Qwen3.5-35B-A3B-T","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"Qwen3.5-35B-A3B-T","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}

data: [DONE]
```

## Compatibility

The proxy requires the upstream llama.cpp server to:

1. Support OpenAI-compatible API endpoints
2. Accept `chat_template_kwargs` with `enable_thinking` parameter
3. Return SSE-formatted streaming responses
4. Include `reasoning_content` or `reasoning` fields in responses when thinking mode is enabled