import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const sourcePath = new URL("./source.json", import.meta.url);
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const copiedPlugin = new URL(
  "../../plugins/selective-intelligence",
  import.meta.url,
);

test("SI remains an immutable external integration", () => {
  assert.equal(source.name, "selective-intelligence");
  assert.equal(source.source, "github:infotradescout/Selective-Intelligence");
  assert.match(source.expectedSkillVersion, /^\d+\.\d+\.\d+$/);
  assert.match(source.publicDirectoryVersion, /^\d+\.\d+\.\d+$/);
  assert.match(source.pinnedCommit, /^[0-9a-f]{40}$/);
  assert.equal(existsSync(copiedPlugin), false);
});

test("the canonical SI source is available without an Infinity-owned copy", () => {
  assert.equal(source.installable, true);
  assert.equal(source.status, "public_repository_release_candidate");
});
