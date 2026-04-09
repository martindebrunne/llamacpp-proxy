/**
 * Integration tests for logging middleware
 * Tests the full request flow with production middleware order
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock fs/promises before any imports
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
}));

// Mock console methods used by the logger
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});

// Mock the proxy service to prevent actual upstream calls
vi.mock('../../src/services/proxy.js', () => ({
  forwardJsonPost: vi.fn().mockImplementation(async (req, res) => {
    res.status(200).json({
      id: 'test-123',
      choices: [{ finish_reason: 'stop', index: 0, message: { role: 'assistant', content: 'test response' } }],
      usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 },
    });
  }),
}));

// Mock the streaming service
vi.mock('../../src/services/streaming.js', () => ({
  forwardStreamingResponse: vi.fn().mockImplementation(async (req, res, upstream) => {
    res.status(200).json({
      id: 'test-123',
      choices: [{ finish_reason: 'stop', index: 0, message: { role: 'assistant', content: 'test response' } }],
      usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 },
    });
  }),
}));

// Mock the config - match actual exports
vi.mock('../../src/config/index.ts', () => ({
  config: {
    LLAMA_ORIGIN: 'http://localhost:8080',
    PROXY_PORT: 3000,
    PROXY_HOST: 'localhost',
    UPSTREAM_PORT: 8080,
  },
  MAX_PORT_FALLBACK_ATTEMPTS: 5,
  parsePortConfig: vi.fn(),
}));

describe('Logging Integration Tests', () => {
  let app: express.Express;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    app = express();
    
    // Get the console log spy
    consoleLogSpy = vi.spyOn(console, 'log');
    
    // Production middleware order (matching src/index.ts):
    // 1. JSON parser for intercepted routes
    app.use(
      ['/chat/completions', '/v1/chat/completions', '/completions', '/v1/completions'],
      express.json({ limit: '5mb' })
    );
    
    // 2. Logging middleware (BEFORE routes to ensure logging)
    const { loggingMiddleware } = await import('../../src/middleware/logging.js');
    app.use(loggingMiddleware);
    
    // 3. Routes
    const completionsRouter = (await import('../../src/routes/completions.js')).default;
    app.use('/', completionsRouter);
    
    // 4. Proxy everything else
    app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should log request start for intercepted /chat/completions routes', async () => {
    const response = await request(app)
      .post('/chat/completions')
      .send({ model: 'llama-3.1-8b', messages: [{ role: 'user', content: 'hello' }] });

    expect(response.status).toBe(200);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should log request start for intercepted /v1/chat/completions routes', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .send({ model: 'llama-3.1-8b', messages: [{ role: 'user', content: 'hello' }] });

    expect(response.status).toBe(200);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should log request start for intercepted /completions routes', async () => {
    const response = await request(app)
      .post('/completions')
      .send({ model: 'llama-3.1-8b', prompt: 'hello' });

    expect(response.status).toBe(200);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should log request start for intercepted /v1/completions routes', async () => {
    const response = await request(app)
      .post('/v1/completions')
      .send({ model: 'llama-3.1-8b', prompt: 'hello' });

    expect(response.status).toBe(200);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should extract model from request body for intercepted routes', async () => {
    await request(app)
      .post('/chat/completions')
      .send({ model: 'llama-3.1-8b', messages: [{ role: 'user', content: 'hello' }] });

    expect(consoleLogSpy).toHaveBeenCalled();
    const callArgs = consoleLogSpy.mock.calls[0][0];
    expect(callArgs).toContain('llama-3.1-8b');
  });

  it('should extract thinking mode from request body for intercepted routes', async () => {
    await request(app)
      .post('/chat/completions')
      .send({ thinking: true, messages: [{ role: 'user', content: 'hello' }] });

    expect(consoleLogSpy).toHaveBeenCalled();
    const callArgs = consoleLogSpy.mock.calls[0][0];
    expect(callArgs).toContain('thinking=true');
  });

  it('should extract thinking mode from chat_template_kwargs for intercepted routes', async () => {
    await request(app)
      .post('/chat/completions')
      .send({
        chat_template_kwargs: {
          enable_thinking: 'enabled',
        },
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(consoleLogSpy).toHaveBeenCalled();
    const callArgs = consoleLogSpy.mock.calls[0][0];
    expect(callArgs).toContain('enabled');
  });
});