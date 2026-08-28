import type { CloudRuModelsResponse, OmpProviderModel } from "./cloudru-types.ts";
import { mapCatalog } from "./catalog.ts";
import type { CloudRuConfig } from "./config.ts";

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  return trimmed.replace(/^Bearer\s+/i, "").trim();
}

export async function discoverModels(config: CloudRuConfig, resolvedApiKey: string): Promise<OmpProviderModel[]> {
  const apiKey = normalizeApiKey(resolvedApiKey);
  if (!apiKey) throw new Error("CLOUDRU_API_KEY resolved to an empty value");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${config.discoveryTimeoutMs}ms`)), config.discoveryTimeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const suffix = body ? `: ${body.slice(0, 300)}` : "";
      throw new Error(`Cloud.ru /models failed with HTTP ${response.status}${suffix}`);
    }

    const payload = (await response.json()) as CloudRuModelsResponse;
    const models = mapCatalog(payload, {
      rubPerUsd: config.rubPerUsd,
      defaultMaxTokens: config.defaultMaxTokens,
    });

    if (models.length === 0) {
      throw new Error("Cloud.ru /models returned no native tool-capable LLMs after filtering");
    }

    return models;
  } finally {
    clearTimeout(timeout);
  }
}
