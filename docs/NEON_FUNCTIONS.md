# Optional Neon Functions transport

`apps/api/src/neon.ts` exports `{ fetch(Request): Promise<Response> }` for
Neon's Node.js 24 runtime. `apps/api/src/main.ts` remains the standalone Node
server. Both use the single route handler in `server.ts` and the same Postgres
registry, signing-key ring, and API-key authenticator from `runtime.ts`. No SI
Python runtime is bundled or reimplemented here.

## Access and durable state

The function URL is public. Protected routes require the existing
`Authorization: Bearer inf_...` credential. Each request queries the canonical
API-key/tenant join, including active statuses and key expiration; credentials
and tenant identities are not cached across requests. Keep tenant API keys on
product servers, never in public browser bundles or query strings.

`GET /health` and `POST /v1/resolve` preserve their existing public policy.
Resolution requires a valid signed visual payload to return authoritative
actions. A function URL or recognition result never confers payout authority.
Conversion evidence remains non-payable and idempotent.

Neon injects the branch's **pooled** `DATABASE_URL`. Each isolate constructs one
`pg` pool with `max: 5` and registers `attachDatabasePool` for idle disconnects.
Passes, revocations, attribution touches, and conversion evidence use the
existing Postgres schema, so their state and idempotency are shared across
isolates and restarts. The deployment must use the same signing-key ring across
isolates and retain older `verify_only` keys during rotation. No local memory
store or filesystem is used for business state.

The one-million-byte JSON body limit, HTTP statuses, error codes, `no-store`,
`nosniff`, and `Retry-After` behavior come from the shared route handler. The
Fetch adapter consumes body streams incrementally and cancels oversized input.

The existing rate limiter is **process/isolate-local**, not a durable quota. The
native server keys its 120 requests/minute/path limit by the socket peer. Fetch
supplies no verified peer address, so all function callers share one 120
requests/minute/path bucket per isolate. Caller-supplied `Forwarded`,
`X-Forwarded-For`, and `X-Real-IP` headers cannot select a new bucket. Scaling
or restarting isolates resets those buckets. Before public production traffic,
configure and verify trusted ingress/distributed abuse controls that cannot be
bypassed through the public invocation URL; do not treat this local limiter as
an account-wide quota. CORS policy is unchanged: use a server-side product
adapter, or separately review a browser access policy.

## Build and invoke

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
node --test apps/api/test/fetch.test.mjs apps/api/test/auth.query.test.mjs
```

Build before `neon dev` or deploying: the API's workspace dependencies resolve
their compiled `dist` exports. Root `neon.ts` declares only the `infinity`
function, using the current top-level `functions` config (`@neon/config`
1.6.0+), without enabling additional services. Its slug is permanent after the
first deployment. The config refuses evaluation without
`INFINITY_SIGNING_KEYS_JSON`; the runtime also fails closed without that value
or `DATABASE_URL`.

For an authorized target branch already linked in `.neon`, with the signing ring
supplied by the deployment secret manager:

```sh
neon config plan
neon dev
# After reviewing the exact branch and plan and authorizing deployment:
neon deploy
neon functions get infinity
```

Do not override `DATABASE_URL` in deployment environment values: let Neon inject
the selected branch's pooled URL. Apply `migrations/0001_infinity_registry.sql`
separately with a direct connection and `ON_ERROR_STOP`; neither import nor
deployment runs migrations or seeds keys. Create the intended tenant and SHA-256
API-key record through the existing administrative process. Use the returned
`invocation_url` as the API origin:

```sh
curl "$INFINITY_BASE_URL/health"
curl "$INFINITY_BASE_URL/v1/passes/$PUBLIC_PASS_ID" \
  -H "Authorization: Bearer $INFINITY_API_KEY"
curl "$INFINITY_BASE_URL/v1/resolve" \
  -H 'Content-Type: application/json' \
  --data-binary @signed-visual-payload-request.json
```

## Remaining live prerequisites

No Neon project, branch, function, secret, schema, or routing was provisioned by
this change. A live rollout still needs the exact authorized Neon account and
branch, an enabled Postgres database and applied schema, the persistent signing
ring, tenant/API-key enrollment, the ingress controls above, and a reviewed
deployment followed by live authentication, tenant isolation, revocation,
concurrent idempotency, and cold-isolate recovery checks. Local native Postgres
and Fetch tests do not establish a Neon deployment or hosted recovery.

Official documentation checked on 2026-09-17 lists Functions in `aws-us-east-2`,
`aws-us-east-1`, `aws-eu-central-1`, and `aws-ap-southeast-1`. Confirm the
selected target and current pricing before rollout; the older
single-region/free-beta assumption is not a deployment precondition.

Sources: [Functions overview](https://neon.com/docs/compute/functions/overview),
[Node.js/pool setup](https://neon.com/docs/compute/functions/get-started),
[configuration](https://neon.com/docs/reference/neon-ts),
[authentication](https://neon.com/docs/compute/functions/authentication),
[environment variables](https://neon.com/docs/compute/functions/environment-variables),
[runtime limits](https://neon.com/docs/compute/functions/reference/runtime-limits).
