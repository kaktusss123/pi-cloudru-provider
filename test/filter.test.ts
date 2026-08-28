import { describe, expect, it } from "vitest";
import { isNativeToolLlm } from "../src/catalog.ts";
import type { CloudRuModel } from "../src/cloudru-types.ts";

const base = (): CloudRuModel => ({
  id: "example/model",
  function_calling: true,
  metadata: {
    provider: "cloud.ru",
    type: "llm",
    endpoints: [{ path: "/v1/chat/completions" }],
  },
});

describe("catalog filter", () => {
  it("accepts native Cloud.ru tool LLMs", () => expect(isNativeToolLlm(base())).toBe(true));

  it("rejects external models", () => {
    const model = base();
    model.metadata!.provider = "external";
    expect(isNativeToolLlm(model)).toBe(false);
  });

  it("rejects embeddings/rerankers and models without function calling", () => {
    const embedding = base();
    embedding.metadata!.type = "embedder";
    expect(isNativeToolLlm(embedding)).toBe(false);

    const noTools = base();
    noTools.function_calling = false;
    expect(isNativeToolLlm(noTools)).toBe(false);
  });
});
