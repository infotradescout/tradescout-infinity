import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  assert.match(source.expectedPluginVersion, /^\d+\.\d+\.\d+$/);
  assert.match(source.pinnedCommit, /^[0-9a-f]{40}$/);
  assert.equal(existsSync(copiedPlugin), false);
});

test("an unverified SI consumer is not advertised as installed or installable", () => {
  assert.equal(source.status, "installation_unverified");
  assert.equal(source.installable, false);
  assert.ok(source.blocker);
});

test(
  "the canonical checkout contains the declared pinned SI version",
  {
    skip:
      !process.env.SI_SOURCE_ROOT &&
      "Canonical SI checkout is not configured for this verification",
  },
  () => {
    assert.match(source.pinnedCommit, /^[0-9a-f]{40}$/);
    const readPinned = (file) =>
      execFileSync("git", ["show", `${source.pinnedCommit}:${file}`], {
        cwd: process.env.SI_SOURCE_ROOT,
        encoding: "utf8",
        maxBuffer: 128 * 1024,
      });
    assert.equal(
      readPinned("skills/selective-intelligence/VERSION").trim(),
      source.expectedPluginVersion,
    );
    const plugin = JSON.parse(readPinned("plugin-submission/plugin.json"));
    assert.equal(plugin.name, source.name);
    assert.equal(plugin.version, source.expectedPluginVersion);
    assert.equal(
      plugin.repository,
      `https://github.com/${source.source.slice("github:".length)}`,
    );
  },
);
