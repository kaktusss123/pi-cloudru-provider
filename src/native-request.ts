import type { ModelThinkingLevel } from "@earendil-works/pi-ai";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function applyNativePiRequest(
  payload: unknown,
  modelId: string,
  level: ModelThinkingLevel | undefined,
): unknown {
  if (!isRecord(payload) || modelId.toLowerCase() !== "minimaxai/minimax-m3") return payload;

  const next = { ...payload };
  delete next.reasoning_effort;
  next.thinking = {
    type: level === "off" || level === undefined ? "disabled" : level === "high" ? "enabled" : "adaptive",
  };
  return next;
}
