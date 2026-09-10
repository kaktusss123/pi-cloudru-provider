import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createCloudRuProviderFromEnvironment } from "../src/provider.ts";
import { applyNativePiRequest } from "../src/native-request.ts";

const PROVIDER_ID = "cloudru";

export default function cloudRuProvider(pi: ExtensionAPI): void {
  pi.registerProvider(createCloudRuProviderFromEnvironment());

  // Pi 0.85.1's native Zai encoder has no adaptive value; patch only M3.
  pi.on("before_provider_request", (event, context) => {
    const model = context.model;
    if (!model || model.provider !== PROVIDER_ID || model.id.toLowerCase() !== "minimaxai/minimax-m3") {
      return;
    }
    return applyNativePiRequest(event.payload, model.id, context.thinkingLevel ?? pi.getThinkingLevel());
  });
}
