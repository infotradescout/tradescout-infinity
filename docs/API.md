# Registry API

The API is a tenant-isolated trust service. Product adapters authenticate with
an API key; the public resolver accepts a signed visual payload and returns only
registry-authorized actions.

## Runtime configuration

- `DATABASE_URL`: PostgreSQL connection string.
- `INFINITY_SIGNING_KEYS_JSON`: JSON array of signing keys. Exactly one key must
  have `status: "active"`; older keys can remain `verify-only` during rotation.
- `PORT`: optional, defaults to `8080`.

Each signing secret must contain at least 32 characters. Store secrets in the
deployment secret manager, never in source control.

```json
[
  {
    "version": 2,
    "secret": "replace-with-a-secret-manager-value",
    "status": "active"
  },
  {
    "version": 1,
    "secret": "previous-secret-during-rotation",
    "status": "verify-only"
  }
]
```

Apply `migrations/0001_infinity_registry.sql` before starting the API. Seed a
tenant and API key out of band. The stored API-key hash is lowercase SHA-256 hex
of the full bearer token; only tokens beginning with `inf_` are accepted.

## Endpoints

- `GET /health`: liveness response.
- `POST /v1/passes`: issue a signed pass. Requires bearer authentication.
- `GET /v1/passes/:publicId`: tenant-scoped pass lookup. Requires
  authentication.
- `POST /v1/passes/:publicId/revoke`: revoke a pass. Requires authentication.
- `POST /v1/resolve`: verify and resolve a visual payload. Public, rate-limited.
- `POST /v1/conversion-evidence`: record evidence using `Idempotency-Key`.
  Requires authentication.

Resolution fails closed on unknown, modified, expired, revoked, or cross-tenant
payloads. Returned actions are exact allowlisted paths stored at issuance;
admin, staff, API, protocol-relative, and external destinations are rejected.

Conversion evidence is deliberately non-payable. The response always keeps
`payoutTriggered` false. Reward policy and payment authorization remain separate
downstream decisions.
