# Infinity ecosystem registry

This directory is the machine-readable starting point for Infinity as the register of the ecosystem.

- `ecosystem.json` records visible repositories without pretending that unreviewed names reveal their purpose.
- `capabilities.json` records canonical ownership and transitional duplicates.

Rules:

1. `canonical` means governing ownership has been approved; it does not mean every consumer has migrated.
2. `classify` means evidence exists but intended product purpose has not been established.
3. A legacy host remains recorded until its consumers are migrated and retirement is proven safe.
4. Product repositories own product-specific meaning, mutations, and money decisions.
5. Changes require a cited governing decision, evidence, and an explicit owner.

The register is not a package monolith. Products consume canonical capabilities through contracts or adapters while remaining purposefully distinct.
