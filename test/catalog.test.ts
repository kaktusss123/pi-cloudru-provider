import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { mapCatalog } from "../src/catalog.ts";
import type { CloudRuModelsResponse } from "../src/cloudru-types.ts";

const require = createRequire(import.meta.url);
const fixture = require("../fixtures/cloudru-models.json") as CloudRuModelsResponse;

const mapped = () => mapCatalog(fixture, { rubPerUsd: 80, defaultMaxTokens: 16_384 });

describe("Cloud.ru catalog mapping", () => {
  it("contains exactly the native tool-capable LLM snapshot", () => {
    const models = mapped();
    expect(models).toHaveLength(11);
    expect(models.map((m) => m.id).sort()).toEqual(
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

  it("maps MiniMax M3 context, vision and RUB prices", () => {
    const m3 = mapped().find((m) => m.id === "MiniMaxAI/MiniMax-M3");
    expect(m3).toBeDefined();
    expect(m3?.contextWindow).toBe(524_288);
    expect(m3?.maxTokens).toBe(16_384);
    expect(m3?.input).toEqual(["text", "image"]);
    expect(m3?.cost.input).toBeCloseTo(240.218 / 80);
    expect(m3?.cost.output).toBeCloseTo(1008.8546 / 80);
  });

  it("does not lie about currency when no RUB/USD rate is configured", () => {
    const m3 = mapCatalog(fixture, { defaultMaxTokens: 16_384 }).find((m) => m.id === "MiniMaxAI/MiniMax-M3");
    expect(m3?.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });

  it("does not mistake max_model_len for output token limit", () => {
    const deepseek = mapped().find((m) => m.id === "deepseek-ai/DeepSeek-V4-Pro");
    expect(deepseek?.contextWindow).toBe(1_048_576);
    expect(deepseek?.maxTokens).toBe(16_384);
  });

  it("does not mark non-reasoning models as reasoning models", () => {
    const coder = mapped().find((m) => m.id === "Qwen/Qwen3-Coder-Next");
    expect(coder?.reasoning).toBe(false);
    expect(coder?.thinking).toBeUndefined();
    expect(coder?.compat?.supportsReasoningEffort).toBeUndefined();
  });
});
