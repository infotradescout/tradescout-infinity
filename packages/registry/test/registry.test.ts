import assert from "node:assert/strict";
import test from "node:test";

import type {
  InfinityObjectReference,
  PartnerId,
  ProgramId,
  TenantId,
  VisualPassPayload,
} from "@tradescout-infinity/contracts";

import {
  MemoryRegistryStore,
  RegistryService,
  SigningKeyRing,
} from "../src/index.js";

const tenantA = "tenant_a" as TenantId;
const tenantB = "tenant_b" as TenantId;
const objectA: InfinityObjectReference = {
  tenantId: tenantA,
  objectType: "stone",
  objectId: "cristallo-backlit" as InfinityObjectReference["objectId"],
};

function service(keys?: SigningKeyRing) {
  return new RegistryService(
    new MemoryRegistryStore(),
    keys ??
      new SigningKeyRing([
        {
          version: 1,
          secret: "test-secret-that-is-at-least-thirty-two-characters",
          status: "active",
        },
      ]),
  );
}

async function issue(registry = service(), expiresAt?: string) {
  const issued = await registry.issuePass({
    tenantId: tenantA,
    object: objectA,
    scopes: ["content", "screen", "action", "partner", "version"],
    actions: [
      {
        id: "ask-about-stone",
        kind: "direct_connect",
        label: "Ask About This Stone",
        destination: "/u/jw-stone?stone=cristallo-backlit",
      },
    ],
    attribution: { partnerReference: "partner_opaque" },
    objectVersion: "inventory-v1",
    renderedAt: "2026-07-18T12:00:00.000Z",
    ...(expiresAt ? { expiresAt } : {}),
  });
  return { registry, issued };
}

test("signed pass round-trip restores the exact safe action", async () => {
  const { registry, issued } = await issue();
  const result = await registry.resolve({
    payload: issued.visualPayload,
    currentObjectVersion: "inventory-v1",
    now: "2026-07-18T13:00:00.000Z",
  });
  assert.equal(result.resolution.authoritative, true);
  assert.equal(result.resolution.payableAttribution, false);
  assert.equal(result.resolution.changed, false);
  assert.deepEqual(result.resolution.safeActionIds, ["ask-about-stone"]);
  assert.equal(
    result.actions[0]?.destination,
    "/u/jw-stone?stone=cristallo-backlit",
  );
});

test("modified signatures fail closed", async () => {
  const { registry, issued } = await issue();
  const payload: VisualPassPayload = {
    ...issued.visualPayload,
    signature: `${issued.visualPayload.signature.slice(0, -1)}x`,
  };
  const result = await registry.resolve({ payload });
  assert.equal(result.resolution.authoritative, false);
  assert.deepEqual(result.resolution.reasons, ["invalid_signature"]);
});

test("expired and revoked passes return no actions", async () => {
  const expiring = await issue(service(), "2026-07-18T12:30:00.000Z");
  const expired = await expiring.registry.resolve({
    payload: expiring.issued.visualPayload,
    now: "2026-07-18T13:00:00.000Z",
  });
  assert.equal(expired.resolution.authoritative, false);
  assert.deepEqual(expired.actions, []);

  const active = await issue();
  await active.registry.revokePass(tenantA, active.issued.pass.publicId);
  const revoked = await active.registry.resolve({
    payload: active.issued.visualPayload,
  });
  assert.equal(revoked.resolution.authoritative, false);
  assert.deepEqual(revoked.resolution.reasons, ["revoked_pass"]);
});

test("tenant isolation applies to reads, revocation, and resolution", async () => {
  const { registry, issued } = await issue();
  assert.equal(await registry.getPass(tenantB, issued.pass.publicId), null);
  assert.equal(await registry.revokePass(tenantB, issued.pass.publicId), null);
  const result = await registry.resolve({
    payload: issued.visualPayload,
    expectedTenantId: tenantB,
  });
  assert.equal(result.resolution.authoritative, false);
  assert.deepEqual(result.resolution.reasons, ["tenant_mismatch"]);
});

