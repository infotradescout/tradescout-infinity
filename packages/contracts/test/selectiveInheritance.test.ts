import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSelectiveInheritance,
  type SelectiveInheritancePolicy,
  type SelectiveInheritanceRequest,
} from "../src/index.js";

const tenantId = "tenant_tradescout" as any;
const target = {
  tenantId,
  objectType: "public_profile",
  objectId: "profile_123" as any,
};

const policy: SelectiveInheritancePolicy = {
  id: "profile-selective-inheritance",
  tenantId,
  objectType: "public_profile",
  version: "1",
  status: "active",
  defaultAction: "exclude",
  fields: [
    {
      field: "credentials",
      action: "inherit",
      allowedSourceKinds: ["owner_verified", "public_credential"],
      minimumConfidence: 0.9,
      requireVerifiedEvidence: true,
      sourcePriority: ["owner_verified", "public_credential"],
    },
    {
      field: "hero",
      action: "exclude",
      allowedSourceKinds: [],
      minimumConfidence: 1,
      requireVerifiedEvidence: true,
      sourcePriority: [],
    },
    {
      field: "logo",
      action: "inherit",
      allowedSourceKinds: ["screen_pass", "public_website"],
      minimumConfidence: 0.85,
      requireVerifiedEvidence: true,
      sourcePriority: ["screen_pass", "public_website"],
    },
  ],
};

function request(
  changes: Partial<SelectiveInheritanceRequest> = {},
): SelectiveInheritanceRequest {
  return {
    evaluationId: "evaluation_1",
    tenantId,
    target,
    targetVersion: "profile-v2",
    policy,
    candidates: [],
    overrides: [],
    evaluatedAt: "2026-07-19T16:00:00.000Z",
    ...changes,
  };
}

test("fails closed for fields that are not allowlisted", () => {
  const result = evaluateSelectiveInheritance(
    request({
      candidates: [
        {
          field: "privateNotes",
          value: "never copy this",
          sourceKind: "public_website",
          sourceReference: "https://example.com",
          evidenceDigest: "sha256:private",
          observedAt: "2026-07-19T15:00:00.000Z",
          confidence: 1,
          verified: true,
        },
      ],
    }),
  );

  assert.deepEqual(result.decisions, [
    {
      field: "credentials",
      status: "unresolved",
      reasonCodes: ["no_eligible_evidence"],
    },
    {
      field: "hero",
      status: "excluded",
      reasonCodes: ["field_excluded_by_policy"],
    },
    {
      field: "logo",
      status: "unresolved",
      reasonCodes: ["no_eligible_evidence"],
    },
    {
      field: "privateNotes",
      status: "excluded",
      reasonCodes: ["field_not_allowlisted"],
    },
  ]);
  assert.equal(result.applyAuthorized, false);
});

test("prefers explicit local overrides over inherited evidence", () => {
  const result = evaluateSelectiveInheritance(
    request({
      candidates: [
        {
          field: "credentials",
          value: ["License A"],
          sourceKind: "public_credential",
          sourceReference: "credential:state",
          evidenceDigest: "sha256:source",
          observedAt: "2026-07-19T15:00:00.000Z",
          confidence: 0.99,
          verified: true,
        },
      ],
      overrides: [
        {
          field: "credentials",
          value: ["License B"],
          reason: "Owner supplied current credential",
          evidenceDigest: "sha256:override",
          actorReference: "actor:owner",
          authorizedAt: "2026-07-19T15:30:00.000Z",
        },
      ],
    }),
  );

  assert.deepEqual(
    result.decisions.find((decision) => decision.field === "credentials"),
    {
      field: "credentials",
      status: "overridden",
      value: ["License B"],
      evidenceDigest: "sha256:override",
      reasonCodes: ["explicit_local_override"],
    },
  );
});

test("Screen Pass identifies evidence but cannot authorize inheritance alone", () => {
  const result = evaluateSelectiveInheritance(
    request({
      candidates: [
        {
          field: "logo",
          value: "https://cdn.example.com/logo.png",
          sourceKind: "screen_pass",
          sourceReference: "screen-pass:source",
          evidenceDigest: "sha256:pass",
          observedAt: "2026-07-19T15:00:00.000Z",
          confidence: 1,
          verified: true,
          screenPass: {
            publicId: "pass_01J00000000000000000000000" as any,
            authoritative: false,
            changed: false,
          },
        },
      ],
    }),
  );

  assert.deepEqual(
    result.decisions.find((decision) => decision.field === "logo"),
    {
      field: "logo",
      status: "unresolved",
      reasonCodes: ["screen_pass_not_authoritative"],
    },
  );
  assert.equal(result.applyAuthorized, false);
});

test("accepts a current authoritative Screen Pass under an active field policy", () => {
  const publicId = "pass_01J00000000000000000000000" as any;
  const result = evaluateSelectiveInheritance(
    request({
      candidates: [
        {
          field: "logo",
          value: "https://cdn.example.com/logo.png",
          sourceKind: "screen_pass",
          sourceReference: "screen-pass:source",
          evidenceDigest: "sha256:pass",
          observedAt: "2026-07-19T15:00:00.000Z",
          confidence: 1,
          verified: true,
          screenPass: {
            publicId,
            authoritative: true,
            changed: false,
          },
        },
      ],
    }),
  );

  assert.deepEqual(
    result.decisions.find((decision) => decision.field === "logo"),
    {
      field: "logo",
      status: "inherited",
      value: "https://cdn.example.com/logo.png",
      sourceReference: "screen-pass:source",
      evidenceDigest: "sha256:pass",
      screenPassPublicId: publicId,
      reasonCodes: ["highest_priority_eligible_evidence"],
    },
  );
  assert.equal(result.applyAuthorized, false);
});
