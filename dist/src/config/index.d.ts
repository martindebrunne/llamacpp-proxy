/**
 * Application configuration
 */
import type { PortConfig, AppConfig } from "../types/index.js";
/**
 * Maximum number of port fallback attempts when the primary port is in use
 */
export declare const MAX_PORT_FALLBACK_ATTEMPTS = 10;
/**
 * Parse port configuration from command line or environment
 * Supports formats: "3000", "3000:4000", "PROXY_PORT:UPSTREAM_PORT"
 */
export declare function parsePortConfig(): PortConfig;
export declare const config: AppConfig;
//# sourceMappingURL=index.d.ts.map