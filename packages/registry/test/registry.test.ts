import assert from "node:assert/strict";
import test from "node:test";

import type {
  InfinityObjectReference,
  PartnerId,
  ProgramId,
  TenantId,
} from "@tradescout-infinity/contracts";

import { MemoryRegistryStore, RegistryService } from "../src/index.js";

const tenantA = "tenant_a" as TenantId;
const tenantB = "tenant_b" as TenantId;
const objectA: InfinityObjectReference = {
  tenantId: tenantA,
  objectType: "stone",
  objectId: "cristallo-backlit" as InfinityObjectReference["objectId"],
};

function service() {
  return new RegistryService(new MemoryRegistryStore());
}

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
