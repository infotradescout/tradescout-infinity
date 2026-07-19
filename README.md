# TradeScout Infinity

TradeScout Infinity is tenant-ready attribution, conversion-proof, selective
inheritance, and live-object recovery infrastructure. Screen Pass is its visual
recognition capability.

This repository contains the shared contracts, signed registry service,
PostgreSQL persistence schema, and tenant-authenticated HTTP API. It does
**not** contain a production watermark implementation and makes no durability
claim about screenshots, crops, recompression, or screen photography.

## Trust chains

```text
Recognition -> Attribution proof -> Conversion evidence -> Business policy -> Payout eligibility
Recognition/source evidence -> Selective Inheritance policy -> Preview -> Product-authorized apply
```

No earlier stage can directly trigger a later money decision or product
mutation.

## Workspace

- `packages/contracts`: shared domain types, Selective Inheritance evaluator,
  and runtime trust guards.
- `packages/provider-core`: provider-neutral watermark interface.
- `packages/registry`: signed pass issuance, verification, revocation, and
  conversion-evidence persistence.
- `apps/api`: tenant-authenticated registry HTTP API.
- `migrations`: deployable PostgreSQL schema.
- `docs`: product doctrine, security boundaries, ADRs, and application adapter
  plans.

## Commands

```bash
pnpm install
pnpm check
pnpm build
```

## Current boundary

Infinity owns the portable Screen Pass and Selective Inheritance contracts.
TradeScout and MealScout integrate through thin adapters and retain the
separately authorized product operation that applies inherited values. During
shadow rollout, their current attribution, payout, and profile mutation behavior
remains authoritative while Infinity records compatible evidence and
evaluations for comparison.
