# Attribution Contract

## Canonical vocabulary

| Term                | Meaning                                           | Replaces                                      |
| ------------------- | ------------------------------------------------- | --------------------------------------------- |
| Partner             | Person or organization eligible for credit        | affiliate user, closer, booker                |
| Program             | Tenant-specific attribution and eligibility rules | scattered hardcoded percentages               |
| Link                | Stable partner-to-target record                   | share slug, affiliate link, ad hoc `ref` URL  |
| Touch               | Verified arrival evidence                         | raw click rows and unstructured session blobs |
| Assignment          | Winning partner under a declared rule             | implicit cookie or user-column ownership      |
| Conversion evidence | Idempotent product event                          | direct commission creation from a route       |
| Reward decision     | Versioned policy result                           | inline percentage calculation                 |

## Carrier contract

`?ref=`, a clean path segment, a redirect code, a cookie, a session, and a clean
owner view are native Infinity carriers. An approved Continuum Screen Pass
result may be referenced as external evidence. All carriers resolve to the same
`PartnerLink` or `PartnerIdentity`; they do not define separate attribution
programs.

Canonical links must be generated from a canonical target and one public
attribution key. Products may choose a visually clean URL form, but the registry
representation is identical.

## Rule contract

Every active program declares one rule:

- `first_touch`: earliest verified touch inside the attribution window wins.
- `last_touch`: latest verified touch inside the window wins.
- `lifetime_first_touch`: first accepted assignment locks until explicitly
  revoked by authorized policy.

Self-attribution is always rejected. An existing locked assignment cannot be
overwritten by a later carrier.

## Evidence contract

A touch records tenant, program, partner, target, carrier, time, evidence
digest, and verification state. Raw IP addresses, emails, or private customer
identifiers are not required in the shared contract.

A conversion requires an idempotency key and an allowlisted conversion type. It
can reference an assignment but cannot contain or request payout flags.

## Reward boundary

Infinity may store a reward-policy reference and a policy result.
Product-specific policy decides whether a conversion qualifies and may calculate
an amount. Payment execution remains a separate, authorized subsystem.

Conflicting product percentages must be resolved as explicit versioned policies
before migration; Infinity must not choose a percentage based on whichever
legacy service ran.
