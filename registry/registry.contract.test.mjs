import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(new URL(relativePath, import.meta.url), "utf8"),
  );
}

test("the ecosystem register preserves canonical ownership and delivery truth", async () => {
  const [ecosystem, capabilities, convergence] = await Promise.all([
    readJson("./ecosystem.json"),
    readJson("./capabilities.json"),
    readJson("./convergence.json"),
  ]);

  const repositories = new Set(
    ecosystem.repositories.map((entry) => entry.repository),
  );
  const screenPass = capabilities.capabilities.find(
    (capability) => capability.id === "screen-pass",
  );

  assert.equal(screenPass.canonicalOwner, "infotradescout/continuum");
  assert.equal(screenPass.state, "canonical-dormant");

  for (const record of convergence.records) {
    assert.equal(record.deliveryState, "draft");
    assert.ok(record.evidence.length > 0);

    if (record.repository) {
      assert.ok(repositories.has(record.repository));
    }

    if (record.canonicalOwner) {
      assert.ok(repositories.has(record.canonicalOwner));
    }

    for (const evidence of record.evidence) {
      assert.ok(repositories.has(evidence.repository));
      assert.equal(evidence.state, "open");
      assert.match(evidence.url, /\/pull\/\d+$/);
    }
  }
});

test("component convergence records remain inputs, not false ecosystem owners", async () => {
  const [capabilities, convergence] = await Promise.all([
    readJson("./capabilities.json"),
    readJson("./convergence.json"),
  ]);
  const experienceSystem = capabilities.capabilities.find(
    (capability) => capability.id === "experience-system",
  );
  const componentRecords = convergence.records.filter(
    (record) => record.scope === "product-component-ownership",
  );

  assert.equal(experienceSystem.canonicalOwner, null);
  assert.equal(experienceSystem.state, "owner-required");
  assert.deepEqual(componentRecords.map((record) => record.product).sort(), [
    "MealScout",
    "TradeScout",
  ]);
  assert.ok(
    componentRecords.every(
      (record) => record.selectiveIntelligence.duplicateOwnerErrorsAfter === 0,
    ),
  );
});
