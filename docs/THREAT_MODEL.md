# Threat Model

| Threat                             | Required control                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Modified public ID or signature    | Established signing, signature versions, key rotation, fail closed              |
| Cross-tenant pass lookup           | Tenant-bound records and authorization checks                                   |
| Affiliate-tag substitution         | Registry resolution and signed evidence; vanity tag is not a signature          |
| Wrong partner from ambiguous image | No authoritative assignment; no payable attribution                             |
| Duplicate conversion/webhook       | Required idempotency key and durable uniqueness                                 |
| Self-attribution                   | Program-level hard rejection                                                    |
| Open redirect                      | Canonical internal-target allowlist owned by each tenant adapter                |
| Revoked or superseded content      | Resolution returns current state and suppresses unsafe actions                  |
| Client provider-key exposure       | Provider credentials remain server-side                                         |
| Detection-to-payment shortcut      | Contract forbids payout/payment flags and separates reward/payment systems      |
| Legacy raw-ID fallback             | Migration adapters resolve legacy IDs server-side; never emit them as new links |
| Commission-rule drift              | Versioned reward policy with explicit approval and conflict disposition         |

## Highest-severity invariant

Negative, altered, cross-tenant, and ambiguous tests must produce zero incorrect
payable partner assignments.
