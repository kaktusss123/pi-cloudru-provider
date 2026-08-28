# pi-cloudru-provider

Production Cloud.ru Foundation Models provider for **Oh My Pi (OMP)**.

## What it does

- Dynamically discovers models from `https://foundation-models.api.cloud.ru/v1/models`.
- Keeps only native Cloud.ru tool-capable chat LLMs:
  - `metadata.provider === "cloud.ru"`
  - `metadata.type === "llm"`
  - `function_calling === true`
  - `/v1/chat/completions` endpoint present
- Maps model name, context window, text/image modalities, reasoning capabilities, and token prices into OMP.
- Uses OMP-native `fetchDynamicModels`, so discovery and inference use the **same resolved credential**.
- Includes a bundled fallback catalog for offline/startup resilience.
- Uses OMP-native reasoning metadata. MiniMax M3 exposes only `low -> adaptive`, `high -> enabled`, plus OMP's separate `off -> disabled` state.

## Authentication

Set the raw Cloud.ru API token (do **not** include the `Bearer ` prefix):

```bash
export CLOUDRU_API_KEY='...'
```

The provider registration intentionally uses:

```ts
apiKey: "CLOUDRU_API_KEY"
```

OMP interprets this as an environment-variable **name**. Do not change it to `$CLOUDRU_API_KEY`; OMP treats that legacy Pi syntax as a literal token.

From the private git repository — requires only SSH access to GitHub:

```bash
omp plugin install git@github.com:kaktusss123/pi-cloudru-provider.git
```

`omp install` is an alias for the same command. To pin a specific ref, use the shorthand form: `omp plugin install github:kaktusss123/pi-cloudru-provider#<branch|tag>`.

Alternative — from the package tarball:

```bash
omp plugin install /path/to/pi-cloudru-provider-1.0.3.tgz
```

Then fully restart `omp`.

To refresh model discovery explicitly:

```bash
omp models refresh cloudru
```

## Optional settings

```bash
# Override endpoint
export CLOUDRU_BASE_URL='https://foundation-models.api.cloud.ru/v1'

# Convert Cloud.ru RUB / 1M token prices to the USD unit expected by OMP.
# Without this, OMP cost fields stay zero rather than mislabel RUB as USD.
export CLOUDRU_RUB_PER_USD='80'

# Used only when /models does not advertise a real output-token limit.
export CLOUDRU_MAX_TOKENS='16384'

# Discovery HTTP timeout.
export CLOUDRU_DISCOVERY_TIMEOUT_MS='8000'

# Disable network discovery and use the bundled fallback catalog.
export CLOUDRU_OFFLINE='1'
```

## Troubleshooting 403 Invalid authorization header format

Verify the installed provider contains:

```ts
apiKey: "CLOUDRU_API_KEY"
```

and **not**:

```ts
apiKey: "$CLOUDRU_API_KEY"
```

Safe shell check (does not print the secret):

```bash
test -n "$CLOUDRU_API_KEY" \
  && echo "CLOUDRU_API_KEY set (${#CLOUDRU_API_KEY} chars)" \
  || echo "CLOUDRU_API_KEY missing"
```
