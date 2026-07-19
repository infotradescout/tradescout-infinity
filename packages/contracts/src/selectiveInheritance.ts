import type {
  InfinityObjectReference,
  PublicPassId,
  TenantId,
} from "./types.js";

export type SelectiveInheritanceSourceKind =
  | "owner_verified"
  | "product_record"
  | "screen_pass"
  | "public_credential"
  | "public_catalog"
  | "public_reputation"
  | "public_website";

export type SelectiveInheritanceDecisionStatus =
  "inherited" | "overridden" | "excluded" | "unresolved";

export interface SelectiveInheritanceFieldRule {
  field: string;
  action: "inherit" | "exclude";
  allowedSourceKinds: SelectiveInheritanceSourceKind[];
  minimumConfidence: number;
  requireVerifiedEvidence: boolean;
  sourcePriority: SelectiveInheritanceSourceKind[];
}

export interface SelectiveInheritancePolicy {
  id: string;
  tenantId: TenantId;
  objectType: string;
  version: string;
  status: "draft" | "active" | "retired";
  defaultAction: "exclude";
  fields: SelectiveInheritanceFieldRule[];
}

export interface SelectiveInheritanceScreenPassEvidence {
  publicId: PublicPassId;
  authoritative: boolean;
  changed: boolean | null;
}

export interface SelectiveInheritanceCandidate {
  field: string;
  value: unknown;
  sourceKind: SelectiveInheritanceSourceKind;
  sourceReference: string;
  evidenceDigest: string;
  observedAt: string;
  confidence: number;
  verified: boolean;
  screenPass?: SelectiveInheritanceScreenPassEvidence;
}

export interface SelectiveInheritanceOverride {
  field: string;
  value: unknown;
  reason: string;
  evidenceDigest: string;
  actorReference: string;
  authorizedAt: string;
}

export interface SelectiveInheritanceRequest {
  evaluationId: string;
  tenantId: TenantId;
  target: InfinityObjectReference;
  targetVersion: string;
  policy: SelectiveInheritancePolicy;
  candidates: SelectiveInheritanceCandidate[];
  overrides: SelectiveInheritanceOverride[];
  evaluatedAt: string;
}

export interface SelectiveInheritanceFieldDecision {
  field: string;
  status: SelectiveInheritanceDecisionStatus;
  value?: unknown;
  sourceReference?: string;
  evidenceDigest?: string;
  screenPassPublicId?: PublicPassId;
  reasonCodes: string[];
}

export interface SelectiveInheritanceEvaluation {
  evaluationId: string;
  tenantId: TenantId;
  target: InfinityObjectReference;
  targetVersion: string;
  policyId: string;
  policyVersion: string;
  evaluatedAt: string;
  decisions: SelectiveInheritanceFieldDecision[];
  applyAuthorized: false;
}

const SOURCE_KINDS = new Set<SelectiveInheritanceSourceKind>([
  "owner_verified",
  "product_record",
  "screen_pass",
  "public_credential",
  "public_catalog",
  "public_reputation",
  "public_website",
]);

function assertNonEmpty(value: string, name: string): void {
  if (!value.trim()) {
    throw new Error(`${name} is required`);
  }
}

