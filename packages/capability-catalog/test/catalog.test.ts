import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  catalogIdentity,
  catalogMarkdown,
  catalogSummary,
  findCapabilities,
  implementationIndex,
  normalizationReport,
  normalizedCapabilityIndex,
  normalizedCapabilityMarkdown,
  normalizedOverview,
  normalizedOverviewMarkdown,
  reusableCandidateIndex,
  scanCatalog,
  validateNormalizationMapLinks,
  validateSourceRegistry,
  type Descriptor,
} from "../src/index.js";

function commitFixture(root: string): string {
  const git = (args: string[]) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  git(["init", "-q"]);
  git(["config", "user.email", "catalog@example.invalid"]);
  git(["config", "user.name", "Catalog Fixture"]);
  git(["add", "."]);
  git(["commit", "-qm", "fixture"]);
  return git(["rev-parse", "HEAD"]).trim();
}

test("source registry rejects malformed and unsafe scan declarations", () => {
  assert.deepEqual(validateSourceRegistry("not-an-array"), [
    "source registry must be an array",
  ]);
  assert.deepEqual(
    validateSourceRegistry([
      { repository: "bad id", path: ".", scan: true, sourceKind: "canonical" },
      { repository: "wip", path: ".", scan: true, sourceKind: "wip" },
      { repository: "unpinned", path: ".", scan: true, sourceKind: "snapshot" },
      { repository: "implicit-wip", path: ".", sourceKind: "wip" },
    ]),
    [
      "source[0].repository must be a stable identifier",
      "source[0].expectedRevision is required when scan=true",
      "source[1] must set scan=false for a wip source",
      "source[1].expectedRevision is required when scan=true",
      "source[2].expectedRevision is required when scan=true",
      "source[3] must set scan=false for a wip source",
    ],
  );
  assert.deepEqual(
    validateSourceRegistry([
      {
        repository: "canonical",
        path: "C:/machine-specific/repo",
        sourceKind: "canonical",
      },
    ]),
    ["source[0].path must be workspace-relative"],
  );
});

test("scans deterministically with provenance and exclusions", async () => {
  const root = await mkdtemp(join(tmpdir(), "infinity-catalog-"));
  await mkdir(join(root, "src"));
  await mkdir(join(root, "node_modules"));
  await writeFile(
    join(root, "src", "Auth.ts"),
    "import x from './x';\nexport function authenticate() { return x; }\n",
  );
  await writeFile(
    join(root, "src", "Card.tsx"),
    "export function Card() { return <button>Open</button>; }\n",
  );
  await writeFile(
    join(root, "node_modules", "ignored.ts"),
    "export function ignored() {}\n",
  );
  const revision = commitFixture(root);
  const c = await scanCatalog(
    [{ repository: "demo", path: root, expectedRevision: revision }],
    new Date("2026-01-01T00:00:00Z"),
  );
  assert.equal(c.sources[0]!.status, "scanned");
  assert.equal(c.descriptors.length, 2);
  assert.equal(c.descriptors[0]!.name, "authenticate");
  assert.deepEqual(c.descriptors[0]!.category, ["auth"]);
  assert.equal(c.descriptors[0]!.revision, revision);
  assert.equal(c.descriptors[1]!.name, "Card");
  assert.equal(c.descriptors[1]!.disposition, "product-owned");
  assert.deepEqual(
    c,
    await scanCatalog(
      [{ repository: "demo", path: root, expectedRevision: revision }],
      new Date("2026-01-01T00:00:00Z"),
    ),
  );
});
test("records missing roots without inventing scan facts", async () => {
  const c = await scanCatalog([
    { repository: "absent", path: join(tmpdir(), "not-there-xyz") },
  ]);
  assert.equal(c.sources[0]!.status, "registered_unscanned");
  assert.equal(c.descriptors.length, 0);
});

