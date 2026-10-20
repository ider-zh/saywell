# Saywell sponsored AI deployment

Deployed with explicit owner authorization on **2026-10-20** to the owner's existing **Workers Free** account. The owner subsequently authorized a custom interface domain under their active `9992099.xyz` zone. No Workers Paid subscription, prepaid AI Gateway, database, R2 bucket or user API token was created. Existing `cors` and `tea` Workers were not modified.

- Service: https://saywell.9992099.xyz
- Extension API base: `https://saywell.9992099.xyz/v1`
- Legacy service remains available at `https://saywell-preview-ai.ider001.workers.dev` for previously saved profiles.
- Model: `@cf/qwen/qwen3.8-27b`, fixed on the server.
- Health: `/health`; readiness: `/ready`; safe status: `/v1/status`.
- `POST /v1/coach`: translation/polishing/explanation only, not a general chat/model proxy.
- Cloudflare credentials stay in the operator's Wrangler login; the deployed Worker uses an AI binding. No credential ships in the extension.

## Using the extension

New installations enable the included free services with the welcome page's one permission action. Existing profiles retain their addresses and consent. For a saved Saywell profile using the exact old workers.dev base, Settings shows an address-update notice: **Connect and test** switches to the new address, requests its host permission if needed and renews text consent. The change is not saved or tested if permission is denied. Other providers and custom endpoints are preserved. No key is required. Thinking is off by default; output is capped at 800 tokens.

## Custom domain and DNS

The Worker has one managed Custom Domain: **`saywell.9992099.xyz`**, configured in `cloudflare/wrangler.jsonc`. `workers_dev` stays enabled for compatibility. Cloudflare manages the subdomain's proxied DNS and HTTPS certificate. Only this three-label hostname is attached; the temporary apex binding created before the owner's subdomain clarification was removed, and a public DNS A lookup confirmed no apex answer. Existing DNS records and unrelated Workers were preserved.

Deployment version: `4ff356be-3338-46fc-a171-26979a1902be`. A routing changeset confirmed the final hostname with no conflicts, additions or removals pending. `/health`, `/ready` and `/v1/status` returned HTTPS 200, and a disposable actual MV3 extension completed a fixed synthetic AI connection request with `hasKey: false` and no HTTP errors. This verifies the tested network, not every geographic region.

Run `node scripts/cloudflare-domain.mjs --plan` to inspect the proposed custom-domain routing changes before deployment. It reads local Wrangler OAuth in memory and prints metadata only. DNS-record listing needs permissions not included in the current OAuth; the Worker routing changeset and public DNS checks avoid requesting a broad DNS API token. Custom Domains setup follows [Cloudflare's routing documentation](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Actual disposable MV3 connection test passed with `hasKey: false`. The deployed API returned `Hello, World.`, `This is a test.`, and `你好，世界。` for the three fixed synthetic smoke inputs. Direct model probing with `chat_template_kwargs.enable_thinking=false` returned nine output tokens and no reasoning content. The Worker also sends `reasoning_effort: low` as the model-supported effort setting, with the explicit template thinking switch controlling the default off request. This is observed behavior for the selected model, not a claim that every reasoning model supports off.

## Free usage and errors

[Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) includes **10,000 Neurons per account per day**, shared with other Workers AI activity on the account. This is compute allocation, not 10,000 requests. It resets at 00:00 UTC, **08:00 Asia/Shanghai**. On **Workers Free**, exceeding the allocation fails requests instead of billing an overage. Keep this account on Free while this remains the chosen arrangement; moving the account to Paid changes Cloudflare's overage behavior. This application never upgrades a plan or buys credits.

The [documented error 3036](https://developers.cloudflare.com/workers-ai/platform/errors/) becomes `daily_quota_exhausted` with the next reset instant and Retry-After. The extension shows an English/Chinese alert, preserves MT and suppresses further AI calls until reset. Capacity/rate errors show a short busy message and cooldown. A disabled preview shows a clear switch-to-MT/own-provider message. `/v1/status` reports quota as `unknown` until this Worker observes exhaustion; it does not fabricate an account-wide remaining balance. View actual Neuron usage in the Cloudflare Workers AI dashboard.

## Limits and privacy

Requests accept only a bounded text task: maximum 6,000 UTF-16 units, 32 KiB request body, 0–3 vocabulary items and 100–800 output tokens. Model, arbitrary messages/prompts, tools, images and unknown fields cannot be supplied. The fixed server builds the instructions, validates model JSON and returns plain suggestion data, discarding reasoning. No input text, model answer, IP address or key is logged by application code; safe failure logs contain only a random request ID and error code. Workers observability is disabled in the deployment config. Cloudflare still processes the input and has its own infrastructure/data policies; consent is required in the extension.

This is an **anonymous prerelease service**, not an authenticated user system. The non-secret client header and CORS are not authentication. Requests with no Origin, well-formed Chrome/Edge extension origins, or operator-listed origins are accepted; ordinary website origins are rejected, and wildcard CORS/credentialed cookies are not enabled. Anyone able to call this public endpoint can potentially consume free capacity. Native rate limit bindings allow 10 requests/minute per hashed connecting IP and 30 requests/minute per service key, **per Cloudflare location and approximately**, not a strict global daily budget. Shared networks may share the per-IP limit. The account's Free-plan AI ceiling is the global no-overage boundary. Revisit access control/budgeting when real usage grows, as requested; no login or paid infrastructure is added for the pilot.

## Operator commands

From the repository root:

```powershell
npm ci
npx wrangler login
npm run worker:check
npm run worker:deploy
```

Wrangler 4.151.2 is pinned as a development tool. Its OAuth credential is local to the operator's profile, outside this repository. No secret paste is needed. The Free plan applies its default CPU limit; setting custom `limits.cpu_ms` is rejected on Free and is deliberately omitted. Optional native rate limiter bindings need no separate database provisioning.

`npm run worker:dev` starts the local HTTP worker. Calling its AI binding still uses remote Workers AI allocation; automated tests use mocked bindings and localhost servers instead. `/health` and `/ready` make no inference call. `node scripts/probe-hosted-ai.mjs` and `node scripts/probe-hosted-extension.mjs` are explicit live smoke tests using only fixed synthetic phrases; they consume a small amount of free allocation. Never run a live probe against personal input.

## Continue through launch or end the pilot

`PREVIEW_ENABLED` is currently `"true"`; `PREVIEW_UNTIL` is empty. **No automatic expiry is scheduled**, so the service keeps using the daily free allocation until the owner decides otherwise. No calendar cutoff was invented.

When release or increased real usage calls for a new arrangement, set `vars.PREVIEW_ENABLED` to `"false"` in `cloudflare/wrangler.jsonc`, then run `npm run worker:deploy`. Keeping the flag in the file prevents a later deployment from accidentally re-enabling it. `/health` will report `enabled: false` and inference will stop before the AI binding is called. Alternatively set `PREVIEW_UNTIL` to an explicit ISO UTC instant and redeploy. The extension displays the pilot-ended notice and MT remains usable. A future scheme can replace this public endpoint/profile without bundling Cloudflare account credentials.
