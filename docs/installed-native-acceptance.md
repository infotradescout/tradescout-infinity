# Installed Infinity API acceptance

The native runner tests the versioned installed API, not workspace imports or an
in-memory database. It requires `.infinity-native-acceptance.json` in the
working directory containing `disposable: true`, `installedRoot`, and
`databaseUrl`.

Use only a newly initialized, local synthetic PostgreSQL database. The runner
rejects any host other than `127.0.0.1` and requires a database name beginning
`infinity_acceptance_`. Apply the complete checked-in
`migrations/0001_infinity_registry.sql` with `ON_ERROR_STOP` before running. The
runner does not initialize or migrate a database.

Build and install the API to a new versioned directory using the locked
workspace dependencies and the repository's pinned pnpm 11.7.0. The runner
rejects installations whose runtime packages resolve back into the workspace:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --filter @tradescout-infinity/api --prod deploy --legacy <new-install-directory>
pnpm test:installed
pnpm test:installed:neon
```

The optional `test:installed:neon` mode runs the same scenarios through the
installed default Neon Fetch entrypoint, including its module-scope pool, using
a test-only loopback HTTP bridge. It uses the same disposable database guard and
starts independent processes before checking restart recovery. This is native
local transport evidence, not a hosted Neon deployment test.

The declared SI compatibility checkout must be supplied through `SI_SOURCE_ROOT`
at the exact version in `integrations/selective-intelligence/source.json`. Do
not replace that pin with the controller's installed runtime.

The runner resolves installed packages inside the installation directory, starts
two actual loopback API processes against PostgreSQL, and later starts a fresh
process. It checks bearer authentication, tenant isolation, signed pass actions,
sixteen competing conversion requests, identical replay timestamps,
changed-payload rejection, restart persistence, pass revocation, tenant
suspension, and key revocation. It creates only uniquely named synthetic
tenants, keys, and records in the selected disposable database. It closes its
own API children and database pools; the caller owns database-server shutdown.

The initial installed candidate `85ab6facde325cf5b65a79c8cf28baeb2be7367c`
passed eight of nine scenario subtests. A suspended tenant with an otherwise
active key still received HTTP 200. The authentication repair joins the existing
tenant owner and requires both tenant and API key to remain active. It does not
alter public signed-pass resolution policy, expiry semantics, rate limits,
production records, migrations, or SI source metadata.

This is native local integration evidence. It does not establish production
deployment, hosted required CI, watermark recognition quality, live provider
operation, payout authorization, full application adapters, or universal SI
adoption. An installed controller executing this test is not proof that Infinity
installed its separately pinned SI integration.
