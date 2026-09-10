import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import type { AuthContext, Credential, Model, Provider, RefreshModelsContext } from "@earendil-works/pi-ai";
import { readConfig } from "./config.ts";
import { discoverModels, resolveCloudRuCredential, storedProviderModels } from "./discovery.ts";
import { fallbackModels } from "./fallback.ts";

const PROVIDER_ID = "cloudru";
type CloudRuProviderModels = Model<"openai-completions">[];

function refreshDiagnostic(error: unknown, secret?: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = secret ? message.replaceAll(secret, "[redacted]") : message;
  return new Error(`Cloud.ru model refresh failed: ${safeMessage}`);
}

async function resolveAuthCredential(
  ctx: AuthContext,
  credential: Credential | undefined,
  signal: AbortSignal,
): Promise<string | undefined> {
  signal.throwIfAborted();
  if (credential?.type === "oauth") return undefined;
  if (credential !== undefined) return resolveCloudRuCredential(credential, {});

  const ambient = await ctx.env("CLOUDRU_API_KEY");
  signal.throwIfAborted();
  return ambient ? resolveCloudRuCredential(undefined, { CLOUDRU_API_KEY: ambient }) : undefined;
}

function cloudRuAuth() {
  return {
    apiKey: {
      name: "Cloud.ru API key",
      async resolve({ ctx, credential, signal }: { ctx: AuthContext; credential?: Credential; signal: AbortSignal }) {
        const key = await resolveAuthCredential(ctx, credential, signal);
        return key
          ? { auth: { apiKey: key }, source: credential ? "stored credential" : "CLOUDRU_API_KEY" }
          : undefined;
      },
    },
  } satisfies NonNullable<Provider<"openai-completions">["auth"]>;
}

export function createCloudRuProvider(config = readConfig()): Provider<"openai-completions"> {
  const streams = openAICompletionsApi();
  let models: CloudRuProviderModels = fallbackModels(config);

  return {
    id: PROVIDER_ID,
    name: "Cloud.ru",
    baseUrl: config.baseUrl,
    auth: cloudRuAuth(),
    getModels: () => models,
    async refreshModels(context: RefreshModelsContext): Promise<void> {
      const stored = storedProviderModels(context, config);
      if (stored.length > 0) {
        await context.publish({
          update: () => {
            models = stored;
          },
        });
      }

      if (!context.allowNetwork || config.offline) return;

      let key: string | undefined;
      try {
        context.signal.throwIfAborted();
        key = resolveCloudRuCredential(context.credential, context.credential === undefined ? process.env : {});
        if (!key) return;
        const refreshed = await discoverModels(config, key, context.signal);
        await context.publish({
          persist: { models: refreshed, checkedAt: Date.now() },
          update: () => {
            models = refreshed;
          },
        });
      } catch (error) {
        throw refreshDiagnostic(error, key);
      }
    },
    stream: streams.stream,
    streamSimple: streams.streamSimple,
  };
}

export function createCloudRuProviderFromEnvironment(): Provider<"openai-completions"> {
  return createCloudRuProvider(readConfig());
}
