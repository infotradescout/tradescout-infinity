# Resolution Authority

| Order | Method                               | Discovery | Authoritative attribution                    |
| ----: | ------------------------------------ | --------- | -------------------------------------------- |
|     1 | Signed invisible-watermark detection | yes       | yes, after signature and registry validation |
|     2 | Visible short code                   | yes       | yes, after registry validation               |
|     3 | QR or barcode                        | yes       | yes, after registry validation               |
|     4 | C2PA or embedded metadata            | yes       | yes, after manifest/registry validation      |
|     5 | Perceptual match                     | yes       | no                                           |
|     6 | AI/object match                      | yes       | no                                           |

An authoritative method may still return ambiguous, expired, revoked,
superseded, or cross-tenant. Those outcomes cannot create an attribution
assignment.
