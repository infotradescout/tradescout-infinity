# MealScout Adapter Plan

## Goal

Keep MealScout's clean public URL doctrine while merging link, referral,
assignment, and conversion evidence into the Infinity model.

## Sequence

1. Inventory all reads/writes across affiliate links, clicks, referrals,
   commissions, wallet, credit, closer/booker fields, share events, signup,
   Stripe subscription, and booking webhooks.
2. Approve separate program definitions and versioned reward policies before
   migrating money logic.
3. Implement `server/infinity` to issue `PartnerLink` records and record
   touches/assignments/evidence.
4. Keep `/{businessSlug}/{affiliateTag}` as presentation when unambiguous;
   resolve the tag or opaque internal key through Infinity.
5. Stop generating new `userNNNN` public tags and stop accepting raw user IDs
   for new attribution.
6. Keep legacy query, `/ref`, raw-ID, and link-code resolution behind a
   compatibility adapter only.
7. Dual-write or shadow-write evidence and compare assignment outcomes.
8. Reconcile tables and financial balances before retiring any commission,
   wallet, or credit path.
9. Move approved policy evaluation behind one service; payment execution remains
   separate.

## Hard blocker

The current code does not contain one trustworthy commission policy. The 5%
versus 10% recurring contradiction and the independent configurable
closer/booker pipeline require an explicit commercial decision. No migration may
select a percentage by accident.

## URL decision

MealScout's canonical public presentation can remain a clean path segment. The
shared contract does not require TradeScout and MealScout to display attribution
identically; it requires both forms to resolve to the same model.
