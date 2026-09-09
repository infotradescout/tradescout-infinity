import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog, Descriptor } from "../src/index.js";
import {
  findImplementations,
  implementationIndex,
  implementationMarkdown,
} from "../src/implementations.js";

const hash = (text: string): string =>
  createHash("sha256").update(text).digest("hex");
function occurrence(overrides: Partial<Descriptor> = {}): Descriptor {
  return {
    name: "readValue",
    kind: "function",
    category: ["utility"],
    path: "src/read.ts",
    line: 1,
    repository: "alpha",
    revision: "a".repeat(40),
    revisionVerified: true,
    dirty: false,
    fileSha256: hash("first file"),
    symbolSha256: hash("function readValue() { return value; }"),
    imports: [],
    risk: "low",
    disposition: "candidate",
    ...overrides,
  };
}
function catalog(descriptors: Descriptor[]): Catalog {
  return {
    schemaVersion: 2,
    generatedAt: "2026-09-08T00:00:00Z",
    sources: [],
    descriptors,
    duplicates: [],
    nameCollisions: [],
  };
}

test("folds equal declarations across differing files while preserving all provenance", () => {
  const first = occurrence();
  const second = occurrence({
    repository: "beta",
    path: "lib/copied.js",
    line: 42,
    fileSha256: hash("different file"),
  });
  const sameNameDifferentBody = occurrence({
    path: "src/other.ts",
    symbolSha256: hash("function readValue() { return 7; }"),
  });
  const index = implementationIndex(
    catalog([second, sameNameDifferentBody, first]),
  );
  assert.deepEqual(index.summary, {
    observations: 3,
    comparedObservations: 3,
    exactTextGroups: 2,
    repeatedTextGroups: 1,
    repeatedObservations: 1,
    uncomparedObservations: 0,
    observationsAfterTextGrouping: 2,
    verifiedUniqueCapabilities: null,
  });
  const repeated = index.groups.find((group) => group.count === 2)!;
  assert.deepEqual(repeated.evidence, [first, second]);
  assert.deepEqual(repeated.repositories, ["alpha", "beta"]);
  assert.deepEqual(repeated.names, ["readValue"]);
  assert.equal(index.generatedAt, "2026-09-08T00:00:00Z");
  assert.match(
    implementationMarkdown(index),
    /does not prove interchangeable behavior/,
  );
  assert.match(implementationMarkdown(index), /beta:lib\/copied.js:42/);
});

test("retains Python prefixes, domain fallbacks and unsafe occurrences individually", () => {
  const descriptors = [
    occurrence({ path: "one.py" }),
    occurrence({ path: "two.py" }),
    occurrence({ kind: "domain", path: "src/domain.ts" }),
    occurrence({ dirty: true }),
    occurrence({ revisionVerified: false }),
    occurrence({ path: "module.rb" }),
    occurrence({ symbolSha256: "prefix" }),
  ];
  const index = implementationIndex(catalog(descriptors));
  assert.equal(index.groups.length, 0);
  assert.equal(index.uncompared.length, descriptors.length);
  assert.equal(index.summary.observationsAfterTextGrouping, descriptors.length);
  assert.equal(index.summary.repeatedObservations, 0);
  assert.equal(
    index.uncompared.filter((item) => item.reason.includes("Python")).length,
    2,
  );
  assert.ok(
    index.uncompared.some((item) => item.reason.includes("Domain fallback")),
  );
  assert.ok(index.uncompared.some((item) => item.reason.includes("Dirty")));
  assert.ok(
    index.uncompared.some((item) => item.reason.includes("Unverified")),
  );
  for (const descriptor of descriptors)
    assert.ok(index.uncompared.some((item) => item.descriptor === descriptor));
});

test("exact text carries dependency and product review reasons", () => {
  const first = occurrence({ imports: ["z", "./provider", "z"] });
  const second = occurrence({
    path: "tests/helper.ts",
    imports: ["./other"],
    disposition: "adapter-only",
    risk: "high",
  });
  const group = implementationIndex(catalog([first, second])).groups[0]!;
  assert.deepEqual(group.importVariants, [["./other"], ["./provider", "z"]]);
  assert.match(
    group.reviewReasons.join(" "),
    /Captured variables and resolved dependencies/,
  );
  assert.match(group.reviewReasons.join(" "), /import lists differ/);
  assert.match(group.reviewReasons.join(" "), /Restricted product or adapter/);
  assert.match(group.reviewReasons.join(" "), /Test or helper context/);
  assert.deepEqual(first.imports, ["z", "./provider", "z"]);
  const single = implementationIndex(catalog([occurrence()])).groups[0]!;
  assert.match(
    single.reviewReasons.join(" "),
    /Captured variables and resolved dependencies/,
  );
});

