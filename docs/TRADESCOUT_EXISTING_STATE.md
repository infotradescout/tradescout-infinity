# TradeScout Affiliate Existing State

Repository: `infotradescout/tradescoutAI`

Inspected `main` at GitHub search/fetch revision
`457cd73c6fd1cf3aad650052d5be4c4607367c53`. Statements below are
repository-confirmed unless labeled otherwise.

## Confirmed systems

| Surface                                                       | Current behavior                                                                                                                                                    | Disposition                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `client/src/components/ShareButton.tsx`                       | Authenticated sharing creates/reuses `/r/:slug`; slug is deterministic `cyrb53` over user and destination and explicitly non-cryptographic.                         | Preserve UX and dedup intent; replace security identity with Infinity `PartnerLink.publicCode`. |
| `client/src/utils/share.ts`                                   | Fetches affiliate code, emits `?ref=` by default, suppresses it on public profile routes because those views self-attribute.                                        | Collapse into one adapter-backed URL builder.                                                   |
| `server/services/referralAttribution.ts`                      | Accepts explicit `?ref=`, uses a 30-day `ts_ref` cookie, first cookie wins, records clicks, and can attribute clean page views to the page owner.                   | Map carriers to `AttributionTouch`; make program rule explicit.                                 |
| `server/services/referralAttribution.ts`                      | Persists lifetime first-touch ownership on `users.referredByAffiliateAccountId` and rejects self-attribution.                                                       | Map to locked `AttributionAssignment` under `lifetime_first_touch`.                             |
| `server/utils/universalAttributionRef.ts`                     | Supports `/ref/:tag?to=...`, validates tag and internal target, rejects default-looking tags and open redirects, stores session proof, and sets attribution cookie. | Preserve validation; treat redirect as another carrier.                                         |
| `server/utils/attributionConversionLedger.ts`                 | Accepts only allowlisted conversion types, requires session/cookie proof, rejects default tags and payout flags, and records all money flags as false.              | Adopt as the starting conversion-evidence boundary.                                             |
| `migrations/0098_affiliate_attribution_conversion_ledger.sql` | Stores conversion evidence separately from payment execution.                                                                                                       | Migrate or mirror into Infinity evidence after adapter cutover.                                 |
| `server/services/affiliateService.ts`                         | Stats and payout access exist, but referral reads/writes are explicitly disabled while the same file imports the referral table.                                    | Retire disabled duplicate methods after call-site audit.                                        |
| `server/routes/affiliate.ts`                                  | Contains a commission stub that calculates 10% and logs.                                                                                                            | Delete after call-site proof; it cannot become policy.                                          |

## Conflicts

1. `/r/:slug`, `?ref=`, `/ref/:tag?to=...`, cookies, sessions, and clean-owner
   attribution are separate implementations of one carrier problem.
2. Public profile sharing can use a redirect slug while generic sharing uses a
   query ref.
3. Deterministic client hashing is useful for reuse but unsuitable as a trust
   signature.
4. Lifetime ownership exists as a user column while conversion evidence uses
   session/cookie proof; the assignment is not represented as one canonical
   object.
5. Commission/payout services and a 10% stub sit beside the evidence-only
   ledger.

## Preserve

- First-touch protection and self-attribution rejection.
- Clean public profile URLs.
- Internal-target/open-redirect protection.
- Conversion evidence separated from payout.
- Existing legacy links through compatibility resolvers.

## Unresolved before application migration

- Which TradeScout program uses 30-day first-touch versus lifetime first-touch.
- Whether clean-owner attribution applies to every public profile type or only
  approved owner pages.
- Which legacy commission/payout services have active production call sites.
- Canonical public presentation: clean path, short redirect, or `?ref=`.
  Infinity supports all as carriers but TradeScout must emit one canonical
  format.