test("fails closed for dirty and revision-mismatched roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "infinity-catalog-blocked-"));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "src", "capability.ts"),
    "export function capability() {}\n",
  );
  const revision = commitFixture(root);
  const mismatch = await scanCatalog([
    {
      repository: "mismatch",
      path: root,
      expectedRevision: "0".repeat(40),
    },
  ]);
  assert.equal(mismatch.sources[0]!.status, "registered_unscanned");
  assert.equal(mismatch.sources[0]!.scanBlockedReason, "revision_mismatch");
  assert.equal(mismatch.descriptors.length, 0);
  await writeFile(
    join(root, "src", "capability.ts"),
    "export function changed() {}\n",
  );
  const dirty = await scanCatalog([
    { repository: "dirty", path: root, expectedRevision: revision },
  ]);
  assert.equal(dirty.sources[0]!.status, "registered_unscanned");
  assert.equal(dirty.sources[0]!.scanBlockedReason, "dirty");
  assert.equal(dirty.sources[0]!.revisionVerified, false);
  assert.equal(dirty.descriptors.length, 0);
});

test("requires a pinned clean snapshot and never scans a WIP root", async () => {
  const root = await mkdtemp(join(tmpdir(), "infinity-catalog-pinning-"));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "src", "capability.ts"),
    "export function capability() {}\n",
  );
  const revision = commitFixture(root);

  const unpinned = await scanCatalog([
    { repository: "unpinned", path: root, sourceKind: "snapshot", scan: true },
  ]);
  assert.equal(unpinned.sources[0]!.status, "registered_unscanned");
  assert.equal(unpinned.sources[0]!.scanBlockedReason, "revision_unpinned");
  assert.equal(unpinned.sources[0]!.revisionVerified, false);
  assert.equal(unpinned.descriptors.length, 0);

  const wip = await scanCatalog([
    {
      repository: "wip",
      path: root,
      sourceKind: "wip",
      scan: true,
      expectedRevision: revision,
    },
  ]);
  assert.equal(wip.sources[0]!.status, "registered_unscanned");
  assert.equal(wip.sources[0]!.scanBlockedReason, "wip_source");
  assert.equal(wip.sources[0]!.revisionVerified, false);
  assert.equal(wip.descriptors.length, 0);
});

test("does not catalog constants and compares duplicate files globally", async () => {
  const parent = await mkdtemp(join(tmpdir(), "infinity-catalog-dupes-"));
  const first = join(parent, "first");
  const second = join(parent, "second");
  await mkdir(join(first, "src"), { recursive: true });
  await mkdir(join(second, "src"), { recursive: true });
  const source =
    "export const label = 'not a function';\nexport function shared() { return 1; }\n";
  await writeFile(join(first, "src", "shared.ts"), source);
  await writeFile(join(second, "src", "shared.ts"), source);
  await writeFile(
    join(first, "src", "constants.ts"),
    "export const same = 1;\n",
  );
  await writeFile(
    join(second, "src", "constants.ts"),
    "export const same = 1;\n",
  );
  const firstRevision = commitFixture(first);
  const secondRevision = commitFixture(second);
  const catalog = await scanCatalog(
    [
      { repository: "second", path: second, expectedRevision: secondRevision },
      { repository: "first", path: first, expectedRevision: firstRevision },
    ],
    new Date("2026-01-01T00:00:00Z"),
  );
  assert.equal(
    catalog.descriptors.filter((item) => item.name === "label").length,
    0,
  );
  assert.equal(catalog.duplicates.length, 2);
  assert.deepEqual(catalog.duplicates[0]!.paths, [
    "first:src/constants.ts",
    "second:src/constants.ts",
  ]);
  assert.deepEqual(catalog.duplicates[1]!.paths, [
    "first:src/shared.ts",
    "second:src/shared.ts",
  ]);
  assert.equal(catalog.nameCollisions.length, 1);
  const summary = catalogSummary(catalog);
  assert.equal(summary.descriptors.total, catalog.descriptors.length);
  assert.equal(summary.comparison.exactDuplicateFiles, 2);
  assert.equal(summary.identity.exactDuplicateFileGroups, 2);
  assert.equal(summary.identity.fileCopyDuplicateObservations, 1);
  assert.equal(summary.descriptors.byRepository.first, 1);
  assert.equal(
    findCapabilities(catalog, { category: "auth", disposition: "candidate" })
      .length,
    0,
  );
  assert.equal(
    findCapabilities(catalog, { repository: "first", name: "shared" }).length,
    1,
  );
});

