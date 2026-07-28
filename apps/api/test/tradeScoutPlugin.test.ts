import assert from "node:assert/strict";
import test from "node:test";

import type {
  BusinessHubSnapshot,
  ChangeSetReceipt,
  OwnerAuthorization,
} from "@tradescout-infinity/contracts";

import {
  type ChangeSetAnalyzer,
  type TradeScoutOwnerAdapter,
  TradeScoutPluginService,
} from "../src/tradeScoutPlugin.js";

const auth: OwnerAuthorization = {
  subject: "owner_1",
  tenantId: "tenant_1" as any,
  scopes: [
    "business.read",
    "profile.write",
    "services.write",
    "documents.write",
  ],
};

function fixture() {
  let version = "7";
  let applyCalls = 0;
  const hub = (): BusinessHubSnapshot => ({
    business: {
      id: "business_1",
      tenantId: auth.tenantId,
      name: "Acme",
      slug: "acme",
      role: "owner",
      profileVersion: version,
    },
    profile: {},
    services: [],
    products: [],
    inventory: [],
    portfolio: [],
    directConnect: {},
    connections: [],
    versions: { profile: version },
  });
  const adapter: TradeScoutOwnerAdapter = {
    async listBusinesses() {
      return [hub().business];
    },
    async getBusinessHub(_auth, businessId) {
      if (businessId !== "business_1") throw new Error("forbidden");
      return hub();
    },
    async applyChangeSet(input) {
      applyCalls += 1;
      const previous = version;
      version = String(Number(version) + 1);
      return {
        id: "receipt_1",
        proposalId: input.proposal.id,
        businessId: input.proposal.businessId,
        status: "completed",
        appliedActionIds: input.selectedActions.map((action) => action.id),
        failedActions: [],
        previousProfileVersion: previous,
        resultingProfileVersion: version,
        artifactUrls: ["/artifacts/flyer.pdf"],
        liveUrls: ["/r/acme"],
        rollbackToken: "rollback_1",
        createdAt: "2026-07-26T12:01:00.000Z",
      } satisfies ChangeSetReceipt;
    },
  };
  const analyzer: ChangeSetAnalyzer = {
    async analyze(input) {
      return {
        actions: [
          {
            id: "profile",
            kind: "profile.update",
            label: "Update profile",
            selectedByDefault: true,
            requiredScope: "profile.write",
            input: { headline: input.instruction },
            evidenceIds: ["owner_now"],
            warnings: [],
          },
        ],
        evidence: [
          {
            id: "owner_now",
            source: "owner_statement",
            reviewState: "selected",
            statement: input.instruction,
            observedAt: input.now,
          },
        ],
        conflicts: [],
        unknowns: [],
      };
    },
  };
  const service = new TradeScoutPluginService(
    adapter,
    analyzer,
    "s".repeat(32),
    () => new Date("2026-07-26T12:00:00.000Z"),
  );
  return {
    service,
    setVersion: (next: string) => (version = next),
    calls: () => applyCalls,
  };
}

test("prepare signs an expiring owner-bound proposal without applying it", async () => {
  const { service, calls } = fixture();
  const prepared = await service.prepare(auth, {
    businessId: "business_1",
    instruction: "Add spring service",
    files: [],
    expectedProfileVersion: "7",
  });
  assert.equal(prepared.proposal.actions[0]?.kind, "profile.update");
  assert.equal(prepared.proposal.expiresAt, "2026-07-26T12:15:00.000Z");
  assert.equal(calls(), 0);
});

test("publish enforces version, selection, scopes and idempotency", async () => {
  const { service, calls } = fixture();
  const prepared = await service.prepare(auth, {
    businessId: "business_1",
    instruction: "Add spring service",
    files: [],
    expectedProfileVersion: "7",
  });
  const request = {
    proposalToken: prepared.proposalToken,
    selectedActionIds: ["profile"],
    expectedProfileVersion: "7",
    idempotencyKey: "idem-12345",
    authorizedTargetConnectionIds: [],
    publishAt: "now" as const,
  };
  const first = await service.publish(auth, request);
  const replay = await service.publish(auth, request);
  assert.equal(first.id, replay.id);
  assert.equal(calls(), 1);
});

test("publish rejects a stale Business Profile version", async () => {
  const { service, setVersion } = fixture();
  const prepared = await service.prepare(auth, {
    businessId: "business_1",
    instruction: "Add spring service",
    files: [],
    expectedProfileVersion: "7",
  });
  setVersion("8");
  await assert.rejects(
    service.publish(auth, {
      proposalToken: prepared.proposalToken,
      selectedActionIds: ["profile"],
      expectedProfileVersion: "7",
      idempotencyKey: "idem-12345",
      authorizedTargetConnectionIds: [],
      publishAt: "now",
    }),
    /profile_version_conflict/,
  );
});
