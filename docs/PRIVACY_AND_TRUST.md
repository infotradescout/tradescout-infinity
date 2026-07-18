# Privacy and Trust

## Visual payload

The visual payload contains only:

- opaque public pass ID;
- signature version;
- signature.

It must not contain raw user IDs, affiliate IDs, emails, phone numbers, customer
IDs, or private object data.

## Public versus disclosed tracing

Public content identifies the object, tenant, version, campaign, and optional
partner link. It does not identify the viewer. Viewer-specific tracing is
reserved for explicitly disclosed private or restricted-content use cases with
separate authorization.

## Failure posture

- Unknown, altered, expired, revoked, cross-tenant, or ambiguous passes fail
  closed.
- Provider failure returns an unresolved result and no attribution.
- Assistive image matching never creates payable attribution.
- Recovered actions are allowlisted by the owning application.
- Recognition never executes payment.
