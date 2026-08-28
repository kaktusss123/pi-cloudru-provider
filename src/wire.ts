export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | undefined;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

/**
 * Normalize OMP's internal thinking selection to each open-weight model's
 * native Chat Completions request shape. This intentionally removes a stale
 * reasoning_effort before writing binary/adaptive thinking controls.
 */
export function applyNativeReasoningWire(
  payload: Record<string, unknown>,
  modelId: string,
  level: ThinkingLevel,
): Record<string, unknown> {
  const id = modelId.toLowerCase();
  const next = { ...payload };

  if (id === "moonshotai/kimi-k2.6") {
    delete next.reasoning_effort;
    next.thinking = { type: level === "off" ? "disabled" : "enabled" };
    return next;
  }

  if (id === "minimaxai/minimax-m3") {
    delete next.reasoning_effort;
    const type = level === "off" ? "disabled" : level === "high" ? "enabled" : "adaptive";
    next.thinking = { type };
    return next;
  }

  if (id.startsWith("zai-org/glm-")) {
    delete next.reasoning_effort;
    next.thinking = { type: level === "off" ? "disabled" : "enabled" };
    return next;
  }

  if (id.startsWith("qwen/qwen3.5-") || id.startsWith("qwen/qwen3.6-")) {
    delete next.reasoning_effort;
    const kwargs = record(next.chat_template_kwargs);
    kwargs.enable_thinking = level !== "off";
    next.chat_template_kwargs = kwargs;
    return next;
  }

  // M2.5 is always-thinking in the current Cloud.ru catalog and has no
  // controllable open-weight effort ladder. Do not send a fabricated one.
  if (id === "minimaxai/minimax-m2.5") {
    delete next.reasoning_effort;
    return next;
  }

  // gpt-oss and DeepSeek V4 use reasoning_effort natively; leave OMP's value.
  return next;
}
