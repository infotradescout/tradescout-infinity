import assert from "node:assert/strict";
import test from "node:test";

import type {
  InfinityObjectReference,
  PartnerId,
  ProgramId,
  TenantId,
} from "@tradescout-infinity/contracts";

import {
  MemoryRegistryStore,
  RegistryService,
  SigningKeyRing,
} from "../src/index.js";

const tenantId = "tradescout" as TenantId;
const stone: InfinityObjectReference = {
  tenantId,
  objectType: "stone",
  objectId: "cristallo-backlit" as InfinityObjectReference["objectId"],
};

test("JW Stone attributed Screen Pass resolves current actions and records non-payable evidence", async () => {
  const registry = new RegistryService(
    new MemoryRegistryStore(),
    new SigningKeyRing([
      {
        version: 1,
        secret: "jw-stone-proof-secret-at-least-thirty-two-characters",
        status: "active",
      },
    ]),
  );

  const touch = await registry.recordAttributionTouch({
    tenantId,
    programId: "tradescout-affiliate" as ProgramId,
    partnerId: "jw-stone-proof-partner" as PartnerId,
    carrier: "query_ref",
    target: {
      tenantId,
      object: stone,
      canonicalPath: "/u/jw-stone?stone=cristallo-backlit",
      actionId: "ask-about-stone",
    },
    evidence: {
      affiliateReference: "proof-affiliate-ref",
      source: "attributed_session",
    },
  });

  const issued = await registry.issuePass({
    tenantId,
    object: stone,
    scopes: ["content", "screen", "action", "partner", "version"],
    actions: [
      {
        id: "check-current-availability",
        kind: "check_availability",
        label: "Check Current Availability",
        destination: "/u/jw-stone?stone=cristallo-backlit",
      },
      {
        id: "ask-about-stone",
        kind: "direct_connect",
        label: "Ask About This Stone",
        destination: "/u/jw-stone?stone=cristallo-backlit",
      },
    ],
    attribution: {
      partnerReference: "jw-stone-proof-partner",
      affiliateReference: touch.id,
    },
    objectVersion: "jw-stone:cristallo-backlit:inventory-v1",
  });

  const resolved = await registry.resolve({
    payload: issued.visualPayload,
    expectedTenantId: tenantId,
    currentObjectVersion: "jw-stone:cristallo-backlit:inventory-v1",
  });

  assert.equal(resolved.resolution.authoritative, true);
  assert.equal(resolved.resolution.changed, false);
  assert.equal(resolved.resolution.payableAttribution, false);
  assert.equal(resolved.pass?.object.objectId, "cristallo-backlit");
  assert.equal(
    resolved.pass?.attribution?.partnerReference,
    "jw-stone-proof-partner",
  );
  assert.equal(resolved.pass?.attribution?.affiliateReference, touch.id);
  assert.deepEqual(
    resolved.actions.map((action) => action.label),
    ["Check Current Availability", "Ask About This Stone"],
  );

  const conversion = await registry.recordConversion({
    tenantId,
    object: stone,
    idempotencyKey: "jw-stone-proof:direct-connect-intent",
    eventType: "direct_connect_intent_recorded",
    attributionProofId: issued.pass.publicId,
    attributionAssignmentId: touch.id,
  });

  assert.equal(conversion.created, true);
  assert.equal(conversion.evidence.payoutTriggered, false);

  const replay = await registry.recordConversion({
    tenantId,
    object: stone,
    idempotencyKey: "jw-stone-proof:direct-connect-intent",
    eventType: "direct_connect_intent_recorded",
    attributionProofId: issued.pass.publicId,
    attributionAssignmentId: touch.id,
  });
  assert.equal(replay.created, false);
  assert.equal(replay.evidence.evidenceId, conversion.evidence.evidenceId);
});
