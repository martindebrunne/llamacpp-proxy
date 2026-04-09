/**
 * Application configuration
 */
/**
 * Maximum number of port fallback attempts when the primary port is in use
 */
export const MAX_PORT_FALLBACK_ATTEMPTS = 10;
/**
 * Parse port configuration from command line or environment
 * Supports formats: "3000", "3000:4000", "PROXY_PORT:UPSTREAM_PORT"
 */
export function parsePortConfig() {
    const arg = process.argv[2];
    if (arg && arg.includes(":")) {
        const parts = arg.split(":");
        const proxyPort = Number(parts[0]);
        const upstreamPort = Number(parts[1]);
        if (!isNaN(proxyPort) && !isNaN(upstreamPort)) {
            return {
                PROXY_PORT: proxyPort,
                UPSTREAM_PORT: upstreamPort,
            };
        }
    }
    const proxyPort = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : 4000;
    const upstreamPort = process.env.UPSTREAM_PORT ? Number(process.env.UPSTREAM_PORT) : 8080;
    return {
        PROXY_PORT: isNaN(proxyPort) ? 4000 : proxyPort,
        UPSTREAM_PORT: isNaN(upstreamPort) ? 8080 : upstreamPort,
    };
}
const { PROXY_PORT, UPSTREAM_PORT } = parsePortConfig();
const PROXY_HOST = process.env.PROXY_HOST || "127.0.0.1";
const LLAMA_ORIGIN = `http://${process.env.UPSTREAM_HOST || "127.0.0.1"}:${UPSTREAM_PORT}`;
export const config = {
    PROXY_PORT,
    UPSTREAM_PORT,
    PROXY_HOST,
    LLAMA_ORIGIN,
};
//# sourceMappingURL=index.js.map