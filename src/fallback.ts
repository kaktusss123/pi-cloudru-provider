import type { Model } from "@earendil-works/pi-ai";
import type { CloudRuConfig } from "./config.ts";
import { mapCatalog } from "./catalog.ts";
import { FALLBACK_CATALOG } from "./fallback-catalog.ts";

export function fallbackModels(config: CloudRuConfig): Model<"openai-completions">[] {
  return mapCatalog(FALLBACK_CATALOG, {
    baseUrl: config.baseUrl,
    rubPerUsd: config.rubPerUsd,
    defaultMaxTokens: config.defaultMaxTokens,
  });
}
