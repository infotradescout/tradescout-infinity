# TradeScout Infinity

TradeScout Infinity is tenant-ready attribution, conversion-proof, and
live-object recovery infrastructure. Screen Pass is its visual recognition
capability.

This repository contains the shared contracts, signed registry service,
PostgreSQL persistence schema, and tenant-authenticated HTTP API. It does
**not** contain a production watermark implementation and makes no durability
claim about screenshots, crops, recompression, or screen photography.

## Trust chain

```text
Recognition -> Attribution proof -> Conversion evidence -> Business policy -> Payout eligibility
```

No earlier stage can directly trigger a later money decision.

## Workspace

- `packages/contracts`: shared domain types and runtime trust guards.
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

TradeScout and MealScout integrate through thin adapters. During shadow rollout,
their current attribution and payout behavior remains authoritative while
Infinity records compatible evidence for comparison.
