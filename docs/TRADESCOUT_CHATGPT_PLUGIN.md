# TradeScout ChatGPT plugin

## Boundary

The plugin operates an authenticated owner's existing TradeScout Business
Profile and Business Hub. It does not create another Scout chatbot or duplicate
TradeScout's canonical business model.

Infinity owns MCP orchestration, signed proposals, evidence contracts,
idempotency and receipts. A production `TradeScoutOwnerAdapter` must resolve
OAuth subject membership server-side and call TradeScout's canonical services.
Caller-supplied `business_id` is never authorization.

## First slice

- `list_my_businesses`
- `get_business_hub`
- compact freeform and multi-file metadata intake
- `change_set.prepare`
- Business Profile, service and PDF action contracts
- `change_set.publish` with signed proposals, scope checks, optimistic version
  checks and idempotent receipts

The review UI, persistent draft/outbox records, PDF renderer and production
TradeScout adapter remain deployment work. Social providers follow only after
the internal workflow is proven.

## OAuth requirements

Production uses authorization code with PKCE. Publish protected-resource
metadata and authorization-server metadata on the TradeScout-owned HTTPS origin.
Validate token signature, issuer, audience, expiry and scopes on every call.
Resolve tenant, subject, membership and role from server-side records.

Initial scope is `business.read`. Request `profile.write`, `services.write` and
`documents.write` only when the owner invokes those actions.

The API exposes the MCP transport at `POST /mcp` and protected-resource metadata
at `GET /.well-known/oauth-protected-resource` when `createInfinityServer`
receives a TradeScout plugin configuration. The production composition root must
provide an `OwnerTokenAuthenticator` that performs JWT/OAuth validation and a
`TradeScoutOwnerAdapter` backed by the canonical TradeScout platform. The server
intentionally returns `plugin_not_configured` until those real dependencies are
supplied.

Provider refresh tokens remain encrypted in TradeScout and never appear in MCP
tool results or review UI payloads.

## Evidence/currentness

Owner statements are selected. Uploaded files are selected only when
unambiguous, non-conflicting and current. Public sources are suggested with URL,
publisher and observation date. Model inferences are unselected.

Schedules, availability, prices, licenses and insurance require `effectiveAt`,
`observedAt` and, where applicable, `expiresAt`. The analyzer must warn instead
of silently promoting stale time-sensitive evidence.

## Publish transaction

The production adapter must atomically write selected TradeScout revisions and
outbox jobs. Workers deliver external actions and record provider IDs, URLs,
payload hashes and explicit completed/partial/failed status. Internal revisions
are reversible; social cleanup is best-effort and cannot undo public exposure.
