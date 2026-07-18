# TradeScout Infinity

TradeScout Infinity is tenant-ready attribution, conversion-proof, and
live-object recovery infrastructure. Screen Pass is its visual recognition
capability.

This repository is contract-first. The current baseline defines the trust
boundaries, shared types, provider interface, threat model, and integration
plans. It does **not** contain a production watermark implementation and makes
no durability claim about screenshots, crops, recompression, or screen
photography.

## Trust chain

```text
Recognition -> Attribution proof -> Conversion evidence -> Business policy -> Payout eligibility
```

No earlier stage can directly trigger a later money decision.

## Workspace

- `packages/contracts`: shared domain types and runtime trust guards.
- `packages/provider-core`: provider-neutral watermark interface.
- `docs`: product doctrine, security boundaries, ADRs, and application adapter
  plans.

## Commands

```bash
pnpm install
pnpm check
pnpm build
```

## Current boundary

This baseline does not modify TradeScout or MealScout. Their adapters must be
implemented in their own repositories only after the shared attribution contract
is accepted.
