# Infinity Product Contract

## Decision

Infinity is the canonical ecosystem register. Its remaining runtime boundary
holds reusable partner-program, attribution-evidence, conversion-evidence, and
integration contracts used across products.

TradeScout and MealScout keep their product behavior, customer journeys, and
money execution. They integrate through thin adapters rather than maintaining
competing attribution engines.

## Product promise

Every product and shared capability has one visible purpose, owner, boundary,
evidence state, and convergence status.

## Shared attribution model

Infinity standardizes seven objects:

1. `PartnerProgram`: tenant rules, attribution model, eligible conversions, and
   policy reference.
2. `PartnerIdentity`: opaque partner identity with an optional human-readable
   public tag.
3. `PartnerLink`: one partner, target, campaign, and opaque public code.
4. `AttributionTouch`: evidence that a recognized carrier reached a target.
5. `AttributionAssignment`: the partner that won under the program's declared
   rule.
6. `ConversionEvidence`: an idempotent fact that an eligible product action
   occurred.
7. `RewardDecision`: a versioned policy result that still cannot execute
   payment.

## Non-negotiable trust chain

```text
Verified attribution touch
  -> rule-based assignment
  -> idempotent conversion evidence
  -> versioned reward decision
  -> separately authorized payment execution
```

No stage can silently skip the next stage.

## Not in the foundation

- No payout execution.
- No direct modification of TradeScout or MealScout.
- No ownership of Screen Pass, camera intelligence, or media recognition;
  Continuum owns those capabilities.
