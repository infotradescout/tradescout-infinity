# Registry API

The API is a tenant-isolated evidence service. Product adapters authenticate
with an API key to record attribution touches and conversion evidence.

## Runtime configuration

- `DATABASE_URL`: PostgreSQL connection string.
- `PORT`: optional, defaults to `8080`.

Apply `migrations/0001_infinity_registry.sql` before starting the API. Seed a
tenant and API key out of band. The stored API-key hash is lowercase SHA-256 hex
of the full bearer token; only tokens beginning with `inf_` are accepted.

## Endpoints

- `GET /health`: liveness response.
- `POST /v1/attribution-touches`: record a non-payable, unverified shadow touch.
  Requires bearer authentication.
- `POST /v1/conversion-evidence`: record evidence using `Idempotency-Key`.
  Requires authentication.

Conversion evidence is deliberately non-payable. The response always keeps
`payoutTriggered` false. Reward policy and payment authorization remain separate
downstream decisions.

Screen Pass endpoints are not part of this API. Continuum owns that capability.
