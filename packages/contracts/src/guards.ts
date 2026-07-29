import type {
  ConversionEvidence,
  ResolutionMethod,
  ScreenPassAction,
  ScreenPassResolution,
  PartnerProgram,
  RewardDecision,
  VisualPassPayload,
} from "./types.js";

const AUTHORITATIVE_METHODS = new Set<ResolutionMethod>([
  "signed_watermark",
  "visible_short_code",
  "qr_or_barcode",
  "c2pa_or_metadata",
]);

const RESOLUTION_METHODS = new Set<ResolutionMethod>([
  ...AUTHORITATIVE_METHODS,
  "perceptual_match",
  "ai_object_match",
]);

const FORBIDDEN_VISUAL_KEYS = new Set([
  "userId",
  "rawUserId",
  "affiliateId",
  "email",
  "phone",
  "customerId",
  "privateObjectData",
]);

export function isResolutionMethod(value: unknown): value is ResolutionMethod {
  return (
    typeof value === "string" &&
    RESOLUTION_METHODS.has(value as ResolutionMethod)
  );
}

export function methodCanBeAuthoritative(method: ResolutionMethod): boolean {
  return AUTHORITATIVE_METHODS.has(method);
}

export function validateVisualPayload(
  payload: unknown,
): asserts payload is VisualPassPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Visual payload must be an object");
  }

  const keys = Object.keys(payload);
  const forbidden = keys.find((key) => FORBIDDEN_VISUAL_KEYS.has(key));
  if (forbidden) {
    throw new Error(`Visual payload contains forbidden field: ${forbidden}`);
  }

  const allowed = new Set(["publicId", "signatureVersion", "signature"]);
  const unknown = keys.find((key) => !allowed.has(key));
  if (unknown) {
    throw new Error(`Visual payload contains unknown field: ${unknown}`);
  }

  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.publicId !== "string" ||
    candidate.publicId.length < 16
  ) {
    throw new Error("Visual payload requires an opaque publicId");
  }
  if (
    !Number.isInteger(candidate.signatureVersion) ||
    Number(candidate.signatureVersion) < 1
  ) {
    throw new Error("Visual payload requires a positive signatureVersion");
  }
  if (
    typeof candidate.signature !== "string" ||
    candidate.signature.length < 32
  ) {
    throw new Error("Visual payload requires a signature");
  }
}

export function assertResolutionTrust(resolution: ScreenPassResolution): void {
  if (!isResolutionMethod(resolution.method)) {
    throw new Error("Unknown resolution method");
  }
  if (
    resolution.authoritative &&
    !methodCanBeAuthoritative(resolution.method)
  ) {
    throw new Error("Assistive resolution methods cannot be authoritative");
  }
  if (resolution.confidence === "ambiguous" && resolution.payableAttribution) {
    throw new Error("Ambiguous resolution cannot enable payable attribution");
  }
  if (!resolution.authoritative && resolution.payableAttribution) {
    throw new Error(
      "Non-authoritative resolution cannot enable payable attribution",
    );
  }
}

export function assertConversionEvidence(evidence: ConversionEvidence): void {
  if (!evidence.idempotencyKey || evidence.idempotencyKey.length < 8) {
    throw new Error("Conversion evidence requires an idempotency key");
  }
  if (evidence.idempotencyKey.length > 160) {
    throw new Error(
      "Conversion evidence idempotency key exceeds 160 characters",
    );
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

export function filterAllowlistedActions(
  requestedIds: readonly string[],
  actions: readonly ScreenPassAction[],
  allowedKinds: ReadonlySet<ScreenPassAction["kind"]>,
): ScreenPassAction[] {
  const requested = new Set(requestedIds);
  return actions.filter(
    (action) => requested.has(action.id) && allowedKinds.has(action.kind),
  );
}
