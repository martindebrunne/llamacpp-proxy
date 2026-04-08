# Progress: Llama Proxy

## What Works

### Core Functionality
- ✅ Express.js proxy server on port 4000
- ✅ Model name transformation (Think/No-Think)
- ✅ OpenAI-compatible API endpoints
- ✅ Streaming response passthrough
- ✅ Authorization header passthrough
- ✅ WebSocket passthrough via http-proxy-middleware
- ✅ Async logging with queue-based batching
- ✅ Log rotation (time and size-based)
- ✅ Console logging with compressed format
- ✅ File logging with complete payloads
- ✅ Usage metadata preservation in SSE responses
- ✅ Usage metadata preservation in JSON responses
- ✅ Real-time streaming with direct res.write() calls
- ✅ Separate usage chunk for cleaner client parsing
- ✅ Comprehensive error handling with try/catch/finally
- ✅ Passthrough for non-Think/No-Think models
- ✅ Dynamic model listing from upstream with Think/No-Think variants

### proxy2.js Features
- ✅ Conditional response sanitization (Think mode only)
- ✅ Reasoning field filtering
- ✅ XML block extraction from reasoning
- ✅ SSE parsing and reconstruction
- ✅ JSON sanitization for choices/messages
- ✅ Content recovery from reasoning
- ✅ No-Think mode passthrough (no transformation)
- ✅ Usage metadata preservation (prompt_tokens, completion_tokens, total_tokens)
- ✅ Real-time chunk processing
- ✅ Helper functions: isNonEmptyObject, hasUsableContent
- ✅ Recovery functions: recoverMessageFromReasoning, recoverDeltaFromReasoning
- ✅ SSE utilities: parseSseEventBlock, serializeSseEvent, createSseChunkFromTemplate, splitSseBlocks

## What's Left to Build

### Potential Enhancements
- [ ] Configuration file for sanitization toggle
- [ ] Health check endpoint
- [ ] Metrics/monitoring
- [ ] Rate limiting
- [ ] Authentication (if needed)

## Current Status

**Version 1.0.10** - Dynamic model listing with Think/No-Think variants

- proxy.js: Base implementation (stable)
- proxy2.js: Enhanced with Think/No-Think differentiation, usage preservation, real-time streaming, and dynamic model listing (stable)

## Known Issues

None currently.

## Evolution of Decisions

| Date | Decision | Reason |
|------|----------|--------|
| Initial | Single-file architecture | Simplicity |
| 2026-07-04 | Async logging | Prevent blocking |
| 2026-07-04 | No truncation | Complete debugging data |
| 2026-08-08 | proxy2.js with sanitization | Better answers with Think mode |
| 2026-08-08 | No-Think passthrough | User preference for no transformation |
| 2026-08-08 | Usage metadata preservation | Required for token billing/monitoring |
| 2026-08-08 | Real-time streaming | More efficient than buffering |
| 2026-08-08 | Separate usage chunk | Easier for clients to parse |
| 2026-08-08 | Passthrough for unknown models | Flexibility for other models |
| 2026-08-08 | Dynamic model listing | Reflect upstream models accurately |
| 2026-08-08 | llama.cpp compatibility warning | Prevent user confusion |