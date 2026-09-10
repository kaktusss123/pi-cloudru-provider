import type { Model, OpenAICompletionsCompat } from "@earendil-works/pi-ai";
import type { CloudRuModel } from "./cloudru-types.ts";

export function modelCompat(model: CloudRuModel): Model<"openai-completions">["compat"] | undefined {
  if (!model.reasoning) return undefined;
  const id = model.id.toLowerCase();

  if (id === "moonshotai/kimi-k2.6") {
    return {
      supportsReasoningEffort: false,
      thinkingFormat: "zai",
      requiresReasoningContentOnAssistantMessages: true,
      maxTokensField: "max_tokens",
    } satisfies OpenAICompletionsCompat;
  }

  if (id === "minimaxai/minimax-m3" || id.startsWith("zai-org/glm-")) {
    return {
      supportsReasoningEffort: false,
      thinkingFormat: "zai",
      maxTokensField: "max_tokens",
    } satisfies OpenAICompletionsCompat;
  }

  if (id.startsWith("qwen/qwen3.5-") || id.startsWith("qwen/qwen3.6-")) {
    return {
      supportsReasoningEffort: false,
      thinkingFormat: "qwen-chat-template",
      maxTokensField: "max_tokens",
    } satisfies OpenAICompletionsCompat;
  }

  if (id === "minimaxai/minimax-m2.5") {
    return {
      supportsReasoningEffort: false,
      maxTokensField: "max_tokens",
    } satisfies OpenAICompletionsCompat;
  }

  if (id === "deepseek-ai/deepseek-v4-pro") {
    return {
      supportsReasoningEffort: true,
      thinkingFormat: "openai",
      requiresReasoningContentOnAssistantMessages: true,
      maxTokensField: "max_tokens",
    } satisfies OpenAICompletionsCompat;
  }

  if (id === "openai/gpt-oss-120b") {
    return {
      supportsReasoningEffort: true,
      maxTokensField: "max_tokens",
    } satisfies OpenAICompletionsCompat;
  }

  return undefined;
}
