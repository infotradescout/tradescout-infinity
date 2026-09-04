# Selective Intelligence integration

This directory contains only Infinity's integration contract for the canonical
Selective Intelligence product.

`source.json` records the canonical repository, public-directory version,
repository candidate version, and immutable source pin.

The compatibility test fails if Infinity recreates the former copied plugin tree
or if the source record stops using an immutable commit-shaped pin.

No adapter exists yet because Infinity has no demonstrated runtime requirement
that cannot be satisfied through SI's own MCP surface. Add one only for a
specific Infinity gateway contract, and keep it free of SI business logic.
