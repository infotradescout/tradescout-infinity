import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  implementationIndex,
  normalizationKey,
  normalizationReport,
} from "../dist/src/index.js";
import {
  declarationComparisonBlocker,
  isTestContext,
} from "../dist/src/implementations.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = readJson(resolve(root, "ecosystem/catalog-snapshot.json"));
const inputPath = resolve(root, manifest.input);
const bytes = readFileSync(inputPath);
assert.equal(hash(bytes), manifest.sha256, "saved input digest");
assert.equal(bytes.length, manifest.bytes, "saved input byte length");
const catalog = JSON.parse(bytes);
assert.equal(catalog.schemaVersion, manifest.catalogSchemaVersion);
assert.equal(catalog.generatedAt, manifest.snapshotGeneratedAt);
assert.equal(catalog.descriptors.length, manifest.observations);
assert.equal(catalog.sources.length, manifest.sourceRecords);

const generated = implementationIndex(catalog);
const saved = readJson(resolve(root, "ecosystem/implementation-index.json"));
assert.deepEqual(saved, generated, "derived grouping must reproduce");
assert.equal(saved.summary.verifiedUniqueCapabilities, null);

// A multiset comparison checks duplicate occurrences as well as unique paths.
// No source observation may be dropped, fabricated, or silently deduplicated.
const remaining = new Map();
for (const descriptor of catalog.descriptors) {
  const key = JSON.stringify(descriptor);
  remaining.set(key, (remaining.get(key) ?? 0) + 1);
}
const retain = (descriptor) => {
  const key = JSON.stringify(descriptor);
  const count = remaining.get(key) ?? 0;
  assert.ok(count > 0, "grouped evidence must belong to the input multiset");
  if (count === 1) remaining.delete(key);
  else remaining.set(key, count - 1);
};
const names = new Map();
let compared = 0;
for (const group of saved.groups) {
  assert.equal(group.count, group.evidence.length);
  assert.equal(group.key, `${group.kind}:${group.symbolSha256}`);
  assert.ok(
    group.reviewReasons.length > 0,
    "text equality retains review limits",
  );
  for (const descriptor of group.evidence) {
    assert.equal(declarationComparisonBlocker(descriptor), undefined);
    assert.equal(descriptor.kind, group.kind);
    assert.equal(descriptor.symbolSha256.toLowerCase(), group.symbolSha256);
    retain(descriptor);
    compared++;
    const variants = names.get(descriptor.name) ?? new Set();
    variants.add(group.key);
    names.set(descriptor.name, variants);
  }
}
for (const { descriptor, reason } of saved.uncompared) {
  assert.ok(declarationComparisonBlocker(descriptor));
  assert.ok(reason.length > 0);
  retain(descriptor);
}
assert.equal(
  remaining.size,
  0,
  "every original occurrence is retained exactly",
);
assert.equal(compared, saved.summary.comparedObservations);
assert.equal(compared + saved.uncompared.length, catalog.descriptors.length);
assert.equal(
  compared - saved.groups.length,
  saved.summary.repeatedObservations,
);
assert.equal(saved.groups.length, saved.summary.exactTextGroups);
assert.equal(saved.uncompared.length, saved.summary.uncomparedObservations);
assert.equal(
  saved.groups.length + saved.uncompared.length,
  saved.summary.observationsAfterTextGrouping,
);

const report = normalizationReport(catalog);
assert.deepEqual(
  readJson(resolve(root, "ecosystem/normalization-report.json")),
  report,
  "normalization decisions must reproduce from the same saved observations",
);
const byName = new Map();
for (const descriptor of catalog.descriptors) {
  const key = normalizationKey(descriptor);
  const members = byName.get(key) ?? [];
  members.push(descriptor);
  byName.set(key, members);
}
let canonicalGroups = 0;
for (const group of report.groups.items) {
  if (group.decision !== "shared_canonical") continue;
  canonicalGroups++;
  const members = byName.get(group.key);
  assert.ok(members?.length);
  assert.ok(
    members.every(
      (item) =>
        item.repository === "infinity-canonical" &&
        /^packages\/(?:contracts|provider-core|auth-core|affiliate-core|ui-core)\/src\//.test(
          item.path,
        ) &&
        !isTestContext(item.path) &&
        declarationComparisonBlocker(item) === undefined,
    ),
    "canonical labels require the entire group to have a complete shared source owner",
  );
  assert.equal(new Set(members.map((item) => item.symbolSha256)).size, 1);
}

const query = JSON.parse(
  execFileSync(
    process.execPath,
    [
      resolve(root, "packages/capability-catalog/dist/src/query-cli.js"),
      inputPath,
      "view=implementations",
      "name=cleanString",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8_000_000,
    },
  ),
);
assert.deepEqual(
  query.groups,
  saved.groups.filter((group) =>
    group.evidence.some((item) => /cleanString/i.test(item.name)),
  ),
  "the real query command preserves all matching variants and their locations",
);
assert.equal(hash(readFileSync(inputPath)), manifest.sha256);
console.log(
  JSON.stringify(
    {
      checkedAtUtc: new Date().toISOString(),
      inputSha256: manifest.sha256,
      inputUnchanged: true,
      grouping: saved.summary,
      retainedObservations: catalog.descriptors.length,
      nameGroupsWithDistinctText: [...names.values()].filter(
        (variants) => variants.size > 1,
      ).length,
      canonicalGroupsChecked: canonicalGroups,
      queryVariantGroups: query.groups.length,
      queryEvidenceLocations: query.groups.reduce(
        (count, group) => count + group.evidence.length,
        0,
      ),
      result: "pass",
      boundary:
        "Saved metadata replay only. No source recrawl, behavioral equivalence, consumer migration, or live integration is established.",
    },
    null,
    2,
  ),
);
