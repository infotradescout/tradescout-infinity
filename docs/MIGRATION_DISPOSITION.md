# Migration Disposition

| Existing component                        | Action                        | Gate                                |
| ----------------------------------------- | ----------------------------- | ----------------------------------- |
| TradeScout `/r/:slug`                     | compatibility resolver        | backfill link mapping               |
| TradeScout `?ref=` and `/ref/:tag`        | compatibility carriers        | canonical emit format approved      |
| TradeScout clean-owner attribution        | preserve conditionally        | eligible surfaces and rule approved |
| TradeScout lifetime user-column ownership | backfill to assignments       | reconciliation equality             |
| TradeScout conversion ledger              | adopt/migrate                 | idempotency and tenant mapping      |
| TradeScout commission stub                | delete                        | zero active call sites              |
| MealScout clean path attribution          | preserve as presentation      | route collision tests               |
| MealScout affiliate links/clicks          | migrate to link/touch         | count and ownership reconciliation  |
| MealScout referrals/referral clicks       | map then retire duplicates    | journey-level reconciliation        |
| MealScout commission services             | freeze and reconcile          | approved policy versions            |
| MealScout wallet/credit/payout            | keep product-owned            | balance and authorization review    |
| Raw user ID attribution fallback          | legacy read only, then remove | compatibility window complete       |
| Screen Pass                               | moved to Continuum            | no Infinity consumers found         |

The unused Screen Pass store was removed from Infinity. Other legacy stores are
unchanged until their consumers and data are inspected.
