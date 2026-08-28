import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { readConfig } from "../src/config.ts";
import { discoverModels } from "../src/discovery.ts";
import { fallbackModels } from "../src/fallback.ts";
import { applyNativeReasoningWire } from "../src/wire.ts";

const PROVIDER_ID = "cloudru";
const API_KEY_ENV = "CLOUDRU_API_KEY";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function cloudRuProvider(pi: ExtensionAPI) {
  const config = readConfig();
  const fallback = fallbackModels(config);

  if (!config.rubPerUsd) {
    console.warn(
      "[pi-cloudru-provider] CLOUDRU_RUB_PER_USD is not set; OMP USD cost accounting is disabled. " +
        "Cloud.ru catalog prices remain available to discovery but are not mislabeled as USD.",
    );
  }

  pi.registerProvider(PROVIDER_ID, {
    baseUrl: config.baseUrl,
    // OMP expects an env-var NAME here, not Pi's legacy "$ENV_VAR" syntax.
    apiKey: API_KEY_ENV,
    api: "openai-completions",
    models: fallback,
    fetchDynamicModels: async (apiKey) => {
      if (config.offline) return fallback;
      if (!apiKey) throw new Error(`${API_KEY_ENV} is not set`);
      return discoverModels(config, apiKey);
    },
  });

  // OMP normalizes its UI to a small set of thinking levels. Cloud.ru serves
  // heterogeneous open-weight models whose *wire* controls are not uniform:
  // Kimi/GLM use thinking.type, M3 uses disabled/adaptive/enabled, Qwen uses
  // chat_template_kwargs.enable_thinking, while gpt-oss/DeepSeek use
  // reasoning_effort. Normalize the final payload immediately before send.
  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== PROVIDER_ID) return;
    if (!isRecord(event.payload)) return;

    return applyNativeReasoningWire(
      event.payload,
      ctx.model.id,
      pi.getThinkingLevel(),
    );
  });
}
