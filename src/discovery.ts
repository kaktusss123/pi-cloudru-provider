import type { Credential, Model, RefreshModelsContext } from "@earendil-works/pi-ai";
import type { CloudRuModelsResponse } from "./cloudru-types.ts";
import { mapCatalog } from "./catalog.ts";
import type { CloudRuConfig } from "./config.ts";

export function normalizeApiKey(value: string): string {
  return value.trim().replace(/^Bearer\s+/i, "").trim();
}

function usable(value: unknown): value is string {
  return typeof value === "string" && normalizeApiKey(value).length > 0;
}

export function resolveCloudRuCredential(
  credential?: Credential,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (credential?.type === "oauth") return undefined;
  if (credential) {
    if (usable(credential.key)) return normalizeApiKey(credential.key);
    if (usable(credential.env?.CLOUDRU_API_KEY)) return normalizeApiKey(credential.env.CLOUDRU_API_KEY);
    return undefined;
  }
  return usable(env.CLOUDRU_API_KEY) ? normalizeApiKey(env.CLOUDRU_API_KEY) : undefined;
}

export function storedProviderModels(
  context: RefreshModelsContext,
  config: CloudRuConfig,
): Model<"openai-completions">[] {
  return (context.stored?.models ?? [])
    .filter((model): model is Model<"openai-completions"> => model.provider === "cloudru" && model.api === "openai-completions")
    .map((model) => ({ ...model, baseUrl: config.baseUrl }));
}

export async function discoverModels(
  config: CloudRuConfig,
  resolvedApiKey: string,
  signal?: AbortSignal,
): Promise<Model<"openai-completions">[]> {
  const apiKey = normalizeApiKey(resolvedApiKey);
  if (!apiKey) throw new Error("CLOUDRU_API_KEY resolved to an empty value");

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), config.discoveryTimeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;

  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: requestSignal,
    });
    if (!response.ok) throw new Error(`Cloud.ru /models failed with HTTP ${response.status}`);

    const payload = (await response.json()) as CloudRuModelsResponse;
    const models = mapCatalog(payload, {
      baseUrl: config.baseUrl,
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
