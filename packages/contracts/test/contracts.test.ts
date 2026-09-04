import assert from "node:assert/strict";
import test from "node:test";

import {
  assertConversionEvidence,
  assertPartnerProgram,
  assertRewardDecision,
  type ConversionEvidence,
  type PartnerProgram,
  type RewardDecision,
} from "../src/index.js";

const ids = {
  tenantId: "tenant_test" as any,
  programId: "program_test" as any,
};

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
