# Infinity realignment — Wave 1

Status: Draft migration slice  
Authority: Infinity System Convergence Standard, approved by Thomas on 2026-09-04

## Corrected system identity

Infinity is the canonical register of the ecosystem. It records products, repositories, capabilities, owners, boundaries, relationships, evidence, exceptions, and convergence state.

Infinity is not the owner of every shared runtime merely because code accumulated in this repository.

## Decisions applied

| Existing concern | Canonical destination | Wave 1 treatment |
| --- | --- | --- |
| Screen Pass issuance, lookup, revoke, resolve | Continuum | Canonical contracts and reference registry added to Continuum; old endpoints retained temporarily |
| Camera and AI media recognition | Continuum | Ownership recorded; provider and visual proof remain future evidence gates |
| Selective Inheritance evaluator | Selective Intelligence | Legacy copy recorded as migration-required; no destructive removal |
| Cross-brand partner attribution evidence | Infinity register boundary | Retained as transitional runtime; cannot trigger payout |
| Cross-brand conversion evidence | Infinity register boundary | Retained as transitional runtime; product still owns conversion meaning and money decisions |
| Ecosystem/capability register | Infinity | Machine-readable register established in this repository |

## Legacy compatibility surface

The following endpoints still exist in this repository and are explicitly transitional:

- `POST /v1/passes`
- `GET /v1/passes/:publicId`
- `POST /v1/passes/:publicId/revoke`
- `POST /v1/resolve`
- `POST /v1/selective-inheritance/evaluations`

They must not be deleted until consumers, data, authentication, failure behavior, and rollback have been proved. New consumers must integrate with the canonical owner, not deepen the duplicate.

The evidence endpoints remain inside the Infinity boundary for now:

- `POST /v1/attribution-touches`
- `POST /v1/conversion-evidence`

## Next migration gates

1. Inventory every consumer of each transitional endpoint.
2. Define the Continuum production store and authenticated API adapter.
3. Backfill or bridge Screen Pass records without creating two writable truths.
4. Run contract comparison against every known consumer.
5. Route Selective Inheritance evaluation to the pinned Selective Intelligence owner.
6. Prove product mutation and money boundaries.
7. Retire a duplicate only in a separately reviewed change with rollback.

## Proof statement

This wave establishes ownership, a machine-readable ecosystem register, migration boundaries, and a Continuum reference implementation. It does not claim deployment, consumer migration, data migration, visual watermark durability, or duplicate retirement.
