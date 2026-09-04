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

test("vocabulary separates identity, presentation, authority, and money", async () => {
  const vocabulary = await readJson("./vocabulary.json");
  const terms = new Map(vocabulary.terms.map((entry) => [entry.term, entry]));

  assert.equal(
    vocabulary.decisionState,
    "draft-target-from-repository-evidence",
  );
  assert.equal(terms.size, vocabulary.terms.length);

  for (const required of [
    "person",
    "account",
    "product-membership",
    "business",
    "profile",
    "role",
    "connection",
    "request",
    "job",
    "project",
    "property",
    "asset",
    "estimate",
    "payment",
    "verification",
  ]) {
    assert.ok(terms.has(required), `missing vocabulary term: ${required}`);
  }

  assert.match(terms.get("profile").meaning, /not the identity/i);
  assert.match(terms.get("role").meaning, /not a human type/i);
  assert.match(terms.get("payment").meaning, /movement of money/i);
  assert.match(
    terms.get("verification").meaning,
    /specific subject and claim/i,
  );
});

test("identity remains unassigned until product boundaries are proved", async () => {
  const [identity, convergence] = await Promise.all([
    readJson("./identity-boundaries.json"),
    readJson("./convergence.json"),
  ]);
  const systems = new Map(
    identity.currentSystems.map((entry) => [entry.repository, entry]),
  );
  const mealScoutAuth = convergence.records.find(
    (record) => record.id === "mealscout-auth-owner",
  );

  assert.equal(identity.canonicalOwner, null);
  assert.equal(identity.decisionState, "evidence-mapped-owner-required");
  assert.equal(
    systems.get("infotradescout/tradescout-infinity").disposition,
    "registry-not-default-identity-runtime",
  );
  assert.ok(
    identity.invariants.some((rule) => /profile.*never.*identity/i.test(rule)),
  );
  assert.ok(
    identity.invariants.some((rule) => /email coincidence/i.test(rule)),
  );
  assert.ok(identity.riskRegister.every((risk) => risk.requiredProof));
  assert.equal(mealScoutAuth.implementationOwner, "server/unifiedAuth.ts");
  assert.match(mealScoutAuth.dependsOn, /MealScout\/pull\/370$/);
  assert.ok(
    mealScoutAuth.retired.includes(
      "silent email-based cross-product account linking",
    ),
  );
  assert.match(
    systems.get("infotradescout/MealScout").migrationEvidence,
    /MealScout\/pull\/371$/,
  );
});
