import { afterEach, describe, expect, it, vi } from "vitest";
import type { Credential, ModelsPublication, RefreshModelsContext } from "@earendil-works/pi-ai";
import { createCloudRuProvider } from "../src/provider.ts";
import { fallbackModels } from "../src/fallback.ts";
import { readConfig } from "../src/config.ts";
import { resolveCloudRuCredential } from "../src/discovery.ts";
import type { CloudRuModelsResponse } from "../src/cloudru-types.ts";

const config = readConfig({
  CLOUDRU_BASE_URL: "https://example.test/v1",
  CLOUDRU_DISCOVERY_TIMEOUT_MS: "1000",
  CLOUDRU_MAX_TOKENS: "4096",
});
const signal = new AbortController().signal;
const originalFetch = globalThis.fetch;

const liveCatalog: CloudRuModelsResponse = {
  data: [
    {
      id: "moonshotai/Kimi-K2.6",
      context_length: 32_000,
      max_output_tokens: 2048,
      function_calling: true,
      reasoning: true,
      metadata: {
        name: "Kimi live",
        provider: "cloud.ru",
        type: "llm",
        endpoints: [{ path: "/v1/chat/completions" }],
      },
    },
  ],
};

type FetchScenario = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function refreshContext(
  credential: Credential | undefined,
  stored?: RefreshModelsContext["stored"],
  allowNetwork = true,
): RefreshModelsContext & { readonly publication: ModelsPublication | undefined } {
  let publication: ModelsPublication | undefined;
  return {
    credential,
    stored,
    allowNetwork,
    signal,
    publish: vi.fn(async (value: ModelsPublication) => {
      publication = value;
      value.update?.();
      return true;
    }),
    get publication() {
      return publication;
    },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Cloud.ru credential resolution", () => {
  it("uses api_key.key before provider env and strips an optional Bearer prefix", () => {
    expect(resolveCloudRuCredential({ type: "api_key", key: " Bearer key-from-key ", env: { CLOUDRU_API_KEY: "env-key" } })).toBe(
      "key-from-key",
    );
  });

  it("uses api_key.env.CLOUDRU_API_KEY when key is absent", () => {
    expect(resolveCloudRuCredential({ type: "api_key", env: { CLOUDRU_API_KEY: "env-key" } })).toBe("env-key");
  });

  it("resolves absent-credential ambient CLOUDRU_API_KEY through native Pi auth context", async () => {
    const provider = createCloudRuProvider(config);
    const fileExists = vi.fn(async () => false);
    const result = await provider.auth.apiKey!.resolve({
      ctx: {
        env: async (name) => (name === "CLOUDRU_API_KEY" ? "ambient-secret" : undefined),
        fileExists,
      },
      credential: undefined,
      signal,
    });

    expect(result).toEqual({ auth: { apiKey: "ambient-secret" }, source: "CLOUDRU_API_KEY" });
    expect(fileExists).not.toHaveBeenCalled();
  });

  it("does not treat OAuth credentials as Cloud.ru API keys", () => {
    expect(resolveCloudRuCredential({ type: "oauth", access: "oauth-secret", refresh: "refresh", expires: 1 })).toBeUndefined();
  });
});

