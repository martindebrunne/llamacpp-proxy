# Logging Flows

## Server Startup Flow

```mermaid
sequenceDiagram
    participant App as src/index.ts
    participant Logger as lib/logger.ts
    participant Console as TTY
    participant File as logs/

    App->>Logger: consoleInfo("Proxy started", ...)
    Logger->>Console: [HH:MM:SS] Proxy started listening on http://127.0.0.1:4001
    Note over Console: TTY only, minified format
    
    App->>Logger: consoleInfo("Passthrough target", ...)
    Logger->>Console: [HH:MM:SS] Passthrough target http://127.0.0.1:8080
    Note over Console: TTY only, minified format
    
    App->>Logger: consoleInfo("Dynamic model detection enabled", ...)
    Logger->>Console: [HH:MM:SS] Dynamic model detection enabled - real model extracted from incoming requests
    Note over Console: TTY only, minified format
```

## Request/Response Logging Flow (Passthrough)

```mermaid
sequenceDiagram
    participant Client as Client
    participant Proxy as Proxy Server
    participant Middleware as src/middleware/logging.ts
    participant Console as TTY
    participant File as logs/
    participant Upstream as llama-server

    Client->>Proxy: GET /v1/models
    Proxy->>Middleware: loggingMiddleware
    Middleware->>Middleware: startTime = Date.now()
    Middleware->>Upstream: forward request
    Upstream->>Proxy: response
    Proxy->>Middleware: res.end()
    
    Middleware->>Middleware: duration = Date.now() - startTime
    Middleware->>Console: consoleRequestLog()
    Note over Console: [HH:MM:SS] REQ GET /v1/models | model=- -> - | thinking=- | status=200 | duration=5ms
    
    Middleware->>Console: consoleResponseLog()
    Note over Console: [HH:MM:SS] RESP GET /v1/models | model=- | status=200 | size=1.2KB | duration=5ms
    
    Middleware->>File: requestLog()
    Note over File: [2026-09-04 HH:MM:SS.mmm] REQUEST GET /v1/models | method=GET | path=/v1/models | ... | response={...}
    
    Proxy->>Client: response
```

## Logging Function Comparison

### Console Request Log

```
Input:
{
  method: "GET",
  path: "/v1/models",
  incomingModel: undefined,
  upstreamModel: "-",
  thinking: undefined,
  status: 200,
  duration: 5
}

Output (TTY):
[HH:MM:SS] REQ     GET    /v1/models | model=- -> - | thinking=- | status=200 | duration=5ms
```

### Console Response Log

```
Input:
{
  method: "GET",
  path: "/v1/models",
  model: undefined,
  status: 200,
  size: 1234,
  duration: 5
}

Output (TTY):
[HH:MM:SS] RESP    GET    /v1/models | model=- | status=200 | size=1.2KB | duration=5ms
```

### File Request Log

```
Input:
{
  method: "GET",
  path: "/v1/models",
  incomingModel: undefined,
  upstreamModel: "-",
  thinking: undefined,
  status: 200,
  duration: 5,
  requestPayload: {},
  responsePayload: {"object":"list","data":[...]}
}

Output (File):
[2026-09-04 HH:MM:SS.mmm] REQUEST GET /v1/models | method=GET | path=/v1/models | incoming=- | upstream=- | status=200 | duration=5ms | request={} | response={"object":"list","data":[...]}
```

## Log Rotation Flow

```mermaid
flowchart TD
    A[Log Entry Created] --> B{Check Time Rotation}
    B -->|24h elapsed| C[Rotate File]
    B -->|Within 24h| D{Check Size Rotation}
    C --> E[Create New Log File]
    D -->|>10MB| C
    D -->|<10MB| F[Append to Current File]
    E --> F
    F --> G[Write Entry]
```

## Error Handling Flow

```mermaid
sequenceDiagram
    participant App as src/index.ts
    participant Logger as lib/logger.ts
    participant File as logs/

    App->>Logger: info("Fatal error", message)
    Logger->>Logger: queueLog({level: "ERROR", message, details})
    Logger->>Logger: flushQueue()
    Logger->>File: appendFile(logFile, formattedEntry)
    Note over File: Error logged to file only (not TTY)