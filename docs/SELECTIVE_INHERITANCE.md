# Selective Inheritance Contract

Selective Inheritance is an Infinity capability for carrying forward only
allowlisted, sufficiently trustworthy fields from existing product records,
public sources, verified credentials, and current Screen Pass objects.

It is not a bulk-copy feature. The default is exclusion.

## Ownership boundary

Infinity owns:

- the portable policy and evidence vocabulary;
- deterministic field-level evaluation;
- source priority, confidence, verification, and freshness decisions;
- provenance and evidence digests;
- the connection between a current authoritative Screen Pass and its source
  object/version;
- an auditable evaluation result that never applies itself.

TradeScout and MealScout own:

- source collection and normalization;
- product-specific field mappings and active policy selection;
- owner/admin review;
- presentation;
- the separately authorized operation that applies accepted values.

## Evaluation order

1. Validate tenant, object type, policy version, and target version.
2. Apply an explicit authorized local override when present.
3. Exclude a field when it is not allowlisted or the policy marks it excluded.
4. Reject candidates that fail source, confidence, verification, evidence, or
   freshness requirements.
5. Rank remaining candidates by declared source priority, confidence, then
   observation time.
6. Emit one field decision with its evidence digest and reason codes.

Every evaluation returns `applyAuthorized: false`. A product must preview and
authorize application separately.

## Screen Pass boundary

Screen Pass is also owned by Infinity. It may provide strong evidence that a
candidate came from a specific registered object/version. It does not bypass a
Selective Inheritance policy.

A Screen Pass candidate is eligible only when:

- the pass resolution is authoritative;
- the object is confirmed unchanged (`changed: false`);
- the candidate satisfies the field policy; and
- its underlying evidence is verified.

Perceptual or AI object matches remain assistive and cannot become authoritative
inheritance evidence. Screen Pass recognition also cannot trigger attribution,
reward, payment, or a product mutation by itself.

## Product rollout

TradeScout and MealScout should begin in preview/shadow mode:

- declare product field policies;
- submit normalized candidates without private customer data;
- compare Infinity decisions with current owner/admin choices;
- preserve the source evidence digest and target version; and
- keep product apply authority disabled until reviewed.
