import assert from "node:assert/strict";
import fs from "node:fs";
import { mapCatalog } from "../src/catalog.ts";
import { applyNativeReasoningWire } from "../src/wire.ts";

const fixture = JSON.parse(fs.readFileSync(new URL("../fixtures/cloudru-models.json", import.meta.url), "utf8"));
const models = mapCatalog(fixture, { rubPerUsd: 80, defaultMaxTokens: 16384 });
assert.equal(models.length, 11);

const kimi = models.find((m) => m.id === "moonshotai/Kimi-K2.6");
assert.ok(kimi);
assert.equal(kimi.compat.supportsReasoningEffort, false);
assert.equal(kimi.compat.thinkingFormat, "zai");
assert.deepEqual(kimi.thinking.efforts, ["high"]);
assert.deepEqual(
  applyNativeReasoningWire({ reasoning_effort: "enabled", messages: [] }, kimi.id, "high"),
  { messages: [], thinking: { type: "enabled" } },
);
assert.deepEqual(
  applyNativeReasoningWire({ reasoning_effort: "high" }, kimi.id, "off"),
  { thinking: { type: "disabled" } },
);

const m3 = models.find((m) => m.id === "MiniMaxAI/MiniMax-M3");
assert.ok(m3);
assert.deepEqual(applyNativeReasoningWire({ reasoning_effort: "low" }, m3.id, "low"), {
  thinking: { type: "adaptive" },
});
assert.deepEqual(applyNativeReasoningWire({ reasoning_effort: "high" }, m3.id, "high"), {
  thinking: { type: "enabled" },
});

const ds = models.find((m) => m.id === "deepseek-ai/DeepSeek-V4-Pro");
assert.deepEqual(ds.thinking.efforts, ["high", "max"]);
assert.deepEqual(applyNativeReasoningWire({ reasoning_effort: "max" }, ds.id, "max"), {
  reasoning_effort: "max",
});

console.log("smoke ok: model discovery mapping + native reasoning wire encoding");
