# Logging Feature

## Overview

The llamacpp-proxy implements a dual logging system with separate outputs for console (TTY) and file storage.

## Logging System Architecture

### Console Output (TTY) - Minified Format

Real-time logging to terminal with compact format for easy monitoring:

- **Startup messages**: `consoleInfo()` - Server status, port, target
- **Request logs**: `consoleRequestLog()` - Method, path, model, thinking, status, duration
- **Response logs**: `consoleResponseLog()` - Method, path, model, status, size, duration

**Format**: `[HH:MM:SS]` timestamp, no symbols (uses `true`/`false` for thinking)

**Example**:
```
[04:54:01] Proxy started listening on http://127.0.0.1:4001
[04:54:01] Passthrough target http://127.0.0.1:8080
[04:54:01] Dynamic model detection enabled - real model extracted from incoming requests
[04:54:01] REQ     GET    /v1/models | model=- -> - | thinking=- | status=200 | duration=5ms
[04:54:01] RESP    GET    /v1/models | model=- | status=200 | size=1.2KB | duration=5ms
```

### File Output (logs/proxy-YYYY-MM-DD.log) - Full Format

Complete logging with all details for debugging and analysis:

- Full request/response payloads (no truncation)
- Async queue-based batching to prevent blocking
- Rotation: Time-based (24h) and size-based (10MB max)

**Example**:
```
[2026-09-04 04:54:01.123] REQUEST GET /v1/models | method=GET | path=/v1/models | incoming=- | upstream=- | status=200 | duration=5ms | request= | response={"object":"list","data":[...]}
```

## Logging Functions

| Function | Console | File | Purpose |
|----------|---------|------|---------|
| `consoleInfo(message, details)` | ✓ | ✗ | TTY startup messages |
| `info(message, details)` | ✗ | ✓ | File-only info logs |
| `consoleRequestLog(entry)` | ✓ | ✗ | TTY request logs |
| `requestLog(entry)` | ✗ | ✓ | File request logs with payloads |
| `consoleResponseLog(entry)` | ✓ | ✗ | TTY response logs |
| `error(message, details)` | ✗ | ✓ | File error logs |

## Implementation

### Console Request Log Entry

```typescript
interface RequestLogConsoleEntry {
  method: string;
  path: string;
  incomingModel: string | undefined;
  upstreamModel: string | undefined;
  thinking: boolean | undefined;
  status: number;
  duration: number;
}
```

### Console Response Log Entry

```typescript
interface ResponseLogConsoleEntry {
  method: string;
  path: string;
  model: string | undefined;
  status: number;
  size: number;
  duration: number;
}
```

### File Request Log Entry

```typescript
interface RequestLogEntry {
  method: string;
  path: string;
  incomingModel: string | undefined;
  upstreamModel: string | undefined;
  thinking: boolean | undefined;
  status: number;
  duration: number;
  requestPayload: unknown;
  responsePayload: unknown;
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

### Request Logging

```typescript
import { consoleRequestLog } from "../../lib/index.js";

consoleRequestLog({
  method: req.method,
  path: req.originalUrl || req.url,
  incomingModel: req.body?.model,
  upstreamModel: "-",
  thinking: undefined,
  status: res.statusCode,
  duration,
});
```

### Response Logging

```typescript
import { consoleResponseLog } from "../../lib/index.js";

consoleResponseLog({
  method: req.method,
  path: req.originalUrl || req.url,
  model: req.body?.model,
  status: res.statusCode,
  size: responseBodySize,
  duration,
});
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate console/file output | Console for real-time monitoring, file for detailed debugging |
| Minified console format | Easy to read in TTY, less visual clutter |
| Full file format | Complete data for post-mortem analysis |
| `true`/`false` in console | No symbols, machine-readable |
| `✓`/`✗` in file | Visual indicators for quick scanning |
| Human-readable sizes | B, KB, MB in console for quick understanding |
| Async queue-based logging | Prevents blocking request handling |
| Log rotation | Prevents disk space issues |

## Files

- `lib/logger.ts` - Core logging implementation
- `src/middleware/logging.ts` - Request/response logging middleware
- `logs/proxy-YYYY-MM-DD.log` - Daily log files