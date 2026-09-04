export type Brand<K, T extends string> = K & { readonly __brand: T };

export type TenantId = Brand<string, "TenantId">;
export type ObjectId = Brand<string, "ObjectId">;
export type IdempotencyKey = Brand<string, "IdempotencyKey">;
export type PartnerId = Brand<string, "PartnerId">;
export type ProgramId = Brand<string, "ProgramId">;
export type AttributionTouchId = Brand<string, "AttributionTouchId">;
export type AttributionAssignmentId = Brand<string, "AttributionAssignmentId">;

export interface Tenant {
  id: TenantId;
  key: string;
  displayName: string;
  status: "active" | "suspended";
}

export interface InfinityObjectReference {
  tenantId: TenantId;
  objectType: string;
  objectId: ObjectId;
}

export type AttributionRule =
  "first_touch" | "last_touch" | "lifetime_first_touch";

export type AttributionCarrier =
  | "query_ref"
  | "path_segment"
  | "redirect_code"
  | "cookie"
  | "session"
  | "clean_owner_view"
  | "external_evidence";

export interface PartnerProgram {
  id: ProgramId;
  tenantId: TenantId;
  name: string;
  status: "draft" | "active" | "paused" | "retired";
  attributionRule: AttributionRule;
  attributionWindowDays: number | null;
  selfAttribution: "reject";
  eligibleConversionTypes: string[];
  rewardPolicyReference: string | null;
}

export interface PartnerIdentity {
  id: PartnerId;
  tenantId: TenantId;
  programId: ProgramId;
  subjectReference: string;
  publicTag?: string;
  status: "active" | "suspended" | "retired";
}

export interface ShareTarget {
  tenantId: TenantId;
  object: InfinityObjectReference;
  canonicalPath: string;
  actionId?: string;
}

export interface PartnerLink {
  id: string;
  tenantId: TenantId;
  programId: ProgramId;
  partnerId: PartnerId;
  target: ShareTarget;
  publicCode: string;
  campaignReference?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface AttributionTouch {
  id: AttributionTouchId;
  tenantId: TenantId;
  programId: ProgramId;
  partnerId: PartnerId;
  linkId?: string;
  sourceEvidenceReference?: string;
  carrier: AttributionCarrier;
  target: ShareTarget;
  occurredAt: string;
  evidenceDigest: string;
  verified: boolean;
}

export interface AttributionAssignment {
  id: AttributionAssignmentId;
  tenantId: TenantId;
  programId: ProgramId;
  partnerId: PartnerId;
  subjectReference: string;
  winningTouchId: AttributionTouchId;
  rule: AttributionRule;
  assignedAt: string;
  expiresAt?: string;
  locked: boolean;
}

export interface AttributionProof {
  proofId: string;
  tenantId: TenantId;
  sourceEvidenceReference: string;
  method: string;
  verifiedAt: string;
  affiliateReference?: string;
  campaignReference?: string;
  evidenceDigest: string;
}

export interface ConversionEvidence {
  evidenceId: string;
  tenantId: TenantId;
  object: InfinityObjectReference;
  idempotencyKey: IdempotencyKey;
  eventType: string;
  occurredAt: string;
  attributionProofId?: string;
  attributionAssignmentId?: AttributionAssignmentId;
  payoutTriggered: false;
}

export interface RewardEvaluationRequest {
  tenantId: TenantId;
  programId: ProgramId;
  conversionEvidenceId: string;
  rewardPolicyReference: string;
}

export interface RewardDecision {
  decisionId: string;
  tenantId: TenantId;
  programId: ProgramId;
  conversionEvidenceId: string;
  policyVersion: string;
  status: "eligible" | "ineligible" | "manual_review";
  reasonCodes: string[];
  amountMinor?: number;
  currency?: string;
  paymentTriggered: false;
}
