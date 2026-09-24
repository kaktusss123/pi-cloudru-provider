import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createCloudRuProviderFromEnvironment } from "../src/provider.ts";
import { applyNativePiRequest } from "../src/native-request.ts";
import { sanitizeProviderPayload } from "../src/request-sanitizer.ts";

const PROVIDER_ID = "cloudru";
const MINIMAX_M3_MODEL_ID = "minimaxai/minimax-m3";

export default function cloudRuProvider(pi: ExtensionAPI): void {
  pi.registerProvider(createCloudRuProviderFromEnvironment());

  pi.on("before_provider_request", (event, context) => {
    const model = context.model;
    if (!model || model.provider !== PROVIDER_ID) return;
    const payload = sanitizeProviderPayload(event.payload);
    // Pi 0.85.1's native Zai encoder has no adaptive value; patch only M3.
    if (model.id.toLowerCase() !== MINIMAX_M3_MODEL_ID) return payload;
    return applyNativePiRequest(payload, model.id, context.thinkingLevel ?? pi.getThinkingLevel());
  });
}
