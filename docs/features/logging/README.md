# Logging Feature

## Overview

The llamacpp-proxy implements an enhanced dual logging system with separate outputs for console (TTY) and file storage. The new system uses a two-phase approach (request start + request end) with correlation IDs for tracking requests across logs.

## Logging System Architecture

### Console Output (TTY) - Minified Format

Real-time logging to terminal with compact format for easy monitoring:

- **Request Start**: `consoleRequestLogStart()` - Logs when request arrives
- **Request End**: `consoleRequestLogEnd()` - Logs when response completes

**Format**: `[HH:MM:SS]` timestamp, two lines per request

**Example**:
```
[04:54:01] REQ_IN  POST   /v1/chat/completions | model=llama-3.2 | thinking=auto | correlation=abc123
[04:54:02] REQ_OUT POST   /v1/chat/completions | status=200 | duration=1234ms | size=2KB | upstream=llama-3.1 | thinking=auto | stream=false | correlation=abc123
```

### File Output (`logs/proxy-*.log`) - JSON Format

Complete logging with all details for debugging and analysis:

- **Request Start Entry**: Full request payload, method, path, model, thinking mode
- **Request End Entry**: Status, duration, response size, upstream model, thinking mode, full response payload
- **Streaming Chunks**: Each chunk logged individually (Option C - Hybrid)

**Rotation**: Time-based (24h) and size-based (5MB max)

**Example - Non-Streaming**:
```json
{"timestamp":"2026-10-04 04:54:01.123","type":"REQUEST_START","correlationId":"abc123","method":"POST","path":"/v1/chat/completions","stream":false,"incomingModel":"llama-3.2","upstreamModel":null,"thinkingMode":"auto","requestPayload":{"model":"llama-3.2","messages":[{"role":"user","content":"Hello"}]}}
{"timestamp":"2026-10-04 04:54:02.357","type":"REQUEST_END","correlationId":"abc123","status":200,"duration":1234,"responseSize":2048,"stream":false,"upstreamModel":"llama-3.1","thinkingMode":"auto","responsePayload":{"choices":[{"message":{"content":"Hello there!"}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}}
```

**Example - Streaming**:
```json
{"timestamp":"2026-10-04 04:54:01.123","type":"REQUEST_START","correlationId":"def456","method":"POST","path":"/v1/chat/completions","stream":true,"incomingModel":"llama-3.2","upstreamModel":null,"thinkingMode":"auto","requestPayload":{"model":"llama-3.2","messages":[{"role":"user","content":"Write a story"}],"stream":true}}
{"timestamp":"2026-10-04 04:54:01.200","type":"STREAM_CHUNK","correlationId":"def456","chunkIndex":0,"data":{"choices":[{"delta":{"content":"Once"}}]}}
{"timestamp":"2026-10-04 04:54:01.250","type":"STREAM_CHUNK","correlationId":"def456","chunkIndex":0,"data":{"choices":[{"delta":{"content":" upon"}}]}}
{"timestamp":"2026-10-04 04:54:06.800","type":"REQUEST_END","correlationId":"def456","status":200,"duration":5678,"responseSize":16384,"stream":true,"upstreamModel":"llama-3.1","thinkingMode":"auto","responsePayload":{"choices":[{"message":{"content":"Once upon a time...!"}}],"usage":{"prompt_tokens":100,"completion_tokens":500}}}
```

## Logging Functions

| Function | Console | File | Purpose |
|----------|---------|------|---------|
| `consoleInfo(message, details)` | ✓ | ✗ | TTY startup messages |
| `info(message, details)` | ✗ | ✓ | File-only info logs |
| `consoleRequestLogStart(entry)` | ✓ | ✗ | TTY request start logs |
| `consoleRequestLogEnd(entry)` | ✓ | ✗ | TTY request end logs |
| `logRequestStart(entry)` | ✗ | ✓ | File request start logs with payload |
| `logRequestEnd(entry)` | ✗ | ✓ | File request end logs with payload |
| `logStreamChunk(entry)` | ✗ | ✓ | File streaming chunk logs |
| `error(message, details)` | ✗ | ✓ | File error logs |

## Implementation

### Console Request Log Start Entry

```typescript
interface RequestLogConsoleStartEntry {
  method: string;
  path: string;
  incomingModel: string | undefined;
  thinkingMode: string | undefined;
  correlationId: string;
}
```