test("key rotation verifies old passes while issuing with the active version", async () => {
  const oldKeys = new SigningKeyRing([
    {
      version: 1,
      secret: "old-secret-that-is-at-least-thirty-two-characters",
      status: "active",
    },
  ]);
  const store = new MemoryRegistryStore();
  const oldService = new RegistryService(store, oldKeys);
  const issued = await oldService.issuePass({
    tenantId: tenantA,
    object: objectA,
    scopes: ["screen"],
    actions: [],
    objectVersion: "v1",
  });

  const rotated = new RegistryService(
    store,
    new SigningKeyRing([
      {
        version: 1,
        secret: "old-secret-that-is-at-least-thirty-two-characters",
        status: "verify_only",
      },
      {
        version: 2,
        secret: "new-secret-that-is-at-least-thirty-two-characters",
        status: "active",
      },
    ]),
  );
  const oldResolution = await rotated.resolve({
    payload: issued.visualPayload,
  });
  assert.equal(oldResolution.resolution.authoritative, true);
  const next = await rotated.issuePass({
    tenantId: tenantA,
    object: objectA,
    scopes: ["screen"],
    actions: [],
    objectVersion: "v2",
  });
  assert.equal(next.visualPayload.signatureVersion, 2);
});

test("blocked and duplicate actions are rejected at issuance", async () => {
  const registry = service();
  await assert.rejects(
    registry.issuePass({
      tenantId: tenantA,
      object: objectA,
      scopes: ["action"],
      actions: [
        {
          id: "admin",
          kind: "open",
          label: "Admin",
          destination: "/admin/users",
        },
      ],
      objectVersion: "v1",
    }),
    /blocked action/,
  );
  await assert.rejects(
    registry.issuePass({
      tenantId: tenantA,
      object: objectA,
      scopes: ["action"],
      actions: [
        { id: "same", kind: "open", label: "One", destination: "/one" },
        { id: "same", kind: "open", label: "Two", destination: "/two" },
      ],
      objectVersion: "v1",
    }),
    /unique/,
  );
});

test("conversion evidence is idempotent and rejects payload drift", async () => {
  const registry = service();
  const input = {
    tenantId: tenantA,
    object: objectA,
    idempotencyKey: "checkout:invoice_123",
    eventType: "request_created",
    occurredAt: "2026-07-18T13:00:00.000Z",
  };
  const first = await registry.recordConversion(input);
  const replay = await registry.recordConversion(input);
  assert.equal(first.created, true);
  assert.equal(replay.created, false);
  assert.equal(replay.evidence.evidenceId, first.evidence.evidenceId);
  assert.equal(replay.evidence.payoutTriggered, false);

  await assert.rejects(
    registry.recordConversion({ ...input, eventType: "signup_completed" }),
    /different payload/,
  );
});

test("objects cannot cross authenticated tenant boundaries", async () => {
  const registry = service();
  await assert.rejects(
    registry.issuePass({
      tenantId: tenantB,
      object: objectA,
      scopes: ["screen"],
      actions: [],
      objectVersion: "v1",
    }),
    /does not match/,
  );
  await assert.rejects(
    registry.recordConversion({
      tenantId: tenantB,
      object: objectA,
      idempotencyKey: "event_123",
      eventType: "request_created",
    }),
    /does not match/,
  );
});

test("attribution touches are tenant-bound and non-payable observations", async () => {
  const registry = service();
  const touch = await registry.recordAttributionTouch({
    tenantId: tenantA,
    programId: "trade-partners" as ProgramId,
    partnerId: "partner-1" as PartnerId,
    carrier: "query_ref",
    target: {
      tenantId: tenantA,
      object: objectA,
      canonicalPath: "/profile/plumber-1",
    },
    evidence: { affiliateTag: "REAL2026ABCD12" },
  });
  assert.equal(touch.verified, false);
  assert.equal(touch.tenantId, tenantA);

  await assert.rejects(
    registry.recordAttributionTouch({
      tenantId: tenantA,
      programId: "trade-partners" as ProgramId,
      partnerId: "partner-1" as PartnerId,
      carrier: "query_ref",
      target: {
        tenantId: tenantB,
        object: objectA,
        canonicalPath: "/profile/1",
      },
      evidence: {},
    }),
    /tenant/i,
  );
});
