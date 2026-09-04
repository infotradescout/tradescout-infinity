# Infinity ecosystem register

Infinity is the canonical register of the Infinity ecosystem: its brands, products, repositories, shared capabilities, owners, boundaries, relationships, evidence, exceptions, and convergence state.

This repository is being realigned from an accumulated shared-runtime project into that register. Existing working code is evidence and a compatibility source; it is not permanent ownership authority.

## Governing rule

The ecosystem is reconstructed from approved intended truth backward. When legacy implementation conflicts with the approved Infinity System Convergence Standard, the governing intent wins through a dependency-aware migration that preserves working value.

## Canonical ownership established in Wave 1

- Continuum owns Screen Pass, camera intelligence, and media recognition.
- Selective Intelligence owns the Selective Intelligence engine and evaluation behavior.
- Infinity owns the ecosystem and capability register.
- Products retain product-specific mutations, business rules, conversion meaning, payments, and payouts.
- Infinity may retain cross-brand attribution and conversion evidence, but evidence never directly triggers money movement.

See [`registry/ecosystem.json`](registry/ecosystem.json), [`registry/capabilities.json`](registry/capabilities.json), and [`docs/REALIGNMENT_WAVE_1.md`](docs/REALIGNMENT_WAVE_1.md).

## Transitional runtime in this repository

The current workspace still contains:

- `packages/contracts`: Screen Pass, attribution, conversion evidence, and a legacy Selective Inheritance evaluator;
- `packages/provider-core`: a provider-neutral media watermark interface;
- `packages/registry`: signed pass and evidence persistence;
- `apps/api`: tenant-authenticated compatibility endpoints;
- `integrations/selective-intelligence`: pinned SI source metadata and drift checks;
- `migrations`: the existing PostgreSQL schema.

These are not all declared canonical Infinity capabilities. Screen Pass/media behavior must converge into Continuum, and the Selective Inheritance evaluator must converge into Selective Intelligence or a thin adapter. Existing endpoints stay available until consumers and data migration are proved.

## Commands

```bash
pnpm install
pnpm check
pnpm build
```

## Safety boundary

Recognition, attribution evidence, conversion evidence, reward evaluation, payment, and product mutation are separate authorization steps. No earlier step may silently execute a later one.
