# TradeScout Adapter Plan

## Goal

Replace competing attribution implementations with a thin Infinity adapter
without breaking existing links or changing commercial policy implicitly.

## Sequence

1. Inventory all call sites for `ShareButton`, `buildAffiliateUrl`, `/r/:slug`,
   `/ref/:tag`, `handleExplicitOrExistingReferral`, clean-owner attribution,
   conversion-ledger writes, commission, and payout services.
2. Define TradeScout programs and explicitly approve their assignment rules.
3. Implement `server/infinity` as the only writer for new partner links,
   touches, assignments, and conversion evidence.
4. Implement `client/src/infinity` as the only share URL builder.
5. Dual-read legacy links while emitting only the canonical new format.
6. Backfill partner identities, links, locked lifetime assignments, and
   conversion evidence with source IDs for reconciliation.
7. Compare legacy and Infinity attribution outcomes in shadow mode.
8. Cut over reads only after zero wrong-partner assignments in the agreed proof
   set.
9. Retire disabled/stub duplicate services after call-site and balance proof.

## Compatibility

Legacy `/r`, `/ref`, and `?ref=` routes remain resolvers during migration. The
deterministic `cyrb53` slug may be a legacy lookup key but never a signature.

## Required product decision

TradeScout must explicitly choose the canonical emitted URL format and define
where clean-owner attribution is allowed. Infinity does not infer these from old
code.