test("counts copied-file observations without merging names or repeated declarations", async () => {
  const parent = await mkdtemp(join(tmpdir(), "infinity-catalog-identity-"));
  const roots = [];
  const copied = [
    "export function firstScope() {",
    "  function repeated() { return 1; }",
    "  return repeated();",
    "}",
    "export function secondScope() {",
    "  function repeated() { return 1; }",
    "  return repeated();",
    "}",
    "",
  ].join("\n");
  for (const [repository, value] of [
    ["first", 1],
    ["second", 2],
  ] as const) {
    const root = join(parent, repository);
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "copied.ts"), copied);
    await writeFile(
      join(root, "src", "variant.ts"),
      `export function evaluate() { return ${value}; }\n`,
    );
    await writeFile(
      join(root, "src", "variant.py"),
      `def calculate(value):\n    return value + ${value}\n`,
    );
    roots.push({
      repository,
      path: root,
      expectedRevision: commitFixture(root),
    });
  }
  const catalog = await scanCatalog(roots);
  const originalDescriptors = structuredClone(catalog.descriptors);
  const identity = catalogIdentity(catalog);
  assert.deepEqual(identity, {
    observations: 12,
    exactDuplicateFileGroups: 1,
    extraIdenticalFileCopies: 1,
    fileCopyDuplicateObservations: 4,
    observationsAfterFileCopyDeduplication: 8,
    verifiedUniqueCapabilities: null,
  });
  assert.deepEqual(
    catalog.descriptors
      .filter((item) => item.name === "repeated")
      .map((item) => [item.repository, item.path, item.line]),
    [
      ["first", "src/copied.ts", 2],
      ["first", "src/copied.ts", 6],
      ["second", "src/copied.ts", 2],
      ["second", "src/copied.ts", 6],
    ],
  );
  for (const name of ["evaluate", "calculate"]) {
    const variants = catalog.descriptors.filter((item) => item.name === name);
    assert.deepEqual(
      variants.map((item) => item.repository),
      ["first", "second"],
    );
    assert.equal(new Set(variants.map((item) => item.fileSha256)).size, 2);
  }
  assert.deepEqual(
    catalogIdentity({
      ...catalog,
      descriptors: [...catalog.descriptors].reverse(),
    }),
    identity,
  );
  const report = normalizationReport(catalog);
  const compact = normalizedCapabilityIndex(report);
  const overview = normalizedOverview(compact);
  const summary = catalogSummary(catalog);
  for (const result of [report, compact, overview, summary]) {
    assert.deepEqual(result.identity, identity);
  }
  for (const markdown of [
    normalizedCapabilityMarkdown(compact),
    normalizedOverviewMarkdown(overview),
  ]) {
    assert.match(markdown, /Name-based groups/);
    assert.match(markdown, /Verified unique capabilities: not established/);
  }
  assert.deepEqual(catalog.descriptors, originalDescriptors);
});

