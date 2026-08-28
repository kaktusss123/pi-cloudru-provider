import type { CloudRuModel, OmpEffort, OmpThinkingConfig } from "./cloudru-types.ts";

function explicitEfforts(model: CloudRuModel): OmpEffort[] | undefined {
  const reasoning = model.metadata?.reasoning;
  const values = reasoning?.supported_efforts ?? reasoning?.efforts;
  if (!Array.isArray(values) || values.length === 0) return undefined;
  const allowed = new Set<OmpEffort>(["minimal", "low", "medium", "high", "xhigh", "max"]);
  const normalized = values.filter((v): v is OmpEffort => allowed.has(v as OmpEffort));
  return normalized.length > 0 ? normalized : undefined;
}

function explicitlyMandatory(model: CloudRuModel): boolean {
  return (model.reasoning_optional ?? model.metadata?.reasoning?.optional) === false;
}

/**
 * OMP UI capability metadata only. Wire encoding is handled separately by
 * model-native compat + the before_provider_request sanitizer.
 */
export function buildThinking(model: CloudRuModel): OmpThinkingConfig | undefined {
  if (!model.reasoning) return undefined;

  const advertised = explicitEfforts(model);
  if (advertised) {
    return {
      mode: "effort",
      efforts: advertised,
      defaultLevel: advertised[advertised.length - 1],
      requiresEffort: explicitlyMandatory(model),
    };
  }

  const id = model.id.toLowerCase();

  // MiniMax M3 has exactly three model-native modes: disabled/adaptive/enabled.
  // OMP's off state represents disabled; low/high represent adaptive/enabled.
  if (id === "minimaxai/minimax-m3") {
    return {
      mode: "effort",
      efforts: ["low", "high"],
      defaultLevel: "low",
      requiresEffort: false,
    };
  }

  // M2.5 is an always-thinking model in this Cloud.ru catalog. Do not invent
  // a user-controllable effort knob; omitting thinking metadata leaves it on.
  if (id === "minimaxai/minimax-m2.5") return undefined;

  // gpt-oss exposes a real low/medium/high ladder.
  if (id === "openai/gpt-oss-120b") {
    return {
      mode: "effort",
      efforts: ["low", "medium", "high"],
      defaultLevel: "medium",
      requiresEffort: true,
    };
  }

  // This Cloud.ru entry is the original V4-Pro snapshot whose open-weight
  // encoder accepts high/max (low is not part of that snapshot's contract).
  if (id === "deepseek-ai/deepseek-v4-pro") {
    return {
      mode: "effort",
      efforts: ["high", "max"],
      defaultLevel: "high",
      requiresEffort: true,
    };
  }

  // Kimi K2.6 and GLM 4.7/5.1 are binary thinking models. `high` is simply
  // the UI's ON state; the wire request is thinking.type=enabled, not
  // reasoning_effort=enabled.
  if (id === "moonshotai/kimi-k2.6" || id.startsWith("zai-org/glm-")) {
    return {
      mode: "effort",
      efforts: ["high"],
      defaultLevel: "high",
      requiresEffort: false,
    };
  }

  // Qwen 3.5/3.6 is marked reasoning_optional=false by Cloud.ru. Keep it
  // reasoning-capable but do not create a fake effort ladder.
  if (id.startsWith("qwen/qwen3.5-") || id.startsWith("qwen/qwen3.6-")) {
    return undefined;
  }

  // Unknown reasoning-capable models: do not guess a wire effort vocabulary.
  return undefined;
}
