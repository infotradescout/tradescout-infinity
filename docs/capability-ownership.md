# Capability ownership

Infinity and Selective Intelligence are separate products with an explicit
integration boundary.

| Capability                              | Canonical repository                    |
| --------------------------------------- | --------------------------------------- |
| Intent understanding and checkpoints    | `infotradescout/Selective-Intelligence` |
| Lanes and durable SI sessions           | `infotradescout/Selective-Intelligence` |
| Councils and consensus rules            | `infotradescout/Selective-Intelligence` |
| PolicyGuard                             | `infotradescout/Selective-Intelligence` |
| SI evidence and verification            | `infotradescout/Selective-Intelligence` |
| SI MCP business logic                   | `infotradescout/Selective-Intelligence` |
| Portable SI skill and standalone plugin | `infotradescout/Selective-Intelligence` |
| Plugin/tool catalog and discovery       | `infotradescout/tradescout-infinity`    |
| Cross-tool orchestration                | `infotradescout/tradescout-infinity`    |
| Infinity gateway and product adapters   | `infotradescout/tradescout-infinity`    |
| SI release pin and compatibility checks | `infotradescout/tradescout-infinity`    |

Infinity must consume an immutable SI release or commit. It must not vendor,
fork, translate, or independently repair canonical SI behavior. A distribution
listing is not source ownership.

The integration record is `integrations/selective-intelligence/source.json`. Its
published source pin must resolve to the declared version and pass SI's native
release validation. The consumer remains `installation_unverified` until actual
installation and runtime use are proved; a valid source pin alone cannot
establish those states.

TradeScout-specific behavior belongs in Infinity-side adapters or the consuming
TradeScout product. SI must remain portable and must not depend on TradeScout
infrastructure.
