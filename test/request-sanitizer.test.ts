import { describe, expect, it } from "vitest";
import { sanitizeProviderPayload, stripEmptyTools, trimExcessImages } from "../src/request-sanitizer.ts";

function imagePart(url: string) {
  return { type: "image_url", image_url: { url } };
}

function payloadWithImages(...counts: number[]) {
  const messages = counts.map((count, index) => {
    const content: unknown[] = [];
    for (let i = 0; i < count; i++) content.push(imagePart(`img-${index}-${i}`));
    if (content.length === 0) content.push({ type: "text", text: `msg-${index}` });
    return { role: "user", content };
  });
  return { model: "test", messages };
}

describe("stripEmptyTools", () => {
  it("removes an empty tools array and keeps other keys", () => {
    const payload = { model: "m", tools: [], temperature: 0.2 };
    const result = stripEmptyTools(payload);
    expect(result).toEqual({ model: "m", temperature: 0.2 });
    expect(result).not.toBe(payload);
    expect("tools" in (result as Record<string, unknown>)).toBe(false);
  });

  it("returns non-empty tools unchanged (same reference)", () => {
    const tool = { type: "function", function: { name: "read" } };
    const payload = { model: "m", tools: [tool] };
    expect(stripEmptyTools(payload)).toBe(payload);
  });

  it("returns payloads without a tools key unchanged (same reference)", () => {
    const payload = { model: "m", messages: [] };
    expect(stripEmptyTools(payload)).toBe(payload);
  });

  it("leaves non-record payloads untouched", () => {
    expect(stripEmptyTools(null)).toBe(null);
    expect(stripEmptyTools("tools")).toBe("tools");
    expect(stripEmptyTools(42)).toBe(42);
    const array = [{ tools: [] }];
    expect(stripEmptyTools(array)).toBe(array);
  });
});

describe("trimExcessImages", () => {
  it("returns payloads with at most 5 images unchanged (same reference)", () => {
    const payload = payloadWithImages(2, 3);
    expect(trimExcessImages(payload)).toBe(payload);
  });

  it("keeps the newest 5 images across message boundaries and replaces older ones", () => {
    const messages = [
      { role: "user", content: "text only, no images" },
      { role: "user", content: [imagePart("img-a"), imagePart("img-b"), { type: "text", text: "with shots" }] },
      { role: "user", content: [imagePart("img-c"), imagePart("img-d"), imagePart("img-e"), imagePart("img-f")] },
    ];
    const payload = { model: "m", messages };
    const result = trimExcessImages(payload) as typeof payload;
    expect(result).not.toBe(payload);
    expect(result.model).toBe("m");

    expect(result.messages[0]).toBe(messages[0]);
    expect(result.messages[2]).toBe(messages[2]);
    expect(result.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "[image omitted: provider image limit]" },
        imagePart("img-b"),
        { type: "text", text: "with shots" },
      ],
    });
    expect(result.messages[1]).not.toBe(messages[1]);
  });

  it("never leaves an empty content array and does not mutate the input", () => {
    const payload = payloadWithImages(1, 1, 1, 1, 1, 1);
    const frozen = structuredClone(payload);
    const result = trimExcessImages(payload) as typeof payload;
    expect(payload).toEqual(frozen);
    for (const message of result.messages) {
      expect(Array.isArray(message.content)).toBe(true);
      expect((message.content as unknown[]).length).toBeGreaterThan(0);
    }
    expect(result.messages[0].content).toEqual([{ type: "text", text: "[image omitted: provider image limit]" }]);
    expect(result.messages[5].content).toEqual([imagePart("img-5-0")]);
  });

  it("honors a custom maxImages", () => {
    const payload = payloadWithImages(5);
    expect(trimExcessImages(payload, 5)).toBe(payload);
    const trimmed = trimExcessImages(payload, 2) as typeof payload;
    expect(trimmed).not.toBe(payload);
    expect(trimmed.messages[0].content).toEqual([
      { type: "text", text: "[image omitted: provider image limit]" },
      { type: "text", text: "[image omitted: provider image limit]" },
      { type: "text", text: "[image omitted: provider image limit]" },
      imagePart("img-0-3"),
      imagePart("img-0-4"),
    ]);
  });

  it("leaves non-record payloads and missing/invalid messages untouched", () => {
    expect(trimExcessImages(null)).toBe(null);
    expect(trimExcessImages("payload")).toBe("payload");
    const noMessages = { model: "m" };
    expect(trimExcessImages(noMessages)).toBe(noMessages);
    const badMessages = { messages: "nope" };
    expect(trimExcessImages(badMessages)).toBe(badMessages);
  });

  it("ignores non-image content parts when counting", () => {
    const payload = {
      model: "m",
      messages: [
        { role: "user", content: [{ type: "text", text: "shot" }, { type: "other" }, imagePart("img-1")] },
        { role: "assistant", content: [{ type: "text", text: "ok" }] },
      ],
    };
    expect(trimExcessImages(payload)).toBe(payload);
  });
});

describe("sanitizeProviderPayload", () => {
  it("drops empty tools and trims images in one pass", () => {
    const payload = {
      model: "m",
      tools: [],
      messages: [{ role: "user", content: [imagePart("a"), imagePart("b"), imagePart("c"), imagePart("d"), imagePart("e"), imagePart("f")] }],
    };
    const result = sanitizeProviderPayload(payload) as Record<string, unknown>;
    expect("tools" in result).toBe(false);
    expect(result.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "[image omitted: provider image limit]" },
          imagePart("b"),
          imagePart("c"),
          imagePart("d"),
          imagePart("e"),
          imagePart("f"),
        ],
      },
    ]);
  });

  it("returns payloads that need no changes unchanged", () => {
    const payload = { model: "m", messages: [{ role: "user", content: "hi" }] };
    expect(sanitizeProviderPayload(payload)).toBe(payload);
  });
});
