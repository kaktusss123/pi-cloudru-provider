import assert from "node:assert/strict";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import cloudRuProvider from "../extensions/cloudru-provider.ts";
import { mapCatalog } from "../src/catalog.ts";
import { FALLBACK_CATALOG } from "../src/fallback-catalog.ts";
import { applyNativePiRequest } from "../src/native-request.ts";

const registered = [];
const handlers = new Map();
const pi = {
  registerProvider(provider) {
    registered.push(provider);
  },
  on(event, handler) {
    handlers.set(event, handler);
  },
  getThinkingLevel() {
    return "low";
  },
};

cloudRuProvider(pi);
assert.equal(registered.length, 1);
const provider = registered[0];
assert.equal(provider.id, "cloudru");
assert.equal(provider.name, "Cloud.ru");
assert.equal(provider.getModels().some((model) => model.id === "moonshotai/Kimi-K2.6"), true);
assert.equal(typeof provider.refreshModels, "function");
assert.equal(typeof provider.stream, "function");

const m3 = mapCatalog(FALLBACK_CATALOG, {
  baseUrl: "https://example.test/v1",
  defaultMaxTokens: 16_384,
}).find((model) => model.id === "MiniMaxAI/MiniMax-M3");
assert.ok(m3);
assert.deepEqual(applyNativePiRequest({ model: m3.id, reasoning_effort: "low" }, m3.id, "low"), {
  model: "MiniMaxAI/MiniMax-M3",
  thinking: { type: "adaptive" },
});

const m3Handler = handlers.get("before_provider_request");
const transformed = m3Handler(
  { type: "before_provider_request", payload: { model: m3.id, reasoning_effort: "high" } },
  { model: m3, thinkingLevel: "high" },
);
assert.deepEqual(transformed, {
  model: "MiniMaxAI/MiniMax-M3",
  thinking: { type: "enabled" },
});
const replayModel = mapCatalog(FALLBACK_CATALOG, {
  baseUrl: "https://example.test/v1",
  defaultMaxTokens: 16_384,
}).find((model) => model.id === "moonshotai/Kimi-K2.6");
assert.ok(replayModel);

let replayPayload;
const replayContext = {
  messages: [
    { role: "user", content: "call the tool", timestamp: Date.now() },
    {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "plan", thinkingSignature: "reasoning_content" },
        { type: "toolCall", id: "call-1", name: "tool", arguments: { value: 1 } },
      ],
      api: "openai-completions",
      provider: "cloudru",
      model: replayModel.id,
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "toolUse",
      timestamp: Date.now(),
    },
    { role: "toolResult", toolCallId: "call-1", toolName: "tool", content: [{ type: "text", text: "done" }], isError: false, timestamp: Date.now() },
  ],
};
const fakeFetch = async (_url, init) => {
  replayPayload = JSON.parse(init.body);
  return new Response("data: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
};
for await (const _event of openAICompletionsApi().stream(replayModel, replayContext, {
  apiKey: "test-key",
  fetch: fakeFetch,
  reasoningEffort: "high",
})) {}
const replayedAssistant = replayPayload.messages.find((message) => message.role === "assistant");
assert.equal(replayedAssistant.reasoning_content, "plan");
assert.equal(replayedAssistant.tool_calls[0].id, "call-1");

// Sanitizer: empty tools (openai-completions replay artifact) is dropped for every
// cloudru model, non-M3 included; the payload otherwise passes through.
const nonM3Payload = {
  model: replayModel.id,
  tools: [],
  messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AA" } }] }],
};
const nonM3Result = m3Handler(
  { type: "before_provider_request", payload: nonM3Payload },
  { model: replayModel, thinkingLevel: "high" },
);
assert.equal("tools" in nonM3Result, false);
assert.deepEqual(nonM3Result.messages[0].content, [
  { type: "image_url", image_url: { url: "data:image/png;base64,AA" } },
]);
assert.equal("thinking" in nonM3Result, false);

const m3EmptyTools = m3Handler(
  { type: "before_provider_request", payload: { model: m3.id, tools: [] } },
  { model: m3, thinkingLevel: "high" },
);
assert.deepEqual(m3EmptyTools, { model: "MiniMaxAI/MiniMax-M3", thinking: { type: "enabled" } });

console.log("smoke ok: native registration, exact M3 request mapping, and OpenAI replay");
