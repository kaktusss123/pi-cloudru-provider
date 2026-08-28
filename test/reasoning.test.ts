import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { CloudRuModelsResponse } from "../src/cloudru-types.ts";
import { buildThinking } from "../src/reasoning.ts";
import { modelCompat } from "../src/compat.ts";
import { applyNativeReasoningWire } from "../src/wire.ts";

const require = createRequire(import.meta.url);
const fixture = require("../fixtures/cloudru-models.json") as CloudRuModelsResponse;
const byId = (id: string) => fixture.data.find((m) => m.id === id)!;

describe("reasoning profiles and wire encoding", () => {
  it("maps MiniMax M3 UI levels to thinking.type, never reasoning_effort", () => {
    const model = byId("MiniMaxAI/MiniMax-M3");
    expect(buildThinking(model)).toEqual({
      mode: "effort",
      efforts: ["low", "high"],
      defaultLevel: "low",
      requiresEffort: false,
    });
    expect(applyNativeReasoningWire({ reasoning_effort: "low" }, model.id, "low")).toEqual({
      thinking: { type: "adaptive" },
    });
    expect(applyNativeReasoningWire({ reasoning_effort: "high" }, model.id, "high")).toEqual({
      thinking: { type: "enabled" },
    });
    expect(applyNativeReasoningWire({ reasoning_effort: "minimal" }, model.id, "off")).toEqual({
      thinking: { type: "disabled" },
    });
  });

  it("encodes Kimi K2.6 with thinking.type instead of reasoning_effort=enabled", () => {
    const model = byId("moonshotai/Kimi-K2.6");
    expect(buildThinking(model)).toEqual({
      mode: "effort",
      efforts: ["high"],
      defaultLevel: "high",
      requiresEffort: false,
    });
    expect(modelCompat(model)).toMatchObject({
      supportsReasoningEffort: false,
      omitReasoningEffort: true,
      thinkingFormat: "zai",
    });
    expect(applyNativeReasoningWire({ reasoning_effort: "enabled", messages: [] }, model.id, "high")).toEqual({
      messages: [],
      thinking: { type: "enabled" },
    });
    expect(applyNativeReasoningWire({ reasoning_effort: "none" }, model.id, "off")).toEqual({
      thinking: { type: "disabled" },
    });
  });

  it("keeps the original DeepSeek V4 snapshot on high/max reasoning_effort", () => {
    const model = byId("deepseek-ai/DeepSeek-V4-Pro");
    expect(buildThinking(model)).toEqual({
      mode: "effort",
      efforts: ["high", "max"],
      defaultLevel: "high",
      requiresEffort: true,
    });
    expect(applyNativeReasoningWire({ reasoning_effort: "max" }, model.id, "max")).toEqual({
      reasoning_effort: "max",
    });
  });

  it("keeps gpt-oss low/medium/high as real reasoning_effort values", () => {
    const model = byId("openai/gpt-oss-120b");
    expect(buildThinking(model)?.efforts).toEqual(["low", "medium", "high"]);
    expect(applyNativeReasoningWire({ reasoning_effort: "medium" }, model.id, "medium")).toEqual({
      reasoning_effort: "medium",
    });
  });

  it("does not fabricate a control surface for always-reasoning M2.5/Qwen", () => {
    expect(buildThinking(byId("MiniMaxAI/MiniMax-M2.5"))).toBeUndefined();
    expect(buildThinking(byId("Qwen/Qwen3.5-397B-A17B"))).toBeUndefined();
  });
});