test("saved-catalog refresh rejects input collisions before writing any outputs", async () => {
  const catalog = {
    schemaVersion: 2 as const,
    generatedAt: "2026-01-01T00:00:00Z",
    sources: [],
    descriptors: [],
    duplicates: [],
    nameCollisions: [],
  };
  const originalBytes = Buffer.from(JSON.stringify(catalog, null, 2) + "\n");
  const filenames = [
    "catalog",
    "normalization-report.json",
    "implementation-index.json",
    "normalized-index.json",
    "overview.json",
    ...(process.platform === "win32" ? ["OVERVIEW.JSON"] : []),
    "catalog.json",
  ];
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  for (const filename of filenames) {
    const root = await mkdtemp(join(tmpdir(), "infinity-catalog-refresh-"));
    const input = join(root, filename);
    await writeFile(input, originalBytes);
    const refresh = () =>
      execFileSync(process.execPath, [cli, "--from-catalog", filename], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    if (filename === "catalog.json") {
      refresh();
      const summary = JSON.parse(
        await readFile(join(root, "catalog-summary.json"), "utf8"),
      );
      assert.deepEqual(summary.identity, catalogIdentity(catalog));
    } else {
      assert.throws(
        refresh,
        /derived output would overwrite the input catalog/,
      );
      assert.deepEqual(await readdir(root), [filename]);
    }
    assert.deepEqual(await readFile(input), originalBytes);
  }
});

test("keeps external name matches under review even when a canonical implementation exists", async () => {
  const parent = await mkdtemp(join(tmpdir(), "infinity-canonical-matches-"));
  const canonical = join(parent, "canonical");
  const external = join(parent, "external");
  const canonicalSources = join(canonical, "packages", "contracts", "src");
  await mkdir(canonicalSources, { recursive: true });
  const canonicalTests = join(canonical, "packages", "contracts", "test");
  await mkdir(canonicalTests, { recursive: true });
  await mkdir(join(external, "src"), { recursive: true });
  const identical =
    "export function clamp(value: number) { return Math.max(0, value); }\n";
  await writeFile(
    join(canonicalSources, "utilities.ts"),
    identical +
      "export function normalizeValue(value: string) { return value.trim(); }\n" +
      "export function roundTo(value: number) { return Math.round(value); }\n",
  );
  await writeFile(
    join(canonicalTests, "helpers.ts"),
    "export function request() { return 'fixture'; }\n" +
      "export function fixtureOnly() { return 'test setup'; }\n",
  );
  await writeFile(
    join(external, "src", "utilities.ts"),
    identical +
      "export function normalizeValue(value: string) { return value.toLowerCase(); }\n" +
      "export function request() { return 'external implementation'; }\n",
  );
  const catalog = await scanCatalog([
    {
      repository: "infinity-canonical",
      path: canonical,
      expectedRevision: commitFixture(canonical),
    },
    {
      repository: "external",
      path: external,
      expectedRevision: commitFixture(external),
    },
  ]);
  assert.equal(catalog.descriptors.length, 8);
  const report = normalizationReport(catalog);
  const differing = report.groups.items.find(
    (group) => group.representativeName === "normalizeValue",
  );
  const sameText = report.groups.items.find(
    (group) => group.representativeName === "clamp",
  );
  const canonicalOnly = report.groups.items.find(
    (group) => group.representativeName === "roundTo",
  );
  const testHelper = report.groups.items.find(
    (group) => group.representativeName === "request",
  );
  const testOnly = report.groups.items.find(
    (group) => group.representativeName === "fixtureOnly",
  );
  assert.equal(differing?.symbolHashes.length, 2);
  assert.equal(sameText?.symbolHashes.length, 1);
  for (const group of [differing, sameText]) {
    assert.equal(group?.decision, "review_extraction");
    assert.deepEqual(group?.repositories, ["external", "infinity-canonical"]);
    assert.equal(group?.evidence.length, 2);
  }
  assert.equal(canonicalOnly?.decision, "shared_canonical");
  assert.deepEqual(canonicalOnly?.repositories, ["infinity-canonical"]);
  assert.equal(testHelper?.decision, "review_extraction");
  assert.equal(testOnly?.decision, "review_extraction");
  assert.deepEqual(testOnly?.repositories, ["infinity-canonical"]);
  assert.ok(
    testHelper?.evidence.some(
      (item) => item.path === "packages/contracts/test/helpers.ts",
    ),
  );
  assert.equal(report.groups.byDecision.shared_canonical, 1);
  const candidates = reusableCandidateIndex(report);
  assert.equal(candidates.counts.sharedCanonical, 1);
  assert.equal(candidates.counts.reviewExtraction, 4);
});

test("withholds canonical status for test contexts and incomplete source evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "infinity-canonical-evidence-"));
  const source = join(root, "packages", "contracts", "src");
  await mkdir(source, { recursive: true });
  await writeFile(
    join(source, "text.ts"),
    "export function normalizeValue(value: string) { return value.trim(); }\n",
  );
  const catalog = await scanCatalog([
    {
      repository: "infinity-canonical",
      path: root,
      expectedRevision: commitFixture(root),
    },
  ]);
  assert.equal(catalog.descriptors.length, 1);
  assert.equal(
    normalizationReport(catalog).groups.items[0]?.decision,
    "shared_canonical",
  );
  assert.equal(implementationIndex(catalog).summary.comparedObservations, 1);
  const cases: Array<{
    label: string;
    patch: Partial<Descriptor>;
    uncompared?: boolean;
  }> = [
    {
      label: "nested test directory",
      patch: { path: "packages/contracts/src/__tests__/fixtures.ts" },
    },
    {
      label: "test suffix inside src",
      patch: { path: "packages/contracts/src/fixtures.test.ts" },
    },
    {
      label: "invalid declaration digest",
      patch: { symbolSha256: "prefix" },
      uncompared: true,
    },
    {
      label: "unsupported source extension",
      patch: { path: "packages/contracts/src/helper.rb" },
      uncompared: true,
    },
    { label: "dirty source", patch: { dirty: true }, uncompared: true },
    {
      label: "unverified source",
      patch: { revisionVerified: false },
      uncompared: true,
    },
  ];
  for (const { label, patch, uncompared } of cases) {
    const observation = { ...catalog.descriptors[0]!, ...patch };
    const variant = { ...catalog, descriptors: [observation] };
    assert.equal(
      normalizationReport(variant).groups.items[0]?.decision,
      "review_extraction",
      label,
    );
    if (uncompared) {
      const index = implementationIndex(variant);
      assert.equal(index.summary.comparedObservations, 0, label);
      assert.equal(index.uncompared.length, 1, label);
      assert.deepEqual(index.uncompared[0]?.descriptor, observation, label);
    }
  }
});

