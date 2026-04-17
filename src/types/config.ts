/**
 * Configuration types
 */

export interface PortConfig {
  PROXY_PORT: number;
  UPSTREAM_PORT: number;
}

export interface AppConfig {
  PROXY_PORT: number;
  UPSTREAM_PORT: number;
  PROXY_HOST: string;
  LLAMA_ORIGIN: string;
  PROXY_TIMEOUT_MS: number;
  UPSTREAM_FETCH_TIMEOUT_MS: number;
}

export interface LogPayload {
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

export interface ConsoleLogPayload {
  method: string;
  path: string;
  incomingModel: string | undefined;
  upstreamModel: string | undefined;
  thinking: boolean | undefined;
  status: number;
  duration: number;
}