# Infinity realignment — Wave 2

Status: Draft product-local component convergence  
Authority: Infinity System Convergence Standard, approved by Thomas on
2026-09-04

## Outcome

TradeScout and MealScout now have draft migrations that remove proven duplicate
component owners and record the remaining canonical owners through Selective
Intelligence. This is the first component-convergence slice; it is not a visual
reskin and does not declare either product globally aligned.

| Product    | Draft evidence                                                  | Duplicate-owner errors | Proven result                                                                |
| ---------- | --------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| TradeScout | [#569](https://github.com/infotradescout/tradescoutAI/pull/569) | 15 → 0                 | One owner for repeated state, shell, mobile-hook, onboarding, and stock jobs |
| MealScout  | [#370](https://github.com/infotradescout/MealScout/pull/370)    | 2 → 0                  | One Button primitive, ShareButton, and routed Scout-page owner               |

Both drafts are stacked on their product boundary cleanups:

- TradeScout [#568](https://github.com/infotradescout/tradescoutAI/pull/568)
- MealScout [#369](https://github.com/infotradescout/MealScout/pull/369)

## Meaning of this wave

The canonical owners above are product-local. They prevent new work inside each
repository from creating another copy of the same job. They do not yet answer
where Infinity's cross-product experience system should live.

That distinction prevents two new forms of drift:

1. copying one product's current visual language into every other brand; and
2. calling a shared package canonical before identity, vocabulary,
   accessibility, and real consumer boundaries have been compared.

## Measured backlog

Selective Intelligence reports zero duplicate-owner errors in both product
drafts. Each still has five inventory-warning categories for raw buttons, forms,
inputs, selects, and text areas. Those warnings are the measured input to the
canonical component migration; they are not five new owners and are not a claim
that every screen is already consistent.

## Next gates

1. Merge each boundary-cleanup dependency before its stacked component draft.
2. Keep the current product owners as adapters until the Infinity-wide
   experience-system owner is selected from actual repository evidence.
3. Approve shared vocabulary and identity, ownership, permission, and consent
   rules before unifying cross-product data or journeys.
4. Migrate raw controls capability by capability and prove the finished surface
   before retiring each local adapter.

The machine-readable evidence and delivery state live in
`registry/convergence.json` so Selective Intelligence can continue the work
without re-deriving this baseline.
