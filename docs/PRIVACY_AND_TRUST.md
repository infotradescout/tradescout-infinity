# Privacy and Trust

## Evidence boundary

Shared evidence uses opaque references and digests. It must not contain raw
emails, phone numbers, private customer records, secrets, or payment details.
Media payload privacy belongs to Continuum with Screen Pass.

## Public versus disclosed tracing

Public content identifies the object, tenant, version, campaign, and optional
partner link. It does not identify the viewer. Viewer-specific tracing is
reserved for explicitly disclosed private or restricted-content use cases with
separate authorization.

## Failure posture

- Cross-tenant evidence fails closed.
- Missing configuration leaves product shadow adapters disabled.
- Evidence recording never executes payment.
- Product mutations remain separately authorized by the product.