### Console Request Log End Entry

```typescript
interface RequestLogConsoleEndEntry {
  method: string;
  path: string;
  status: number;
  duration: number;
  size: number;
  upstreamModel: string | undefined;
  thinkingMode: string | undefined;
  stream: boolean | undefined;
  correlationId: string;
}
```

### File Request Start Entry

```typescript
interface RequestLogStartEntry {
  timestamp: string;
  type: "REQUEST_START";
  correlationId: string;
  method: string;
  path: string;
  stream: boolean;
  incomingModel: string | undefined;
  upstreamModel: string | undefined;
  thinkingMode: string | undefined;
  requestPayload: unknown;
}
```

### File Request End Entry

```typescript
interface RequestLogEndEntry {
  timestamp: string;
  type: "REQUEST_END";
  correlationId: string;
  status: number;
  duration: number;
  responseSize: number;
  stream: boolean;
  upstreamModel: string | undefined;
  thinkingMode: string | undefined;
  responsePayload: unknown;
}
```

### File Stream Chunk Entry

```typescript
interface StreamChunkEntry {
  timestamp: string;
  type: "STREAM_CHUNK";
  correlationId: string;
  chunkIndex: number;
  data: unknown;
}
```

## Usage

### Startup Messages

```typescript
import { consoleInfo } from "../lib/logger.js";

consoleInfo("Proxy started", `listening on http://${config.PROXY_HOST}:${actualPort}`);
consoleInfo("Passthrough target", config.LLAMA_ORIGIN);
consoleInfo("Dynamic model detection enabled - real model extracted from incoming requests");
```

### Request Start Logging (Middleware)

```typescript
import { consoleRequestLogStart, logRequestStart, generateCorrelationId } from "../../lib/logger.js";

const correlationId = generateCorrelationId();

consoleRequestLogStart({
  method: req.method,
  path: req.originalUrl || req.url,
  incomingModel: req.body?.model,
  thinkingMode: extractThinkingMode(req.body),
  correlationId,
});

logRequestStart({
  timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
  type: "REQUEST_START",
  correlationId,
  method: req.method,
  path: req.originalUrl || req.url,
  stream: false,
  incomingModel: req.body?.model,
  upstreamModel: undefined,
  thinkingMode: extractThinkingMode(req.body),
  requestPayload: req.body,
});
```

### Request End Logging (Console)

```typescript
import { consoleRequestLogEnd } from "../../lib/logger.js";

consoleRequestLogEnd({
  method: req.method,
  path: req.originalUrl || req.url,
  status: res.statusCode,
  duration: Date.now() - startTime,
  size: responseBodySize,
  upstreamModel: upstreamModel,
  thinkingMode: thinkingMode,
  stream: true,
  correlationId: correlationId,
});
```

### Request End Logging (File)

```typescript
import { logRequestEnd } from "../../lib/logger.js";

await logRequestEnd({
  timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
  type: "REQUEST_END",
  correlationId,
  status: upstream.status,
  duration,
  responseSize: responseBodySize,
  stream: false,
  upstreamModel,
  thinkingMode,
  responsePayload: response?.json ?? response?.text ?? null,
});
```

### Stream Chunk Logging

```typescript
import { logStreamChunk } from "../../lib/logger.js";

await logStreamChunk({
  timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
  type: "STREAM_CHUNK",
  correlationId,
  chunkIndex: 0,
  data: chunk,
});
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two-phase logging (start + end) | Status and duration only available at end, but need to know request arrived immediately |
| Correlation IDs | Track requests across console and file logs |
| Minified console format | Easy to read in TTY, less visual clutter |
| Full JSON file format | Complete data for post-mortem analysis and debugging |
| Streaming chunks logged | Option C - Hybrid provides visibility into streaming progress |
| Human-readable sizes | B, KB, MB for quick understanding |
| Async queue-based logging | Prevents blocking request handling |
| Log rotation | Prevents disk space issues |

## Files

- `lib/logger.ts` - Core logging implementation
- `lib/index.ts` - Logger exports
- `src/middleware/logging.ts` - Request start/end middleware
- `src/services/proxy.ts` - JSON request logging
- `src/services/streaming.ts` - Streaming request logging
- `logs/proxy-*.log` - Rotated log files