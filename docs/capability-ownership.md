# Capability ownership

Infinity and Selective Intelligence have separate, explicit responsibilities.

| Capability                               | Canonical repository                    |
| ---------------------------------------- | --------------------------------------- |
| Intent understanding and checkpoints     | `infotradescout/Selective-Intelligence` |
| Repository realignment and reuse rules   | `infotradescout/Selective-Intelligence` |
| Drift prevention and evidence discipline | `infotradescout/Selective-Intelligence` |
| Portable SI skill and public plugin      | `infotradescout/Selective-Intelligence` |
| Ecosystem and capability register        | `infotradescout/tradescout-infinity`    |
| Cross-brand evidence contracts           | `infotradescout/tradescout-infinity`    |
| Product-specific inheritance behavior    | the consuming product repository        |
| SI release pin and compatibility checks  | `infotradescout/tradescout-infinity`    |

Infinity must consume an immutable SI release or commit. It must not vendor,
fork, translate, or independently repair canonical SI behavior. A distribution
listing is not source ownership.

The integration record is `integrations/selective-intelligence/source.json`. Its
status must remain `awaiting_canonical_release` until the declared SI version
exists at the pinned commit and passes SI's native release validation. Infinity
must not claim that an unpublished SI release is installable.

TradeScout-specific behavior belongs in TradeScout. MealScout-specific behavior
belongs in MealScout. SI remains portable and does not depend on either product.
