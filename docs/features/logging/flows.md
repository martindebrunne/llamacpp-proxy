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
    
    Middleware->>Console: consoleRequestLogStart()
    Note over Console: [HH:MM:SS] REQ_IN GET   /v1/models | model=- | thinking=- | correlation=abc123
    
    Middleware->>File: logRequestStart()
    Note over File: {"type":"REQUEST_START","correlationId":"abc123","method":"GET","path":"/v1/models",...}
    
    Middleware->>Middleware: duration = Date.now() - startTime
    Middleware->>Console: consoleRequestLogEnd()
    Note over Console: [HH:MM:SS] REQ_OUT GET   /v1/models | status=200 | duration=5ms | size=1.2KB | upstream=- | thinking=- | stream=- | correlation=abc123
    
    Note over File: REQUEST_END is written by proxy/streaming services for intercepted routes
    
    Proxy->>Client: response
```

## Logging Function Comparison

### Console Request Start Log

```
Input:
{
  method: "GET",
  path: "/v1/models",
  incomingModel: undefined,
  thinkingMode: undefined,
  correlationId: "abc123"
}

Output (TTY):
[HH:MM:SS] REQ_IN  GET   /v1/models | model=- | thinking=- | correlation=abc123
```

### Console Request End Log

```
Input:
{
  method: "GET",
  path: "/v1/models",
  status: 200,
  duration: 5,
  size: 1234,
  upstreamModel: undefined,
  thinkingMode: undefined,
  stream: undefined,
  correlationId: "abc123"
}

Output (TTY):
[HH:MM:SS] REQ_OUT GET   /v1/models | status=200 | duration=5ms | size=1.2KB | upstream=- | thinking=- | stream=- | correlation=abc123
```

### File Request Start Log

```
Input:
{
  "timestamp": "2026-10-04 04:54:01.123",
  "type": "REQUEST_START",
  "correlationId": "abc123",
  method: "GET",
  path: "/v1/models",
  incomingModel: undefined,
  upstreamModel: undefined,
  thinkingMode: undefined,
  stream: false,
  requestPayload: {}
}

Output (File):
{"timestamp":"2026-10-04 04:54:01.123","type":"REQUEST_START","correlationId":"abc123","method":"GET","path":"/v1/models","stream":false,"incomingModel":null,"upstreamModel":null,"thinkingMode":null,"requestPayload":{}}
```

## Log Rotation Flow

```mermaid
flowchart TD
    A[Log Entry Created] --> B{Check Time Rotation}
    B -->|24h elapsed| C[Rotate File]
    B -->|Within 24h| D{Check Size Rotation}
    C --> E[Create New Log File]
    D -->|>5MB| C
    D -->|<=5MB| F[Append to Current File]
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
```