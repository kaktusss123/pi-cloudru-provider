import type { OmpProviderModel } from "./cloudru-types.ts";
import { mapCatalog } from "./catalog.ts";
import type { CloudRuConfig } from "./config.ts";
import { FALLBACK_CATALOG } from "./fallback-catalog.ts";

export function fallbackModels(config: CloudRuConfig): OmpProviderModel[] {
  return mapCatalog(FALLBACK_CATALOG, {
    rubPerUsd: config.rubPerUsd,
    defaultMaxTokens: config.defaultMaxTokens,
  });
}
