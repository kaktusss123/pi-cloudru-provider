import type { CloudRuModel, OmpProviderModel } from "./cloudru-types.ts";

export function modelCompat(model: CloudRuModel): OmpProviderModel["compat"] | undefined {
  if (!model.reasoning) return undefined;
  const id = model.id.toLowerCase();

  if (id === "moonshotai/kimi-k2.6") {
    return {
      supportsReasoningEffort: false,
      omitReasoningEffort: true,
      thinkingFormat: "zai",
      reasoningDisableMode: "zai-thinking-disabled",
      reasoningContentField: "reasoning_content",
      requiresReasoningContentForToolCalls: true,
      allowsSyntheticReasoningContentForToolCalls: false,
    };
  }

  if (id === "minimaxai/minimax-m3" || id.startsWith("zai-org/glm-")) {
    return {
      supportsReasoningEffort: false,
      omitReasoningEffort: true,
      thinkingFormat: "zai",
      reasoningDisableMode: "zai-thinking-disabled",
      reasoningContentField: "reasoning_content",
    };
  }

  if (id.startsWith("qwen/qwen3.5-") || id.startsWith("qwen/qwen3.6-")) {
    return {
      supportsReasoningEffort: false,
      omitReasoningEffort: true,
      thinkingFormat: "qwen-chat-template",
      reasoningDisableMode: "qwen-template-false",
      reasoningContentField: "reasoning_content",
    };
  }

  if (id === "minimaxai/minimax-m2.5") {
    return {
      supportsReasoningEffort: false,
      omitReasoningEffort: true,
      reasoningContentField: "reasoning_content",
    };
  }

  if (id === "deepseek-ai/deepseek-v4-pro") {
    return {
      supportsReasoningEffort: true,
      thinkingFormat: "openai",
      reasoningContentField: "reasoning_content",
      requiresReasoningContentForToolCalls: true,
      requiresReasoningContentForAllAssistantTurns: true,
      allowsSyntheticReasoningContentForToolCalls: false,
    };
  }

  if (id === "openai/gpt-oss-120b") {
    return {
      supportsReasoningEffort: true,
      thinkingFormat: "openai",
    };
  }

  // Reasoning=true alone is not enough evidence to send a provider-specific
  // reasoning parameter. Unknown future models remain usable with defaults.
  return {
    supportsReasoningEffort: false,
    omitReasoningEffort: true,
  };
}
