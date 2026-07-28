import assert from "node:assert/strict";
import test from "node:test";

import {
  assertConversionEvidence,
  assertPartnerProgram,
  assertResolutionTrust,
  assertRewardDecision,
  filterAllowlistedActions,
  isResolutionMethod,
  methodCanBeAuthoritative,
  validateVisualPayload,
  type ConversionEvidence,
  type PartnerProgram,
  type RewardDecision,
  type ScreenPassResolution,
} from "../src/index.js";

const ids = {
  tenantId: "tenant_test" as any,
  programId: "program_test" as any,
};

test("accepts the compact signed visual payload", () => {
  assert.doesNotThrow(() =>
    validateVisualPayload({
      publicId: "pass_01J00000000000000000000000",
      signatureVersion: 1,
      signature: "a".repeat(64),
    }),
  );
});

test("rejects PII and internal identity fields in visual payloads", () => {
  for (const forbidden of [
    "userId",
    "affiliateId",
    "email",
    "phone",
    "customerId",
  ]) {
    assert.throws(
      () =>
        validateVisualPayload({
          publicId: "pass_01J00000000000000000000000",
          signatureVersion: 1,
          signature: "a".repeat(64),
          [forbidden]: "private-value",
        }),
      new RegExp(forbidden),
    );
  }
});

test("rejects unknown resolution methods", () => {
  assert.equal(isResolutionMethod("pixel_guess"), false);
  assert.equal(isResolutionMethod("signed_watermark"), true);
});

test("keeps perceptual and AI matches assistive", () => {
  assert.equal(methodCanBeAuthoritative("perceptual_match"), false);
  assert.equal(methodCanBeAuthoritative("ai_object_match"), false);

  const invalid: ScreenPassResolution = {
    tenantId: ids.tenantId,
    method: "perceptual_match",
    confidence: "likely",
    authoritative: true,
    payableAttribution: false,
    changed: null,
    safeActionIds: [],
    reasons: [],
  };
  assert.throws(
    () => assertResolutionTrust(invalid),
    /cannot be authoritative/,
  );
});

test("ambiguous or non-authoritative resolution cannot enable payable attribution", () => {
  const invalid: ScreenPassResolution = {
    tenantId: ids.tenantId,
    method: "visible_short_code",
    confidence: "ambiguous",
    authoritative: true,
    payableAttribution: true,
    changed: null,
    safeActionIds: [],
    reasons: [],
  };
  assert.throws(() => assertResolutionTrust(invalid), /Ambiguous/);
});

test("conversion evidence requires idempotency and cannot trigger payout", () => {
  const base: ConversionEvidence = {
    evidenceId: "evidence_1",
    tenantId: ids.tenantId,
    object: {
      tenantId: ids.tenantId,
      objectType: "profile",
      objectId: "profile_1" as any,
    },
    idempotencyKey: "" as any,
    eventType: "signup_completed",
    occurredAt: new Date(0).toISOString(),
    payoutTriggered: false,
  };
  assert.throws(() => assertConversionEvidence(base), /idempotency/);
  assert.throws(
    () =>
      assertConversionEvidence({
        ...base,
        idempotencyKey: "idem_123" as any,
        payoutTriggered: true as false,
      }),
    /cannot trigger payout/,
  );
  assert.throws(
    () =>
      assertConversionEvidence({
        ...base,
        idempotencyKey: "x".repeat(161) as any,
        payoutTriggered: false,
      }),
    /exceeds 160/,
  );
});

test("partner programs reject self-attribution and require explicit conversions", () => {
  const program: PartnerProgram = {
    id: ids.programId,
    tenantId: ids.tenantId,
    name: "Test",
    status: "active",
    attributionRule: "first_touch",
    attributionWindowDays: 30,
    selfAttribution: "reject",
    eligibleConversionTypes: ["signup_completed"],
    rewardPolicyReference: null,
  };
  assert.doesNotThrow(() => assertPartnerProgram(program));
  assert.throws(
    () => assertPartnerProgram({ ...program, eligibleConversionTypes: [] }),
    /eligible conversion/,
  );
});

test("reward decisions stay separate from payment execution", () => {
  const decision: RewardDecision = {
    decisionId: "decision_1",
    tenantId: ids.tenantId,
    programId: ids.programId,
    conversionEvidenceId: "evidence_1",
    policyVersion: "policy-v1",
    status: "eligible",
    reasonCodes: ["eligible_conversion"],
    amountMinor: 1000,
    currency: "USD",
    paymentTriggered: false,
  };
  assert.doesNotThrow(() => assertRewardDecision(decision));
  assert.throws(
    () =>
      assertRewardDecision({ ...decision, paymentTriggered: true as false }),
    /cannot trigger payment/,
  );
});

test("action recovery returns only requested and allowlisted actions", () => {
  const actions = [
    {
      id: "ask",
      kind: "direct_connect" as const,
      label: "Ask",
      destination: "/ask",
    },
    {
      id: "admin",
      kind: "open" as const,
      label: "Admin",
      destination: "/admin",
    },
  ];
  const recovered = filterAllowlistedActions(
    ["ask", "admin"],
    actions,
    new Set(["direct_connect"]),
  );
  assert.deepEqual(
    recovered.map((action) => action.id),
    ["ask"],
  );
});
