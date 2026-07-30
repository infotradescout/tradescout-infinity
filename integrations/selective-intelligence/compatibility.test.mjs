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
  assert.equal(source.source, "github:Platynum-47/Selective-Intelligence");
  assert.equal(source.expectedPluginVersion, "0.2.0");
  assert.match(source.pinnedCommit, /^[0-9a-f]{40}$/);
  assert.equal(existsSync(copiedPlugin), false);
});

test("an unpublished SI release is not advertised as installable", () => {
  if (source.status === "awaiting_canonical_release") {
    assert.equal(source.installable, false);
    assert.ok(source.blocker);
    assert.match(source.blocker, /model\/client behavior evidence/i);
  }
});
