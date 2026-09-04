# Infinity realignment — Wave 3

Status: Draft vocabulary and identity-boundary evidence  
Authority: Infinity System Convergence Standard, approved by Thomas on
2026-09-04

## Outcome

Infinity now has a shared vocabulary conflict register and an identity-boundary
inventory based on the inspected TradeScout and MealScout schemas. This wave
does not merge databases or move authentication. It prevents those changes from
being attempted against ambiguous terms.

## Material findings

| Concept      | Current conflict                                                                 | Target boundary                                                            |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Person       | Both `users` models combine human, login, role, profile, and commercial state    | Human subject independent of account, product, role, business, and profile |
| Account      | Product-local credentials are stored beside person and business state            | Authentication and security boundary only                                  |
| Business     | TradeScout has businesses; MealScout splits restaurants, suppliers, and hosts    | Organization identity with product-specific capabilities                   |
| Profile      | TradeScout has two profile meanings; MealScout mixes settings and typed profiles | Presentation that references a subject and product context                 |
| Role         | Product role, business type, occupation, staff, and admin authority overlap      | Scoped assignment; never a human or business type                          |
| Verification | Generic booleans coexist with claim-specific records and approvals               | Evidence-backed decision about one subject and claim                       |

The full classification, including request, connection, job, project, property,
asset, estimate, and payment, is machine-readable in `registry/vocabulary.json`.

## Identity boundary

No canonical human-identity owner has been selected. That is deliberate, not a
pause in the work: choosing TradeScout, MealScout, or Infinity now would promote
one accumulated model before its consumers, permissions, recovery behavior, and
consent boundaries are reconciled.

`registry/identity-boundaries.json` therefore locks the invariants and records
the evidence needed to choose safely. Infinity itself remains the ecosystem
register and tenant API-key boundary; it does not become the human identity
runtime merely because it holds this inventory.

MealScout draft PR [\#371](https://github.com/infotradescout/MealScout/pull/371)
now reduces that product to one active authentication owner, removes its dormant
TradeScout SSO endpoint and silent email-based cross-product linking, and
preserves the remaining database link field as migration evidence. Fourteen
focused auth and boundary contracts, typechecking, linting, and both production
builds passed. This is product-local convergence evidence, not an ecosystem
identity-owner selection.

## Highest-risk evidence

- MealScout links a local user to a TradeScout ID without an inspected
  link/unlink/collision contract.
- Role and privileged authority are spread across overlapping fields in both
  products.
- MealScout declares provider access-token columns on the user row; their real
  storage protection and active consumers still require proof.
- Verification flags can only converge after each protected action identifies
  the exact claim and authority it needs.

## Next gates

1. Trace real sign-in, session, callback, recovery, and logout paths in both
   products.
2. Build the product and business membership/permission matrix from actual
   mutation guards.
3. Prove cross-product link, unlink, collision, deletion, and audit behavior.
4. Select one identity owner only after those boundaries are demonstrated.
5. Add adapters and reconciliation before any live account or permission
   migration.

This is a draft target and conflict map, not a claim that the vocabulary has
been approved or the data has already converged.