function assertConfidence(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

function assertIsoDate(value: string, name: string): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be an ISO-compatible timestamp`);
  }
}

export function assertSelectiveInheritancePolicy(
  policy: SelectiveInheritancePolicy,
): void {
  assertNonEmpty(policy.id, "policy.id");
  assertNonEmpty(policy.objectType, "policy.objectType");
  assertNonEmpty(policy.version, "policy.version");

  if (policy.defaultAction !== "exclude") {
    throw new Error("Selective Inheritance must fail closed by default");
  }

  const seen = new Set<string>();
  for (const rule of policy.fields) {
    assertNonEmpty(rule.field, "policy field");
    if (seen.has(rule.field)) {
      throw new Error(`Duplicate Selective Inheritance field: ${rule.field}`);
    }
    seen.add(rule.field);
    assertConfidence(
      rule.minimumConfidence,
      `minimumConfidence for ${rule.field}`,
    );

    for (const sourceKind of [
      ...rule.allowedSourceKinds,
      ...rule.sourcePriority,
    ]) {
      if (!SOURCE_KINDS.has(sourceKind)) {
        throw new Error(`Unknown inheritance source kind: ${sourceKind}`);
      }
    }

    if (rule.action === "inherit" && rule.allowedSourceKinds.length === 0) {
      throw new Error(
        `Inherited field ${rule.field} must allow at least one source kind`,
      );
    }

    const priority = new Set(rule.sourcePriority);
    for (const allowed of rule.allowedSourceKinds) {
      if (!priority.has(allowed)) {
        throw new Error(
          `Source priority for ${rule.field} must include ${allowed}`,
        );
      }
    }
  }
}

function candidateReason(
  candidate: SelectiveInheritanceCandidate,
  rule: SelectiveInheritanceFieldRule,
): string | null {
  if (!rule.allowedSourceKinds.includes(candidate.sourceKind)) {
    return "source_not_allowed";
  }
  if (rule.requireVerifiedEvidence && !candidate.verified) {
    return "evidence_not_verified";
  }
  if (candidate.confidence < rule.minimumConfidence) {
    return "confidence_below_policy";
  }
  if (!candidate.evidenceDigest.trim()) {
    return "evidence_digest_missing";
  }
  if (Number.isNaN(Date.parse(candidate.observedAt))) {
    return "observation_time_invalid";
  }
  if (candidate.sourceKind === "screen_pass") {
    if (!candidate.screenPass) {
      return "screen_pass_evidence_missing";
    }
    if (!candidate.screenPass.authoritative) {
      return "screen_pass_not_authoritative";
    }
    if (candidate.screenPass.changed !== false) {
      return "screen_pass_version_not_current";
    }
  }
  return null;
}

function rankCandidate(
  candidate: SelectiveInheritanceCandidate,
  rule: SelectiveInheritanceFieldRule,
): [number, number, number] {
  const priority = rule.sourcePriority.indexOf(candidate.sourceKind);
  return [
    priority === -1 ? Number.MAX_SAFE_INTEGER : priority,
    -candidate.confidence,
    -Date.parse(candidate.observedAt),
  ];
}

function compareCandidates(
  left: SelectiveInheritanceCandidate,
  right: SelectiveInheritanceCandidate,
  rule: SelectiveInheritanceFieldRule,
): number {
  const a = rankCandidate(left, rule);
  const b = rankCandidate(right, rule);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function evaluateSelectiveInheritance(
  request: SelectiveInheritanceRequest,
): SelectiveInheritanceEvaluation {
  assertNonEmpty(request.evaluationId, "evaluationId");
  assertNonEmpty(request.targetVersion, "targetVersion");
  assertIsoDate(request.evaluatedAt, "evaluatedAt");
  assertSelectiveInheritancePolicy(request.policy);

  if (request.policy.status !== "active") {
    throw new Error("Selective Inheritance policy must be active");
  }
  if (request.policy.tenantId !== request.tenantId) {
    throw new Error("Policy tenant does not match request tenant");
  }
  if (request.target.tenantId !== request.tenantId) {
    throw new Error("Target tenant does not match request tenant");
  }
  if (request.target.objectType !== request.policy.objectType) {
    throw new Error("Policy object type does not match target object type");
  }

  const rules = new Map(
    request.policy.fields.map((rule) => [rule.field, rule]),
  );
  const overrides = new Map<string, SelectiveInheritanceOverride>();
  for (const override of request.overrides) {
    assertNonEmpty(override.field, "override.field");
    assertNonEmpty(override.reason, "override.reason");
    assertNonEmpty(override.evidenceDigest, "override.evidenceDigest");
    assertNonEmpty(override.actorReference, "override.actorReference");
    assertIsoDate(override.authorizedAt, "override.authorizedAt");
    if (overrides.has(override.field)) {
      throw new Error(`Duplicate override for field: ${override.field}`);
    }
    overrides.set(override.field, override);
  }

  const fieldNames = new Set([
    ...rules.keys(),
    ...request.candidates.map((candidate) => candidate.field),
    ...overrides.keys(),
  ]);

  const decisions = [...fieldNames]
    .sort()
    .map<SelectiveInheritanceFieldDecision>((field) => {
      const override = overrides.get(field);
      if (override) {
        return {
          field,
          status: "overridden",
          value: override.value,
          evidenceDigest: override.evidenceDigest,
          reasonCodes: ["explicit_local_override"],
        };
      }

      const rule = rules.get(field);
      if (!rule || rule.action === "exclude") {
        return {
          field,
          status: "excluded",
          reasonCodes: [
            rule ? "field_excluded_by_policy" : "field_not_allowlisted",
          ],
        };
      }

      const candidates = request.candidates.filter(
        (candidate) => candidate.field === field,
      );
      const rejectedReasons = new Set<string>();
      const eligible = candidates.filter((candidate) => {
        assertConfidence(candidate.confidence, `confidence for ${field}`);
        const reason = candidateReason(candidate, rule);
        if (reason) {
          rejectedReasons.add(reason);
          return false;
        }
        return true;
      });

      eligible.sort((left, right) => compareCandidates(left, right, rule));
      const winner = eligible[0];
      if (!winner) {
        return {
          field,
          status: "unresolved",
          reasonCodes:
            rejectedReasons.size > 0
              ? [...rejectedReasons].sort()
              : ["no_eligible_evidence"],
        };
      }

      return {
        field,
        status: "inherited",
        value: winner.value,
        sourceReference: winner.sourceReference,
        evidenceDigest: winner.evidenceDigest,
        ...(winner.screenPass
          ? { screenPassPublicId: winner.screenPass.publicId }
          : {}),
        reasonCodes: ["highest_priority_eligible_evidence"],
      };
    });

  return {
    evaluationId: request.evaluationId,
    tenantId: request.tenantId,
    target: request.target,
    targetVersion: request.targetVersion,
    policyId: request.policy.id,
    policyVersion: request.policy.version,
    evaluatedAt: request.evaluatedAt,
    decisions,
    applyAuthorized: false,
  };
}