describe("native provider refresh", () => {
  it("publishes a filtered live catalog and sends the resolved key without exposing it", async () => {
    let request: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_input, init) => {
      request = init;
      return new Response(JSON.stringify(liveCatalog), { status: 200, headers: { "content-type": "application/json" } });
    });

    const provider = createCloudRuProvider(config);
    const context = refreshContext({ type: "api_key", key: "Bearer test-secret" });
    await provider.refreshModels!(context);

    expect((request?.headers as Record<string, string>).Authorization).toBe("Bearer test-secret");
    expect(provider.getModels().map((model) => model.id)).toEqual(["moonshotai/Kimi-K2.6"]);
    expect(context.publish).toHaveBeenCalledOnce();
    expect(JSON.stringify(context.publication)).not.toContain("test-secret");
  });

  it("restores stored models before a failed refresh and returns a redacted diagnostic", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 503 }));
    const provider = createCloudRuProvider(config);
    const stored = fallbackModels(config).slice(0, 1);
    const context = refreshContext({ type: "api_key", key: "stored-secret" }, { models: stored });

    await expect(provider.refreshModels!(context)).rejects.toThrow("Cloud.ru model refresh failed: Cloud.ru /models failed with HTTP 503");
    expect(provider.getModels().map((model) => model.id)).toEqual(stored.map((model) => model.id));
    expect(context.publish).toHaveBeenCalled();
  });

  it("retains the fallback catalog when the live request fails before stored state exists", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const provider = createCloudRuProvider(config);
    const fallbackIds = provider.getModels().map((model) => model.id);

    await expect(provider.refreshModels!(refreshContext({ type: "api_key", key: "secret" }))).rejects.toThrow(
      "no native tool-capable LLMs",
    );
    expect(provider.getModels().map((model) => model.id)).toEqual(fallbackIds);
  });

  it("uses ambient process env when refresh context has no credential", async () => {
    vi.stubEnv("CLOUDRU_API_KEY", "ambient-secret");
    let request: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_input, init) => {
      request = init;
      return new Response(JSON.stringify(liveCatalog), { status: 200, headers: { "content-type": "application/json" } });
    });
    const provider = createCloudRuProvider(config);

    await provider.refreshModels!(refreshContext(undefined));

    expect((request?.headers as Record<string, string>).Authorization).toBe("Bearer ambient-secret");
  });

  it("keeps the fallback without a network request when credential and ambient env are missing", async () => {
    vi.stubEnv("CLOUDRU_API_KEY", "");
    globalThis.fetch = vi.fn();
    const provider = createCloudRuProvider(config);
    const fallbackIds = provider.getModels().map((model) => model.id);

    await provider.refreshModels!(refreshContext(undefined));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(provider.getModels().map((model) => model.id)).toEqual(fallbackIds);
  });

  it("does not fall through an OAuth credential to ambient env", async () => {
    vi.stubEnv("CLOUDRU_API_KEY", "ambient-secret");
    globalThis.fetch = vi.fn();
    const provider = createCloudRuProvider(config);
    const fallbackIds = provider.getModels().map((model) => model.id);
    const oauthCredential = { type: "oauth" as const, access: "oauth-secret", refresh: "refresh", expires: Date.now() + 60_000 };
    const context = refreshContext(oauthCredential);

    const auth = await provider.auth.apiKey!.resolve({
      ctx: {
        env: async () => "ambient-secret",
        fileExists: async () => false,
      },
      credential: oauthCredential as never,
      signal,
    });
    await provider.refreshModels!(context);

    expect(auth).toBeUndefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(provider.getModels().map((model) => model.id)).toEqual(fallbackIds);
  });

  it("does not fall through an invalid stored credential to ambient env", async () => {
    vi.stubEnv("CLOUDRU_API_KEY", "ambient-secret");
    globalThis.fetch = vi.fn();
    const provider = createCloudRuProvider(config);
    const fallbackIds = provider.getModels().map((model) => model.id);
    const invalidCredential = { type: "api_key" as const, key: "   " };
    const context = refreshContext(invalidCredential);

    const auth = await provider.auth.apiKey!.resolve({
      ctx: {
        env: async () => "ambient-secret",
        fileExists: async () => false,
      },
      credential: invalidCredential,
      signal,
    });
    await provider.refreshModels!(context);

    expect(auth).toBeUndefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(provider.getModels().map((model) => model.id)).toEqual(fallbackIds);
  });

  it("does not request the network when refresh is cache-only", async () => {
    globalThis.fetch = vi.fn();
    const provider = createCloudRuProvider(config);
    const fallbackIds = provider.getModels().map((model) => model.id);

    await provider.refreshModels!(refreshContext(undefined, undefined, false));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(provider.getModels().map((model) => model.id)).toEqual(fallbackIds);
  });
  it("does not request the network when configuration is offline", async () => {
    globalThis.fetch = vi.fn();
    const offlineConfig = readConfig({
      CLOUDRU_BASE_URL: config.baseUrl,
      CLOUDRU_OFFLINE: "1",
      CLOUDRU_MAX_TOKENS: "4096",
    });
    const provider = createCloudRuProvider(offlineConfig);
    const fallbackIds = provider.getModels().map((model) => model.id);
    await provider.refreshModels!(refreshContext(undefined));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(provider.getModels().map((model) => model.id)).toEqual(fallbackIds);
  });

  const failureScenarios: [string, FetchScenario, string][] = [
    ["HTTP", async () => new Response(null, { status: 503 }), "Cloud.ru /models failed with HTTP 503"],
    [
      "invalid payload",
      async () => new Response(JSON.stringify({ nope: true }), { status: 200 }),
      "Cloud.ru /models returned an invalid payload: expected { data: [] }",
    ],
    [
      "empty filter",
      async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
      "Cloud.ru /models returned no native tool-capable LLMs after filtering",
    ],
    [
      "timeout",
      async (_input, init) => {
        await new Promise<void>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("request timed out")), { once: true });
        });
        return new Response(null, { status: 200 });
      },
      "request timed out",
    ],
  ];

  it.each(failureScenarios)("retains stored models after %s refresh failure", async (_name, response, diagnostic) => {
    const failureConfig = readConfig({
      CLOUDRU_BASE_URL: config.baseUrl,
      CLOUDRU_DISCOVERY_TIMEOUT_MS: "5",
      CLOUDRU_MAX_TOKENS: "4096",
    });
    globalThis.fetch = vi.fn(response);
    const provider = createCloudRuProvider(failureConfig);
    const stored = fallbackModels(failureConfig).slice(0, 1);
    const secret = "failure-secret";
    const context = refreshContext({ type: "api_key", key: secret }, { models: stored });
    await expect(provider.refreshModels!(context)).rejects.toThrow(`Cloud.ru model refresh failed: ${diagnostic}`);
    await expect(provider.refreshModels!(context)).rejects.not.toThrow(secret);
    expect(provider.getModels().map((model) => model.id)).toEqual(stored.map((model) => model.id));
    expect(context.publish).toHaveBeenCalled();
  });
});
