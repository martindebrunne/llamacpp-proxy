# Tech Context: Llama Proxy

## Technologies Used

| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js | Runtime | Latest |
| Express.js | Web framework | ^4.18.2 |
| http-proxy-middleware | Proxy routing | ^2.0.6 |

## Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6"
  }
}
```

## Development Setup

### Prerequisites
- Node.js installed
- llama-server running on `http://127.0.0.1:8080`

### Starting the Proxy
```bash
# Base version
node proxy.js

# Enhanced version with conditional sanitization
node proxy2.js
```

### Command Line Configuration
```bash
# Format: node proxy.js "PROXY_PORT:UPSTREAM_PORT"
node proxy2.js "4000:8080"
```

### Client Configuration
```javascript
{
  baseURL: "http://127.0.0.1:4000",
  apiKey: "any-value", // not validated
  model: "Qwen3.5-35B-A3B-T-Think" // or *-No-Think
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PROXY_HOST | 127.0.0.1 | Proxy bind address |
| PROXY_PORT | 4000 | Proxy server port |
| UPSTREAM_HOST | 127.0.0.1 | llama-server host |
| UPSTREAM_PORT | 8080 | llama-server port |

## Technical Constraints
- Local network only (127.0.0.1)
- No authentication
- 5MB JSON body limit on intercepted routes
- 300s timeout for proxy connections

## Version Comparison

| Feature | proxy.js | proxy2.js |
|---------|----------|-----------|
| Model mapping | ✅ | ✅ |
| Request logging | ✅ | ✅ |
| Response sanitization | ❌ | ✅ (Think mode only) |
| Reasoning filtering | ❌ | ✅ (Think mode only) |
| No-Think passthrough | ❌ | ✅ |
| Content recovery | ❌ | ✅ (Think mode only) |

## Usage Recommendations

| Use Case | Recommended Version | Model |
|----------|--------------------|-------|
| Complex tasks, best answers | proxy2.js | *-Think |
| Simple tasks, no transformation | proxy2.js | *-No-Think |
| Minimal overhead | proxy.js | Any |