test("does not promote Python declaration-prefix hashes to reusable implementations", async () => {
  const parent = await mkdtemp(join(tmpdir(), "infinity-python-prefixes-"));
  const roots = [];
  for (const [repository, body] of [
    ["first", "value.strip()"],
    ["second", "value.lower()"],
  ] as const) {
    const root = join(parent, repository);
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "utilities.py"),
      `def normalizeValue(value):\n    return ${body}\n`,
    );
    roots.push({
      repository,
      path: root,
      expectedRevision: commitFixture(root),
    });
  }
  const catalog = await scanCatalog(roots);
  assert.equal(catalog.descriptors.length, 2);
  assert.equal(
    new Set(catalog.descriptors.map((item) => item.symbolSha256)).size,
    1,
  );
  assert.equal(
    new Set(catalog.descriptors.map((item) => item.fileSha256)).size,
    2,
  );
  const report = normalizationReport(catalog);
  assert.equal(report.groups.items[0]?.representativeName, "normalizeValue");
  assert.equal(report.groups.items[0]?.decision, "review_extraction");
  assert.equal(report.groups.byDecision.reuse_as_is_candidate, 0);
  assert.equal(reusableCandidateIndex(report).counts.reuseAsIsCandidates, 0);
});

test("normalizes equivalent symbols with shared-by-default foundations", async () => {
  const parent = await mkdtemp(join(tmpdir(), "infinity-normalization-"));
  const first = join(parent, "first");
  const second = join(parent, "second");
  const canonical = join(parent, "canonical");
  await mkdir(join(first, "src"), { recursive: true });
  await mkdir(join(second, "src"), { recursive: true });
  await mkdir(join(canonical, "packages", "contracts", "src"), {
    recursive: true,
  });
  const shared =
    "export function normalizeValue(value: string) { return value.trim(); }\nexport class SharedClass {}\n";
  await writeFile(join(first, "src", "shared.ts"), shared);
  await writeFile(
    join(first, "src", "auth.ts"),
    "export function authenticateUser() { return true; }\n",
  );
  await writeFile(join(second, "src", "shared.ts"), shared);
  await writeFile(
    join(second, "src", "Button.tsx"),
    "export function Button() { return <button>Open</button>; }\n",
  );
  await writeFile(
    join(canonical, "packages", "contracts", "src", "math.ts"),
    "export function roundTo(value: number, decimals = 0) { const factor = 10 ** decimals; return Math.round(value * factor) / factor; }\n",
  );
  const firstRevision = commitFixture(first);
  const secondRevision = commitFixture(second);
  const canonicalRevision = commitFixture(canonical);
  const catalog = await scanCatalog([
    { repository: "second", path: second, expectedRevision: secondRevision },
    { repository: "first", path: first, expectedRevision: firstRevision },
    {
      repository: "infinity-canonical",
      path: canonical,
      expectedRevision: canonicalRevision,
    },
  ]);
  const report = normalizationReport(catalog);
  const compact = normalizedCapabilityIndex(report);
  assert.equal(compact.totals.groups, report.groups.total);
  assert.equal(compact.totals.descriptors, catalog.descriptors.length);
  assert.equal(
    compact.families.reduce((sum, family) => sum + family.groupCount, 0),
    report.groups.total,
  );
  assert.equal(
    compact.families.reduce((sum, family) => sum + family.descriptorCount, 0),
    catalog.descriptors.length,
  );
  assert.ok(compact.families.length <= 15);
  assert.ok(
    compact.families.every((family) => family.customizationReasons.length <= 6),
  );
  assert.match(
    normalizedCapabilityMarkdown(compact),
    /Normalized Capability Index/,
  );
  const overview = normalizedOverview(compact);
  assert.ok(overview.totals.pillars <= 6);
  assert.equal(overview.totals.groups, report.groups.total);
  assert.equal(overview.totals.descriptors, catalog.descriptors.length);
  assert.equal(
    overview.pillars.reduce((sum, pillar) => sum + pillar.groupCount, 0),
    report.groups.total,
  );
  assert.equal(
    overview.pillars.reduce((sum, pillar) => sum + pillar.descriptorCount, 0),
    catalog.descriptors.length,
  );
  assert.ok(overview.pillars.every((pillar) => pillar.familyKeys.length > 0));
  assert.match(normalizedOverviewMarkdown(overview), /Ecosystem Overview/);
  assert.throws(
    () =>
      normalizedOverview({
        ...compact,
        families: [
          ...compact.families,
          { ...compact.families[0]!, key: "future-family" },
        ],
      }),
    /overview definitions missing families: future-family/,
  );
  assert.match(catalogMarkdown(catalog), /intentionally compact/);
  const sharedGroup = report.groups.items.find(
    (group) => group.representativeName === "normalizeValue",
  );
  assert.equal(sharedGroup?.decision, "reuse_as_is_candidate");
  assert.deepEqual(sharedGroup?.repositories, ["first", "second"]);
  const classGroup = report.groups.items.find(
    (group) => group.representativeName === "SharedClass",
  );
  assert.equal(classGroup?.decision, "review_extraction");
  const authGroup = report.groups.items.find(
    (group) => group.representativeName === "authenticateUser",
  );
  assert.equal(authGroup?.decision, "adapter_only");
  const buttonGroup = report.groups.items.find(
    (group) => group.representativeName === "Button",
  );
  assert.equal(buttonGroup?.decision, "shared_foundation_candidate");
  const canonicalGroup = report.groups.items.find(
    (group) => group.representativeName === "roundTo",
  );
  assert.equal(canonicalGroup?.decision, "shared_canonical");
  assert.equal(
    report.categoryMatrix.find((item) => item.category === "auth")?.total,
    1,
  );
  assert.equal(report.groups.byDecision.reuse_as_is_candidate, 1);
  assert.equal(report.groups.byDecision.shared_foundation_candidate, 1);
  const index = reusableCandidateIndex(report);
  assert.equal(index.counts.sharedCanonical, 1);
  assert.equal(index.counts.sharedFoundationCandidates, 1);
  assert.equal(index.counts.excludedAdapterOnly, 1);
  assert.equal(index.counts.excludedProductOwned, 0);
  assert.equal(
    index.candidates.some((group) => group.decision === "adapter_only"),
    false,
  );
  assert.match(authGroup?.customizationReason ?? "", /identity provider/);

  assert.deepEqual(
    validateNormalizationMapLinks(report, {
      capabilities: [
        {
          key: "normalized",
          catalogKey: "function:normalizevalue",
        },
      ],
    }),
    [],
  );
  assert.deepEqual(
    validateNormalizationMapLinks(report, {
      capabilities: [
        {
          key: "renamed",
          catalogKey: "function:normalizevalue",
          sourceName: "wrongName",
        },
        { key: "missing", catalogKey: "function:missing" },
      ],
    }),
    [
      "normalization map capability[0].sourceName does not match function:normalizevalue",
      "normalization map capability[1].catalogKey does not match a report group: function:missing",
    ],
  );
  assert.deepEqual(
    validateNormalizationMapLinks(report, {
      capabilities: [{ key: "custom", status: "customization-required" }],
    }),
    [
      "normalization map capability[0].customizationReason is required for status customization-required",
    ],
  );
});
