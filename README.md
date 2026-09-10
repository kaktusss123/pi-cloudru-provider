# pi-cloudru-provider

Native Cloud.ru Foundation Models provider for **Pi**, with minimum supported host version `0.85.1`.

The package provides:

- Pi-native OpenAI Chat Completions streaming and tool calls;
- exact case-sensitive Cloud.ru model IDs, including `moonshotai/Kimi-K2.6`;
- a bundled fallback catalog for startup without network access;
- dynamic `/models` refresh through Pi's `refreshModels(context)`;
- Pi credential resolution plus `CLOUDRU_API_KEY` fallback without direct auth-file access;
- native Pi reasoning metadata for Kimi, GLM, MiniMax, Qwen, GPT-OSS, and DeepSeek.

The OMP implementation is maintained separately in [`omp-cloudru-provider`](https://github.com/kaktusss123/omp-cloudru-provider). This package has no OMP manifest or OMP runtime dependency.

## Install

```bash
pi install git:github.com/kaktusss123/pi-cloudru-provider
```

For a one-run test:

```bash
pi -e git:github.com/kaktusss123/pi-cloudru-provider
```

## Authentication

Configure the Cloud.ru API key through Pi's standard provider auth or the environment:

```bash
export CLOUDRU_API_KEY='...'
```

The native provider uses `$CLOUDRU_API_KEY` semantics. It never sends the literal string `CLOUDRU_API_KEY` as a bearer token. OAuth credentials are not treated as Cloud.ru API keys.

## Configuration

```bash
export CLOUDRU_BASE_URL='https://foundation-models.api.cloud.ru/v1'
export CLOUDRU_RUB_PER_USD='80'
export CLOUDRU_MAX_TOKENS='16384'
export CLOUDRU_DISCOVERY_TIMEOUT_MS='8000'
export CLOUDRU_OFFLINE='1'
```

`CLOUDRU_RUB_PER_USD` is optional. Without it, Cloud.ru prices remain zero instead of being mislabeled as USD.

## Catalog filtering

Only `/models` entries satisfying all of the following are registered:

- `metadata.provider === "cloud.ru"`;
- `metadata.type === "llm"`;
- `function_calling === true`;
- `metadata.endpoints` contains `/v1/chat/completions`.

Live discovery replaces the fallback catalog only after a successful refresh. Invalid responses, empty filtered results, network failures, timeouts, missing credentials, and aborted refreshes never replace the last usable catalog.

## Reasoning profiles

- Kimi and GLM use `thinking.type`: `off -> disabled`, `high -> enabled`.
- MiniMax M3 uses `disabled`, `adaptive`, and `enabled`.
- MiniMax M2.5 and Qwen always-on profiles hide `off` without inventing effort values.
- Qwen 3.5/3.6 uses `chat_template_kwargs.enable_thinking` and `preserve_thinking`.
- GPT-OSS exposes only `low`, `medium`, and `high` `reasoning_effort`.
- DeepSeek exposes only `high` and `max` and replays `reasoning_content`.
- Unknown reasoning models stay reasoning-capable without guessed provider-specific controls.

The provider does not implement its own retry or compaction behavior.
