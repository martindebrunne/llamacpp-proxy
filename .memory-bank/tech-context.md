# Tech Context: Llama Proxy

## Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | >=18 | Runtime |
| Express | ^4.18.2 | Web server |
| http-proxy-middleware | ^2.0.6 | WebSocket passthrough |

## Entry Point
```bash
npm start
# or
node proxy2.js 4000:8080
```

## Configuration

| Source | Priority | Format |
|--------|----------|--------|
| CLI arguments | 1 | `proxyPort:upstreamPort` |
| Environment variables | 2 | `PROXY_PORT`, `UPSTREAM_PORT` |
| Defaults | 3 | `4000:8080` |

## Development Setup

```bash
# Install dependencies
npm install

# Run proxy
npm start

# Run with custom ports
node proxy2.js 4000:8080
```

## Version Comparison

| Feature | proxy.js | proxy2.js |
|---------|----------|-----------|
| Model transformation | ✅ | ✅ |
| Streaming | ✅ | ✅ |
| Reasoning filtering | ❌ | ✅ |
| Content recovery | ❌ | ✅ |
| No-Think passthrough | ❌ | ✅ |
| Usage metadata preservation | ❌ | ✅ |

## Usage Recommendations

| Use Case | Model | Version |
|----------|-------|---------|
| Complex tasks, best answers | `*-Think` | proxy2.js |
| Simple tasks, no transformation | `*-No-Think` | proxy2.js |
| Minimal overhead | Any | proxy.js |

## Logging

- **Console**: Compressed format with thinking mode indicator
- **File**: Full request/response payloads (no truncation)
- **Async**: Queue-based batching to prevent blocking
- **Rotation**: Time and size-based

## API Endpoints

| Route | Method | Interception |
|-------|--------|--------------|
| `/chat/completions` | POST | ✅ |
| `/v1/chat/completions` | POST | ✅ |
| `/completions` | POST | ✅ |
| `/v1/completions` | POST | ✅ |
| `/v1/models` | GET | ❌ (passthrough) |
| `/ws` | WS | ❌ (passthrough) |