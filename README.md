# Infinity ecosystem register

Infinity is the canonical register of the Infinity ecosystem: its brands,
products, repositories, shared capabilities, owners, boundaries, relationships,
evidence, exceptions, and convergence state.

This repository is being realigned from an accumulated shared-runtime project
into that register. Existing working code is evidence and a compatibility
source; it is not permanent ownership authority.

## Governing rule

The ecosystem is reconstructed from approved intended truth backward. When
legacy implementation conflicts with the approved Infinity System Convergence
Standard, the governing intent wins through a dependency-aware migration that
preserves working value.

## Canonical ownership established in Wave 1

- Continuum owns Screen Pass, camera intelligence, and media recognition.
- Selective Intelligence owns ecosystem-alignment method, repository
  realignment, and drift prevention.
- Infinity owns the ecosystem and capability register.
- Products retain product-specific mutations, business rules, conversion
  meaning, payments, and payouts.
- Infinity may retain cross-brand attribution and conversion evidence, but
  evidence never directly triggers money movement.

See [`registry/ecosystem.json`](registry/ecosystem.json),
[`registry/capabilities.json`](registry/capabilities.json),
[`registry/convergence.json`](registry/convergence.json),
[`registry/vocabulary.json`](registry/vocabulary.json),
[`registry/identity-boundaries.json`](registry/identity-boundaries.json),
[`docs/REALIGNMENT_WAVE_1.md`](docs/REALIGNMENT_WAVE_1.md), and
[`docs/REALIGNMENT_WAVE_2.md`](docs/REALIGNMENT_WAVE_2.md), and
[`docs/REALIGNMENT_WAVE_3.md`](docs/REALIGNMENT_WAVE_3.md).

## Transitional runtime in this repository

The current workspace contains:

- `packages/contracts`: partner attribution and conversion evidence;
- `packages/registry`: cross-product evidence persistence;
- `apps/api`: tenant-authenticated evidence endpoints;
- `integrations/selective-intelligence`: pinned SI source metadata and drift
  checks;
- `migrations`: the existing PostgreSQL schema.

Screen Pass and its media-provider package have been removed from Infinity after
an ecosystem-wide search found no consumers. Their canonical implementation now
lives in Continuum. The unused central Selective Inheritance evaluator was also
removed: product-specific inheritance stays with each product, while Selective
Intelligence governs ecosystem alignment and drift prevention.

## Commands

```bash
pnpm install
pnpm check
pnpm build
```

## Safety boundary

Attribution evidence, conversion evidence, reward evaluation, payment, and
product mutation are separate authorization steps. No earlier step may silently
execute a later one.
