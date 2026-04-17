/**
 * Models route
 * Exposes model list with Think/No-Think variants
 */
import { Router } from "express";
import { config } from "../config/index.js";
const router = Router();
// Expose model list with Think/No-Think variants
// Models are dynamically fetched from upstream
router.get(["/models", "/v1/models"], async (_req, res) => {
    try {
        // Fetch upstream models
        const upstreamResponse = await fetch(`${config.LLAMA_ORIGIN}/v1/models`);
        let upstreamModels = [];
        if (upstreamResponse.ok) {
            const upstreamData = await upstreamResponse.json();
            upstreamModels = (upstreamData.data || []);
        }
        // Build model list with Think/No-Think variants
        const modelData = upstreamModels.map((model) => {
            const modelId = model.id;
            return [
                { id: `${modelId}-Think`, object: "model", owned_by: "local" },
                { id: `${modelId}-No-Think`, object: "model", owned_by: "local" },
            ];
        }).flat();
        // Add upstream models without variants
        modelData.push(...upstreamModels.map((m) => ({ id: m.id, object: "model", owned_by: m.owned_by || "local" })));
        res.json({
            object: "list",
            data: modelData,
        });
    }
    catch (e) {
        // Fallback: return empty list if upstream is unavailable
        // Models will be discovered dynamically from client requests
        res.json({
            object: "list",
            data: [],
        });
    }
});
export default router;
//# sourceMappingURL=models.js.map