# Browse the saved catalog

The catalog groups identical complete declaration text while retaining every
source occurrence. Names alone never establish shared behavior. Python prefix
hashes, file-level domain records, dirty sources and unverified revisions remain
separate observations.

The source package and its synthetic tests are tracked. The cross-project input
and generated views stay local because their source metadata may be nonpublic.
[catalog-snapshot.json](catalog-snapshot.json) identifies the preserved input by
SHA-256, byte length, schema, observation count and snapshot date. A fresh
source checkout builds and runs its synthetic tests without that portfolio
input.

With the authorized saved input present at `ecosystem/catalog.json`, run these
commands from the repository root:

```sh
pnpm ecosystem:refresh
pnpm ecosystem:verify
pnpm ecosystem:find -- view=implementations name=cleanString
```

Refresh reads the saved snapshot and rebuilds its views. It does not crawl the
portfolio or replace the input. Input/output collisions fail before writes.
Verify checks the snapshot hash, exact observation partition, reproduced views,
canonical-owner restrictions and the real query command.

Start with the generated `implementation-index.md`. Its largest repeated groups
link each observation by repository, path and line. The generated
`implementation-index.json` retains every location, import variant and review
reason. `overview.md`, `normalized-index.md` and `catalog-summary.md` provide
smaller views. Query results include every location in a matching text group;
filters must match the same observation. The default query view remains the raw
occurrence list.

For the saved snapshot, 30,666 observations yield 17,346 exact declaration-text
groups and 1,749 uncompared observations. This folds 11,571 repeated
declarations into their groups; it does not establish the number of unique
capabilities. Identical-file and identical-declaration counts overlap and must
not be added.

This recovery does not promote shared library implementations, migrate
consumers, change registry behavior, or release the catalog. Those remain
separate work.
