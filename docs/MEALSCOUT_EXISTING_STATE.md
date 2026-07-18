# MealScout Affiliate Existing State

Repository: `infotradescout/MealScout`

Inspected `main` at GitHub search/fetch revision
`b81df059e269a936b6e80eccec97eb5359c870e2`. Statements below are
repository-confirmed unless labeled otherwise.

## Confirmed systems

| Surface                                | Current behavior                                                                                                                                                                             | Disposition                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `server/shareRoutes.ts`                | Generates a tracked public link for an authenticated user. Uses a valid vanity tag or creates/reuses an internal 8-character code. Emits the attribution as the final path segment.          | Keep target validation and UX; replace local link identity with Infinity `PartnerLink`. |
| `client/src/lib/share.ts`              | Calls `/api/share/generate`; fallback reads `affiliate_ref` from local storage and appends it as a path segment.                                                                             | Collapse into one adapter-backed URL builder.                                           |
| `shared/cleanAffiliateLinks.ts`        | Defines `/{businessSlug}/{affiliateTag}`, reserved-slug checks, clean-tag validation, and rejects `userNNNN`.                                                                                | Preserve as MealScout presentation policy, not the shared storage model.                |
| `server/affiliateTagService.ts`        | Resolves vanity tags, 8-character affiliate-link codes, and finally raw user IDs. It can generate `userNNNN`, though share generation rejects those tags and falls back to an internal code. | Remove raw-ID resolution from new links; keep only temporary legacy compatibility.      |
| `server/affiliateService.ts`           | Own affiliate links, clicks, commissions, wallet, and stats. First commission is 20%; comment says recurring 5%, executable code uses recurring 10%.                                         | Freeze money migration until policy is approved.                                        |
| `server/referralService.ts`            | Separate click/referral pipeline; attaches restaurant signup and directly creates a 10% subscription commission plus credit.                                                                 | Split evidence from reward/payment and retire duplicate calculation.                    |
| `server/affiliateCommissionService.ts` | Separate closer/booker commission pipeline with per-user percentages and advisory-lock idempotency for subscription and booking fees.                                                        | Preserve idempotency technique; migrate policy only after explicit mapping.             |
| `server/affiliateRoutes.ts`            | Exposes tag, link, click, stats, wallet/credit, and referral behavior across multiple tables.                                                                                                | Replace incrementally with adapter reads; do not big-bang delete.                       |
| `docs/MEALSCOUT_CLEAN_URL_DOCTRINE.md` | Declares clean path-segment attribution and treats `/ref` as legacy.                                                                                                                         | Preserve as MealScout URL doctrine after shared contract adoption.                      |

## Conflicts

1. Link/click data exists in `affiliateLinks`/`affiliateClicks`, while another
   journey uses `referrals`/`referralClicks`.
2. Commission state exists in `affiliateCommissions`,
   `affiliateCommissionLedger`, wallet, and credit ledger paths.
3. Three commission calculations coexist: 20% first plus executable 10%
   recurring, independent 10% subscription commission, and configurable
   closer/booker percentages.
4. The comment claiming 5% recurring contradicts executable 10% logic.
5. `userNNNN` is generated internally but prohibited as public output.
6. Raw user ID lookup remains a referral fallback, conflicting with opaque
   public identity.
7. Public route doctrine and earlier `?ref=` behavior are incompatible
   presentation contracts.

## Preserve

- Clean human-facing URLs.
- Reserved route and target protections.
- Vanity tags as optional presentation.
- Automatic tracked sharing for authenticated users.
- Advisory-lock or database-backed idempotency for payment-adjacent events.
- Product-specific credits, wallets, and payment execution outside Screen Pass
  recognition.

## Unresolved before application migration

- Approved MealScout commission policies and their effective dates.
- Whether closer and booker are two assignments in one program or separate
  programs.
- Whether restaurant subscription and host/truck booking use separate programs.
- Which legacy tables contain authoritative production balances.
- Compatibility lifetime for raw-ID, query-ref, `/ref`, and path-segment links.
