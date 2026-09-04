import type {
  ConversionEvidence,
  PartnerProgram,
  RewardDecision,
} from "./types.js";

export function assertConversionEvidence(evidence: ConversionEvidence): void {
  if (!evidence.idempotencyKey || evidence.idempotencyKey.length < 8) {
    throw new Error("Conversion evidence requires an idempotency key");
  }
  if (evidence.payoutTriggered !== false) {
    throw new Error("Conversion evidence cannot trigger payout");
  }
}

export function assertPartnerProgram(program: PartnerProgram): void {
  if (program.selfAttribution !== "reject") {
    throw new Error("Self-attribution must be rejected");
  }
  if (
    program.attributionWindowDays !== null &&
    (!Number.isInteger(program.attributionWindowDays) ||
      program.attributionWindowDays < 1)
  ) {
    throw new Error(
      "Attribution window must be null or a positive whole number of days",
    );
  }
  if (program.eligibleConversionTypes.length === 0) {
    throw new Error("Partner program requires eligible conversion types");
  }
}

export function assertRewardDecision(decision: RewardDecision): void {
  if (decision.paymentTriggered !== false) {
    throw new Error("Reward decisions cannot trigger payment");
  }
  const hasAmount =
    decision.amountMinor !== undefined || decision.currency !== undefined;
  if (hasAmount && (decision.amountMinor === undefined || !decision.currency)) {
    throw new Error("Reward amount and currency must be supplied together");
  }
}
