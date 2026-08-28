import type { CloudRuModel, CloudRuModelsResponse, OmpProviderModel } from "./cloudru-types.ts";
import { buildThinking } from "./reasoning.ts";
import { modelCompat } from "./compat.ts";

export function isNativeToolLlm(model: CloudRuModel): boolean {
  const md = model.metadata;
  return (
    md?.provider === "cloud.ru" &&
    md?.type === "llm" &&
    model.function_calling === true &&
    Array.isArray(md.endpoints) &&
    md.endpoints.some((endpoint) => endpoint.path === "/v1/chat/completions")
  );
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function rubToUsd(value: unknown, rubPerUsd?: number): number {
  if (!rubPerUsd) return 0;
  return numberOrZero(value) / rubPerUsd;
}

function contextWindow(model: CloudRuModel): number {
  const value = model.context_length ?? model.max_model_len;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 128_000;
}

function advertisedOutputLimit(model: CloudRuModel): number | undefined {
  const candidates = [
    model.max_output_tokens,
    model.max_completion_tokens,
    model.max_generated_tokens,
    model.metadata?.max_output_tokens,
    model.metadata?.max_completion_tokens,
    model.metadata?.max_generated_tokens,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  return undefined;
}

function inputModalities(model: CloudRuModel): ("text" | "image")[] {
  const advertised = model.metadata?.input_modalities ?? [];
  return advertised.includes("image") ? ["text", "image"] : ["text"];
}

export interface MapCatalogOptions {
  rubPerUsd?: number;
  defaultMaxTokens: number;
}

export function mapCloudRuModel(model: CloudRuModel, options: MapCatalogOptions): OmpProviderModel {
  const md = model.metadata ?? {};
  const reasoning = model.reasoning === true;
  const thinking = buildThinking(model);
  const compat = modelCompat(model);
  return {
    id: model.id,
    name: md.name || model.id,
    reasoning,
    ...(thinking ? { thinking } : {}),
    input: inputModalities(model),
    cost: {
      input: rubToUsd(md.prompt_tokens_cost, options.rubPerUsd),
      output: rubToUsd(md.generated_tokens_cost, options.rubPerUsd),
      cacheRead: rubToUsd(md.cache_read_tokens_cost, options.rubPerUsd),
      cacheWrite: rubToUsd(md.cache_write_tokens_cost, options.rubPerUsd),
    },
    contextWindow: contextWindow(model),
    maxTokens: Math.min(advertisedOutputLimit(model) ?? options.defaultMaxTokens, contextWindow(model)),
    ...(compat ? { compat } : {}),
  };
}

export function mapCatalog(payload: CloudRuModelsResponse, options: MapCatalogOptions): OmpProviderModel[] {
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("Cloud.ru /models returned an invalid payload: expected { data: [] }");
  }

  return payload.data
    .filter(isNativeToolLlm)
    .map((model) => mapCloudRuModel(model, options))
    .sort((a, b) => a.name.localeCompare(b.name));
}
