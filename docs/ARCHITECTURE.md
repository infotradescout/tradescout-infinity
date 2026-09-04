# Architecture

## Boundary

Infinity is the ecosystem register with a bounded cross-product evidence
service. Product applications register ownership, issue partner links, and
record attribution and conversion evidence.

```text
TradeScout / MealScout / external tenant
  -> Infinity SDK or API
  -> registry and attribution evidence
```

## Foundation packages

- `contracts`: tenant, partner program, link, touch, assignment, conversion, and
  reward-decision contracts plus runtime trust guards.
- `registry`: attribution-touch and conversion-evidence storage.
- `registry/*.json`: ecosystem and capability ownership records.

## Application ownership

Infinity owns shared evidence and contracts. Each product owns:

- its canonical public routes;
- its allowed actions;
- its signup and conversion semantics;
- commercial reward policy approval;
- wallet, credit, payout, tax, and payment execution.

## Identifier rule

Public carriers use opaque identifiers or approved public vanity tags. Internal
subject references stay in the secured registry. A vanity tag is presentation,
not a security signature.

## Media boundary

Screen Pass, camera intelligence, visual recognition, safe media actions, and
provider adapters belong to Continuum. Infinity may store an opaque external
evidence reference without implementing or reinterpreting the media result.
