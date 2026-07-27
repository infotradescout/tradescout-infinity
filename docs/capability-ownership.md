# Capability ownership

Infinity and Selective Intelligence are separate products with an explicit
integration boundary.

| Capability                              | Canonical repository                 |
| --------------------------------------- | ------------------------------------ |
| Intent understanding and checkpoints    | `Platynum-47/Selective-Intelligence` |
| Lanes and durable SI sessions           | `Platynum-47/Selective-Intelligence` |
| Councils and consensus rules            | `Platynum-47/Selective-Intelligence` |
| PolicyGuard                             | `Platynum-47/Selective-Intelligence` |
| SI evidence and verification            | `Platynum-47/Selective-Intelligence` |
| SI MCP business logic                   | `Platynum-47/Selective-Intelligence` |
| Portable SI skill and standalone plugin | `Platynum-47/Selective-Intelligence` |
| Plugin/tool catalog and discovery       | `infotradescout/tradescout-infinity` |
| Cross-tool orchestration                | `infotradescout/tradescout-infinity` |
| Infinity gateway and product adapters   | `infotradescout/tradescout-infinity` |
| SI release pin and compatibility checks | `infotradescout/tradescout-infinity` |

Infinity must consume an immutable SI release or commit. It must not vendor,
fork, translate, or independently repair canonical SI behavior. A distribution
listing is not source ownership.

The integration record is `integrations/selective-intelligence/source.json`. Its
status must remain `awaiting_canonical_release` until the declared SI version
exists at the pinned commit and passes SI's native release validation. Infinity
must not claim that an unpublished SI release is installable.

TradeScout-specific behavior belongs in Infinity-side adapters or the consuming
TradeScout product. SI must remain portable and must not depend on TradeScout
infrastructure.
