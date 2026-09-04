# Infinity realignment — Wave 1

Status: Draft migration slice  
Authority: Infinity System Convergence Standard, approved by Thomas on
2026-09-04

## Corrected system identity

Infinity is the canonical register of the ecosystem. It records products,
repositories, capabilities, owners, boundaries, relationships, evidence,
exceptions, and convergence state.

Infinity is not the owner of every shared runtime merely because code
accumulated in this repository.

## Decisions applied

| Existing concern                              | Canonical destination                                      | Wave 1 treatment                                                                            |
| --------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Screen Pass issuance, lookup, revoke, resolve | Continuum                                                  | Moved to Continuum; unused Infinity implementation removed                                  |
| Camera and AI media recognition               | Continuum                                                  | Ownership recorded; provider and visual proof remain future evidence gates                  |
| Central Selective Inheritance evaluator       | Product-owned behavior + Selective Intelligence governance | Unused Infinity endpoint and duplicate contract removed                                     |
| Cross-brand partner attribution evidence      | Infinity register boundary                                 | Retained as transitional runtime; cannot trigger payout                                     |
| Cross-brand conversion evidence               | Infinity register boundary                                 | Retained as transitional runtime; product still owns conversion meaning and money decisions |
| Ecosystem/capability register                 | Infinity                                                   | Machine-readable register established in this repository                                    |

## Consumer evidence

An organization-wide code search found no callers of the four Screen Pass API
routes. The Infinity routes, store, schema, signing code, provider package, and
tests were therefore removed instead of preserved as a false compatibility
layer. New Screen Pass work belongs in Continuum.

The same search found only dormant product shadow adapters and tests for the
central Selective Inheritance endpoint. Infinity's unused endpoint and evaluator
were removed. Product-owned inheritance behavior remains untouched.

The evidence endpoints remain inside the Infinity boundary for now:

- `POST /v1/attribution-touches`
- `POST /v1/conversion-evidence`

## Next migration gates

1. Remove the dormant Infinity Selective Inheritance calls from product shadow
   adapters.
2. Prove product mutation and money boundaries.
3. Continue repository classification and shared-capability ownership.

## Proof statement

This wave establishes ownership, a machine-readable ecosystem register, and a
Continuum Screen Pass reference implementation. It removes the unused Infinity
duplicate. It does not claim deployment or visual watermark durability.
