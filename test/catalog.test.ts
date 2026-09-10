import { describe, expect, it } from "vitest";
import { mapCatalog } from "../src/catalog.ts";
import { FALLBACK_CATALOG } from "../src/fallback-catalog.ts";

const options = { baseUrl: "https://example.test/v1", rubPerUsd: 80, defaultMaxTokens: 16_384 };
const mapped = () => mapCatalog(FALLBACK_CATALOG, options);

describe("Cloud.ru catalog mapping", () => {
  it("maps the native tool-capable LLM snapshot with exact IDs", () => {
    const models = mapped();
    expect(models).toHaveLength(11);
    expect(models.map((model) => model.id).sort()).toEqual(
      [
        "ai-sage/GigaChat3-10B-A1.8B",
        "zai-org/GLM-5.1",
        "moonshotai/Kimi-K2.6",
        "deepseek-ai/DeepSeek-V4-Pro",
        "MiniMaxAI/MiniMax-M3",
        "MiniMaxAI/MiniMax-M2.5",
        "zai-org/GLM-4.7",
        "openai/gpt-oss-120b",
        "Qwen/Qwen3.5-397B-A17B",
        "Qwen/Qwen3.6-35B-A3B",
        "Qwen/Qwen3-Coder-Next",
      ].sort(),
    );
  });

  it("maps context, modalities, max tokens, and RUB prices", () => {
    const m3 = mapped().find((model) => model.id === "MiniMaxAI/MiniMax-M3");
    expect(m3).toMatchObject({
      contextWindow: 524_288,
      maxTokens: 16_384,
      input: ["text", "image"],
    });
    expect(m3?.cost.input).toBeCloseTo(240.218 / 80);
    expect(m3?.cost.output).toBeCloseTo(1008.8546 / 80);
  });

  it("keeps costs at zero when RUB conversion is not configured", () => {
    const models = mapCatalog(FALLBACK_CATALOG, { baseUrl: options.baseUrl, defaultMaxTokens: options.defaultMaxTokens });
    expect(models.find((model) => model.id === "MiniMaxAI/MiniMax-M3")?.cost).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });

  it("uses context limits rather than max_model_len as output limits", () => {
    const deepseek = mapped().find((model) => model.id === "deepseek-ai/DeepSeek-V4-Pro");
    expect(deepseek?.contextWindow).toBe(1_048_576);
    expect(deepseek?.maxTokens).toBe(16_384);
  });
});
