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

MealScout draft PR [\#372](https://github.com/infotradescout/MealScout/pull/372)
now makes provider subject the social-login proof, blocks email-only linking and
identity collisions before writes, rejects the dormant cross-product OAuth
context, and stops persisting new provider access tokens on user rows.
Repository search found no runtime consumer for those login tokens. Seven
policy/message tests, twelve focused contracts, typechecking, linting, and both
production builds passed. Existing token values, authenticated linking,
recovery, and schema retirement remain explicit migration gates.

TradeScout draft PR
[\#570](https://github.com/infotradescout/tradescoutAI/pull/570) now makes its
existing request-authority spine the product-local owner for authentication,
admin, and super-admin route guards. It retires four independent guard paths and
fixes a privilege-promotion defect where a generic admin flag could satisfy a
super-admin gate. Twenty-six focused tests, 123 broader authority tests, the
authority audit, linting, and the server build passed. OAuth provider ownership
and email-based account association were the next gates from that draft.

TradeScout draft PR
[\#571](https://github.com/infotradescout/tradescoutAI/pull/571) now puts Local,
Google, and Facebook strategies behind that same product-local auth owner. It
uses provider subjects as login proof, treats email as collision evidence, and
stops before any account write when authenticated linking or collision review is
required. Failed callbacks return to the canonical auth surface with an explicit
explanation. Twenty-seven focused tests, the authority audit, and the server
build passed; one database-dependent test was skipped. Authenticated linking,
unlinking, recovery, duplicate-row reconciliation, schema constraints, and live
provider callbacks remain unproved gates.

## Highest-risk evidence

- MealScout links a local user to a TradeScout ID without an inspected
  link/unlink/collision contract.
- Role and privileged authority are spread across overlapping fields in both
  products.
- MealScout retains provider access-token columns as stored-data evidence. New
  writes are blocked, but existing values require measurement and an auditable
  retirement migration.
- Verification flags can only converge after each protected action identifies
  the exact claim and authority it needs.

## Next gates

1. Finish the sign-in, session, callback, recovery, and logout traces in both
   products; TradeScout provider registration and collision behavior are now
   draft-mapped.
2. Build the product and business membership/permission matrix from actual
   mutation guards.
3. Prove cross-product link, unlink, collision, deletion, and audit behavior.
4. Select one identity owner only after those boundaries are demonstrated.
5. Add adapters and reconciliation before any live account or permission
   migration.

This is a draft target and conflict map, not a claim that the vocabulary has
been approved or the data has already converged.
