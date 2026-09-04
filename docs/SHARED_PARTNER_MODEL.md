# Shared Partner Model

## Decision

TradeScout and MealScout will not share one hardcoded commission percentage.
They will share one partner-attribution model with tenant-specific, versioned
program policies.

## Canonical data flow

```text
PartnerProgram
  -> PartnerIdentity
  -> PartnerLink
  -> AttributionTouch
  -> AttributionAssignment
  -> ConversionEvidence
  -> RewardDecision
  -> product-owned wallet/payment execution
```

## Legacy-to-shared mapping

| Legacy concept                                                     | Infinity object                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| TradeScout affiliate account / MealScout affiliate user            | `PartnerIdentity`                                                 |
| TradeScout share link / MealScout affiliate link                   | `PartnerLink`                                                     |
| `?ref=`, `/r`, `/ref`, clean path tag, cookie, session, owner view | `AttributionCarrier` on `AttributionTouch`                        |
| TradeScout `referredByAffiliateAccountId`                          | locked `AttributionAssignment`                                    |
| MealScout closer/booker columns                                    | one or more explicit program assignments                          |
| click/referral row                                                 | `AttributionTouch` or assignment transition, depending on meaning |
| TradeScout conversion ledger                                       | `ConversionEvidence`                                              |
| MealScout signup/payment/booking event                             | `ConversionEvidence` before policy evaluation                     |
| commission percentage logic                                        | tenant `rewardPolicyReference` and versioned evaluator            |
| wallet, credits, withdrawals, payouts                              | product-owned payment subsystem                                   |
| Approved external source evidence                                  | opaque evidence reference on the touch                            |

## Program split

Recommended initial programs:

| Tenant     | Program                 | Assignment rule            | Eligible conversions                                   |
| ---------- | ----------------------- | -------------------------- | ------------------------------------------------------ |
| TradeScout | member sharing          | explicit approval required | signup, claim, request, profile contact, booking start |
| TradeScout | profile-owner discovery | explicit approval required | approved clean-owner profile conversions               |
| MealScout  | business acquisition    | explicit approval required | restaurant/truck/host signup and subscription payment  |
| MealScout  | booking partner         | explicit approval required | host/truck booking-fee events                          |

The table identifies separation boundaries, not approved commercial terms.

## Canonical external link contract

Infinity stores one opaque `publicCode` per partner/target/campaign record. Each
tenant adapter chooses its public presentation:

- TradeScout may use a short redirect or query carrier.
- MealScout may use its clean path-segment carrier.
- Continuum may supply an opaque Screen Pass evidence reference.

All resolve to the same registry object and evidence model. Presentation does
not change assignment rules.

## Money boundary

Reward policies are versioned and tenant-owned. A reward decision may report
eligibility and a calculated amount, but must set `paymentTriggered=false`.
Existing wallet, credit, withdrawal, and payout systems remain in their product
until separately reconciled and authorized.
