import type { ThinkingLevelMap } from "@earendil-works/pi-ai";
import type { CloudRuModel } from "./cloudru-types.ts";

const binaryHiddenLevels = {
  minimal: null,
  low: null,
  medium: null,
  xhigh: null,
  max: null,
} satisfies ThinkingLevelMap;

export function thinkingLevelMap(model: CloudRuModel): ThinkingLevelMap | undefined {
  if (!model.reasoning) return undefined;
  const id = model.id.toLowerCase();

  if (id === "moonshotai/kimi-k2.6" || id.startsWith("zai-org/glm-")) {
    return { ...binaryHiddenLevels, off: "disabled", high: "enabled" };
  }

  if (id === "minimaxai/minimax-m3") {
    return { ...binaryHiddenLevels, off: "disabled", low: "adaptive", high: "enabled" };
  }

  if (id === "minimaxai/minimax-m2.5" || id.startsWith("qwen/qwen3.5-") || id.startsWith("qwen/qwen3.6-")) {
    return { off: null };
  }

  if (id === "openai/gpt-oss-120b") {
    return {
      off: null,
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
      max: null,
    };
  }

  if (id === "deepseek-ai/deepseek-v4-pro") {
    return {
      off: null,
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: null,
      max: "max",
    };
  }

  return undefined;
}
