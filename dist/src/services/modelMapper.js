/**
 * Model mapping service
 * Handles transformation of model names for thinking mode
 */
/**
 * Extract the real model name from incoming model name
 * Removes -Think or -No-Think suffix to get the actual model
 */
export function extractRealModel(incomingModel) {
    if (!incomingModel)
        return null;
    // Remove -Think suffix
    if (incomingModel.endsWith("-Think")) {
        return incomingModel.slice(0, -6);
    }
    // Remove -No-Think suffix
    if (incomingModel.endsWith("-No-Think")) {
        return incomingModel.slice(0, -11);
    }
    // No suffix, return as-is
    return incomingModel;
}
/**
 * Check if model name has a suffix
 */
export function hasModelSuffix(model) {
    if (!model)
        return false;
    return model.includes("-Think") || model.includes("-No-Think");
}
/**
 * Check if model is in No-Think mode
 */
export function isNoThinkMode(model) {
    return model?.includes("No-Think") ?? false;
}
/**
 * Check if model is in Think mode
 */
export function isThinkMode(model) {
    if (!model)
        return false;
    return model.includes("Think") && !model.includes("No-Think");
}
/**
 * Map the request body based on model mode
 * - No-Think: return body unchanged
 * - Think: add enable_thinking to chat_template_kwargs
 * - Unknown: return body unchanged
 */
export function mapRequest(body) {
    const model = (body.model || "");
    // Mode No-Think: return body unchanged
    if (isNoThinkMode(model)) {
        return body;
    }
    // Mode Think: transformation with enable_thinking
    if (isThinkMode(model)) {
        const realModel = extractRealModel(model);
        return {
            ...body,
            model: realModel || model,
            chat_template_kwargs: {
                ...(body.chat_template_kwargs || {}),
                enable_thinking: true,
            },
        };
    }
    // Unknown model: return body unchanged
    return body;
}
//# sourceMappingURL=modelMapper.js.map