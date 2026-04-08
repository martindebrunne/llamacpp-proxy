# Project Brief: Llama Proxy

## Overview
A lightweight Node.js proxy server that bridges OpenAI-compatible clients (like Cline) with local llama.cpp servers, providing model abstraction and thinking mode control.

## Core Requirements
- Proxy OpenAI-compatible API requests to local llama-server
- Abstract model names to enable/disable thinking mode
- Support streaming responses (SSE)
- Passthrough all other routes unchanged

## Goals
- Enable clients to use `*-Think` and `*-No-Think` model variants
- Provide seamless integration with llama.cpp without client modifications
- Maintain OpenAI API compatibility

## Scope
- Single-file Express application
- No authentication (local/trusted network)
- Model name transformation via `chat_template_kwargs`
- Streaming response forwarding

## Success Criteria
- Clients can connect to `http://127.0.0.1:4000`
- Model names are correctly transformed
- Streaming responses work correctly
- All non-intercepted routes passthrough to upstream