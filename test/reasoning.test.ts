import { describe, expect, it } from "vitest";
import { mapCatalog } from "../src/catalog.ts";
import { FALLBACK_CATALOG } from "../src/fallback-catalog.ts";
import { applyNativePiRequest } from "../src/native-request.ts";
import { modelCompat } from "../src/compat.ts";
import { thinkingLevelMap } from "../src/reasoning.ts";

const options = { baseUrl: "https://example.test/v1", defaultMaxTokens: 16_384 };
const source = (id: string) => FALLBACK_CATALOG.data.find((model) => model.id === id)!;
const mapped = (id: string) => mapCatalog(FALLBACK_CATALOG, options).find((model) => model.id === id)!;

describe("Pi-native reasoning profiles", () => {
  it("maps M3 to disabled/adaptive/enabled and fixes Pi's native adaptive gap", () => {
    const model = source("MiniMaxAI/MiniMax-M3");
    expect(thinkingLevelMap(model)).toMatchObject({ off: "disabled", low: "adaptive", high: "enabled" });
    expect(modelCompat(model)).toMatchObject({ thinkingFormat: "zai", supportsReasoningEffort: false });
    expect(applyNativePiRequest({ reasoning_effort: "low" }, model.id, "low")).toEqual({
      thinking: { type: "adaptive" },
    });
    expect(applyNativePiRequest({ reasoning_effort: "high" }, model.id, "high")).toEqual({
      thinking: { type: "enabled" },
    });
    expect(applyNativePiRequest({ reasoning_effort: "minimal" }, model.id, "off")).toEqual({
      thinking: { type: "disabled" },
    });
  });

  it("uses native Zai controls and reasoning replay for Kimi", () => {
    const model = mapped("moonshotai/Kimi-K2.6");
    expect(model.id).toBe("moonshotai/Kimi-K2.6");
    expect(model.thinkingLevelMap).toMatchObject({ off: "disabled", high: "enabled" });
    expect(model.compat).toMatchObject({
      supportsReasoningEffort: false,
      thinkingFormat: "zai",
      requiresReasoningContentOnAssistantMessages: true,
    });
  });

  it("restricts GPT-OSS and DeepSeek to evidenced effort values", () => {
    expect(mapped("openai/gpt-oss-120b").thinkingLevelMap).toEqual({
      off: null,
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
      max: null,
    });
    expect(mapped("deepseek-ai/DeepSeek-V4-Pro").thinkingLevelMap).toEqual({
      off: null,
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: null,
      max: "max",
    });
    expect(mapped("deepseek-ai/DeepSeek-V4-Pro").compat).toMatchObject({
      supportsReasoningEffort: true,
      requiresReasoningContentOnAssistantMessages: true,
    });
  });

  it("hides off for always-thinking M2.5 and Qwen without guessed efforts", () => {
    expect(mapped("MiniMaxAI/MiniMax-M2.5").thinkingLevelMap).toEqual({ off: null });
    expect(mapped("Qwen/Qwen3.5-397B-A17B").thinkingLevelMap).toEqual({ off: null });
    expect(mapped("Qwen/Qwen3.5-397B-A17B").compat).toMatchObject({
      thinkingFormat: "qwen-chat-template",
      supportsReasoningEffort: false,
    });
  });

  it("leaves unknown reasoning models conservative", () => {
    const unknown = { ...source("MiniMaxAI/MiniMax-M3"), id: "vendor/New-Reasoner" };
    expect(thinkingLevelMap(unknown)).toBeUndefined();
    expect(modelCompat(unknown)).toBeUndefined();
  });
});
