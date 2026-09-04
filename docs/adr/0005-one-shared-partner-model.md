# ADR 0005: One Shared Partner Model

Status: accepted

TradeScout and MealScout currently implement overlapping link, referral,
attribution, and commission pipelines. Infinity defines one canonical partner
model. Query parameters, clean path segments, redirect links, cookies, sessions,
owner-attributed views, and approved external evidence are carriers into that
model rather than separate programs.
