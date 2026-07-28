# JW Stone Screen Pass proof

## Confirmed executable proof

`packages/registry/test/jwStoneProof.test.ts` proves the registry and evidence
flow for the JW Stone `cristallo-backlit` object:

- an attributed session is recorded as a non-payable `query_ref` touch;
- a signed, tenant-bound Screen Pass is issued for the exact stone;
- resolution recovers the JW Stone object, partner reference, current-version
  state, `Check Current Availability`, and `Ask About This Stone`;
- Direct Connect intent is recorded as idempotent conversion evidence; and
- neither recognition nor evidence recording triggers payout.

Run it with the repository test suite:

```sh
pnpm test
```

## Visual-capture gate

The screenshot, crop, recompression, and photographed-screen cases are not
claimed as passed. This repository currently has the provider-independent
registry and provider interface, but no installed image watermark provider,
encoder, detector, scanner-web application, or JW Stone source image fixture.

The visual gate becomes runnable only when a real provider adapter supplies
embedding and detection. The benchmark must then use the same issued public pass
ID and record, for each transformation:

| Case                 | Required result     |
| -------------------- | ------------------- |
| Original render      | exact pass resolves |
| Screenshot           | exact pass resolves |
| Crop                 | exact pass resolves |
| Recompression        | exact pass resolves |
| Photograph of screen | exact pass resolves |

No simulated detector result counts as proof.