test("grouping and markdown are deterministic regardless of observation order", () => {
  const descriptors = [
    occurrence({ repository: "zeta" }),
    occurrence({ kind: "class" }),
    occurrence({ path: "legacy.py" }),
    occurrence({ path: "src/b.ts" }),
    occurrence(),
  ];
  const before = structuredClone(descriptors);
  const forward = implementationIndex(catalog(descriptors));
  const reverse = implementationIndex(catalog([...descriptors].reverse()));
  assert.deepEqual(forward, reverse);
  assert.equal(
    implementationMarkdown(forward),
    implementationMarkdown(reverse),
  );
  assert.deepEqual(descriptors, before);
  assert.equal(
    forward.groups.length,
    2,
    "kind remains part of the text-group identity",
  );
});

test("query filters correlate on one occurrence and preserve the complete group", () => {
  const low = occurrence({ category: ["utility"] });
  const high = occurrence({
    repository: "beta",
    name: "ReadAlias",
    category: ["auth"],
    risk: "high",
    disposition: "adapter-only",
  });
  const index = implementationIndex(catalog([low, high]));
  for (const query of [
    { repository: "alpha", category: "auth" },
    { repository: "alpha", risk: "high" as const },
    { repository: "alpha", disposition: "adapter-only" as const },
    { repository: "alpha", name: "alias" },
    { kind: "class" as const },
  ])
    assert.deepEqual(findImplementations(index, query), []);
  const matched = findImplementations(index, {
    repository: "beta",
    name: "ALIAS",
    category: "auth",
    kind: "function",
    risk: "high",
    disposition: "adapter-only",
  });
  assert.equal(matched.length, 1);
  assert.deepEqual(matched[0]!.evidence, [low, high]);
  assert.deepEqual(findImplementations(index), index.groups);
});

test("markdown lists at most thirty repeated groups with the largest first", () => {
  const descriptors = Array.from({ length: 32 }, (_, number) => {
    const item = occurrence({
      name: `item${number}`,
      symbolSha256: hash(`body${number}`),
    });
    return [item, { ...item, path: "copy.ts" }];
  }).flat();
  descriptors.push(
    occurrence({
      name: "item31",
      symbolSha256: hash("body31"),
      path: "third.ts",
    }),
  );
  const markdown = implementationMarkdown(
    implementationIndex(catalog(descriptors)),
  );
  const rows = markdown.split("\n").filter((line) => line.startsWith("| item"));
  assert.equal(rows.length, 30);
  assert.match(rows[0]!, /^\| item31 \|/);
});

test("query CLI preserves raw results and exposes grouped and uncompared occurrences", async () => {
  const root = await mkdtemp(join(tmpdir(), "infinity-implementation-query-"));
  const filename = join(root, "catalog.json");
  const cli = fileURLToPath(new URL("../src/query-cli.js", import.meta.url));
  const first = occurrence({ path: "src/read.js" });
  const second = occurrence({
    repository: "beta",
    path: "src/copy.js",
    fileSha256: hash("another file"),
  });
  const python = occurrence({ name: "pythonReader", path: "reader.py" });
  const snapshot = catalog([first, second, python]);
  await writeFile(filename, JSON.stringify(snapshot));
  const run = (...args: string[]) =>
    JSON.parse(
      execFileSync(process.execPath, [cli, filename, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );

  assert.deepEqual(run(), snapshot.descriptors);
  assert.deepEqual(run("repository=beta"), [second]);
  const grouped = run("view=implementations", "name=readValue");
  assert.equal(grouped.view, "implementations");
  assert.equal(grouped.catalogSnapshot, snapshot.generatedAt);
  assert.equal(grouped.groups.length, 1);
  assert.deepEqual(grouped.groups[0].evidence, [first, second]);
  assert.deepEqual(grouped.uncompared, []);
  assert.match(grouped.note, /equivalence.*unverified/);

  const legacy = run("--view=implementations", "name=pythonReader");
  assert.deepEqual(legacy.groups, []);
  assert.equal(legacy.uncompared.length, 1);
  assert.deepEqual(legacy.uncompared[0].descriptor, python);
  assert.match(legacy.uncompared[0].reason, /Python.*prefixes/);

  const jsonQuery = run(
    JSON.stringify({
      view: "implementations",
      repository: "beta",
      name: "readValue",
    }),
  );
  assert.deepEqual(jsonQuery.groups, grouped.groups);
  assert.deepEqual(jsonQuery.uncompared, []);
  assert.throws(
    () => run("view=unknown"),
    /view must be occurrences or implementations/,
  );
});
