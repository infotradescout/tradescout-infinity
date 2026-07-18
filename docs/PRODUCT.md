# TradeScout Infinity Product Contract

## Decision

TradeScout Infinity owns the reusable partner-program, affiliate-attribution,
Screen Pass registry, recognition, conversion-evidence, and integration
contracts used by TradeScout, MealScout, and future tenants.

TradeScout and MealScout keep their product behavior, customer journeys, and
money execution. They integrate through thin adapters rather than maintaining
competing attribution engines.

## Product promise

Screenshots and exported content can remain connected to the source object,
current truth, original credit, and next safe action.

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

Screen Pass adds a new carrier to that model. It does not create a second
affiliate system.

## Non-negotiable trust chain

```text
Carrier recognition
  -> verified attribution touch
  -> rule-based assignment
  -> idempotent conversion evidence
  -> versioned reward decision
  -> separately authorized payment execution
```

No stage can silently skip the next stage.

## Not in the foundation

- No proprietary production watermark algorithm.
- No claim that a hidden mark survives screenshots or screen photography.
- No payout execution.
- No raw user, affiliate, email, customer, or private-object identifiers in
  visual payloads.
- No direct modification of TradeScout or MealScout.
