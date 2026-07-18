# Architecture

## Boundary

Infinity is a tenant-ready platform with provider-neutral contracts. Product
applications publish objects, issue partner links or passes, record conversion
evidence, and consume safe resolutions.

```text
TradeScout / MealScout / external tenant
  -> Infinity SDK or API
  -> registry and attribution evidence
  -> recognition providers
  -> verified resolution and safe actions
```

## Foundation packages

- `contracts`: tenant, partner program, link, touch, assignment, pass,
  resolution, conversion, and reward-decision contracts plus runtime trust
  guards.
- `provider-core`: vendor-neutral overlay, embedding, detection, and health
  interface.

## Application ownership

Infinity owns shared evidence and contracts. Each product owns:

- its canonical public routes;
- its allowed actions;
- its signup and conversion semantics;
- commercial reward policy approval;
- wallet, credit, payout, tax, and payment execution.

## Identifier rule

Public carriers use opaque identifiers or approved public vanity tags. Internal
subject references stay in the secured registry. A vanity tag is presentation,
not a security signature.

## Resolution authority

Signed watermark, validated short code, validated QR/barcode, and validated
C2PA/metadata recovery may produce authoritative attribution. Perceptual and AI
matches remain assistive until a separately verified pass is recovered.
