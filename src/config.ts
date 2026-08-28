const DEFAULT_BASE_URL = "https://foundation-models.api.cloud.ru/v1";
const DEFAULT_MAX_TOKENS = 16_384;
const DEFAULT_TIMEOUT_MS = 8_000;

function positiveNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface CloudRuConfig {
  baseUrl: string;
  rubPerUsd?: number;
  defaultMaxTokens: number;
  discoveryTimeoutMs: number;
  offline: boolean;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): CloudRuConfig {
  const fx = env.CLOUDRU_RUB_PER_USD ? Number(env.CLOUDRU_RUB_PER_USD) : undefined;

  return {
    baseUrl: (env.CLOUDRU_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    rubPerUsd: fx !== undefined && Number.isFinite(fx) && fx > 0 ? fx : undefined,
    defaultMaxTokens: Math.floor(positiveNumber(env.CLOUDRU_MAX_TOKENS, DEFAULT_MAX_TOKENS)),
    discoveryTimeoutMs: Math.floor(positiveNumber(env.CLOUDRU_DISCOVERY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)),
    offline: /^(1|true|yes)$/i.test(env.OMP_OFFLINE || env.PI_OFFLINE || env.CLOUDRU_OFFLINE || ""),
  };
}
