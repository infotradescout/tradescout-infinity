# Selective Intelligence integration

This directory contains only Infinity's integration contract for the canonical
Selective Intelligence product.

`source.json` records the published canonical repository, expected plugin
version, and immutable source pin. SI 1.0.8 exists at that commit and passes its
native package validation. This consumer's installation and runtime use remain
unverified.

The compatibility test fails if Infinity recreates the former copied plugin tree
or if the source record stops using an immutable commit-shaped pin. With
`SI_SOURCE_ROOT` set to an existing canonical checkout, it also reads the exact
pinned version and plugin manifest from Git and rejects mismatched ownership or
versions. Without that checkout, source replay is explicitly skipped.

No adapter exists yet because Infinity has no demonstrated runtime requirement
that cannot be satisfied through SI's own MCP surface. Add one only for a
specific Infinity gateway contract, and keep it free of SI business logic.
