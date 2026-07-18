import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  assertConversionEvidence,
  assertResolutionTrust,
  filterAllowlistedActions,
  validateVisualPayload,
  type ConversionEvidence,
  type InfinityObjectReference,
  type PublicPassId,
  type ScreenPass,
  type ScreenPassAction,
  type ScreenPassAttribution,
  type ScreenPassResolution,
  type ScreenPassScope,
  type TenantId,
  type VisualPassPayload,
} from "@tradescout-infinity/contracts";

import { SigningKeyRing } from "./signing.js";
import type { RegistryStore, StoredPass } from "./store.js";

const ALLOWED_ACTION_KINDS = new Set<ScreenPassAction["kind"]>([
  "open",
  "direct_connect",
  "order",
  "directions",
  "save",
  "check_availability",
]);

function isSafeDestination(destination: string): boolean {
  if (!destination.startsWith("/") || destination.startsWith("//"))
    return false;
  let parsed: URL;
  try {
    parsed = new URL(destination, "https://infinity.invalid");
  } catch {
    return false;
  }
  return !["/admin", "/staff", "/api"].some(
    (prefix) =>
      parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
  );
}

function digestJson(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export interface IssuePassInput {
  tenantId: TenantId;
  object: InfinityObjectReference;
  scopes: ScreenPassScope[];
  actions: ScreenPassAction[];
  attribution?: ScreenPassAttribution;
  objectVersion: string;
  renderedAt?: string;
  expiresAt?: string;
}

export interface ResolvePassInput {
  payload: VisualPassPayload;
  expectedTenantId?: TenantId;
  currentObjectVersion?: string;
  now?: string;
}

export class RegistryService {
  constructor(
    private readonly store: RegistryStore,
    private readonly keys: SigningKeyRing,
  ) {}

  async issuePass(input: IssuePassInput): Promise<{
    pass: ScreenPass;
    visualPayload: VisualPassPayload;
    actions: ScreenPassAction[];
  }> {
    if (input.object.tenantId !== input.tenantId) {
      throw new Error("Object tenant does not match authenticated tenant");
    }
    if (input.scopes.length === 0)
      throw new Error("At least one pass scope is required");
    if (!input.objectVersion.trim())
      throw new Error("Object version is required");
    if (
      input.actions.some((action) => !isSafeDestination(action.destination))
    ) {
      throw new Error("Pass contains a blocked action destination");
    }
    if (
      new Set(input.actions.map((action) => action.id)).size !==
      input.actions.length
    ) {
      throw new Error("Pass action IDs must be unique");
    }

    const publicId =
      `sp_${randomBytes(18).toString("base64url")}` as PublicPassId;
    const visualPayload = this.keys.sign({
      tenantId: input.tenantId,
      publicId,
    });
    const renderedAt = input.renderedAt ?? new Date().toISOString();
    const pass: ScreenPass = {
      publicId,
      tenantId: input.tenantId,
      object: input.object,
      scopes: [...new Set(input.scopes)],
      actionIds: input.actions.map((action) => action.id),
      ...(input.attribution ? { attribution: input.attribution } : {}),
      version: {
        objectVersion: input.objectVersion,
        renderedAt,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      },
      signatureVersion: visualPayload.signatureVersion,
      status: "active",
    };
    await this.store.createPass({
      pass,
      actions: structuredClone(input.actions),
    });
    return { pass, visualPayload, actions: structuredClone(input.actions) };
  }

  async getPass(
    tenantId: TenantId,
    publicId: PublicPassId,
  ): Promise<StoredPass | null> {
    const record = await this.store.findPass(publicId);
    return record?.pass.tenantId === tenantId ? record : null;
  }

  async revokePass(
    tenantId: TenantId,
    publicId: PublicPassId,
  ): Promise<StoredPass | null> {
    return this.store.revokePass({
      tenantId,
      publicId,
      revokedAt: new Date().toISOString(),
    });
  }

  async resolve(input: ResolvePassInput): Promise<{
    resolution: ScreenPassResolution;
    pass: ScreenPass | null;
    actions: ScreenPassAction[];
  }> {
    try {
      validateVisualPayload(input.payload);
    } catch {
      return this.unresolved("invalid_visual_payload");
    }
    const record = await this.store.findPass(input.payload.publicId);
    if (!record) return this.unresolved("unknown_pass");
    if (
      input.expectedTenantId &&
      record.pass.tenantId !== input.expectedTenantId
    ) {
      return this.unresolved("tenant_mismatch");
    }
    if (
      !this.keys.verify({
        tenantId: record.pass.tenantId,
        payload: input.payload,
      })
    ) {
      return this.unresolved("invalid_signature");
    }
    if (record.pass.signatureVersion !== input.payload.signatureVersion) {
      return this.unresolved("signature_version_mismatch");
    }

    const now = new Date(input.now ?? Date.now());
    const expiration = record.pass.version.expiresAt
      ? new Date(record.pass.version.expiresAt)
      : null;
    const expired = Boolean(expiration && expiration <= now);
    if (record.pass.status !== "active" || expired) {
      return {
        resolution: {
          tenantId: record.pass.tenantId,
          publicId: record.pass.publicId,
          method: "signed_watermark",
          confidence: "verified",
          authoritative: false,
          payableAttribution: false,
          changed: null,
          safeActionIds: [],
          reasons: [expired ? "expired_pass" : `${record.pass.status}_pass`],
        },
        pass: record.pass,
        actions: [],
      };
    }

    const actions = filterAllowlistedActions(
      record.pass.actionIds,
      record.actions.filter((action) => isSafeDestination(action.destination)),
      ALLOWED_ACTION_KINDS,
    );
    const changed = input.currentObjectVersion
      ? input.currentObjectVersion !== record.pass.version.objectVersion
      : null;
    const resolution: ScreenPassResolution = {
      tenantId: record.pass.tenantId,
      publicId: record.pass.publicId,
      method: "signed_watermark",
      confidence: "verified",
      authoritative: true,
      payableAttribution: false,
      changed,
      safeActionIds: actions.map((action) => action.id),
      reasons: ["signed_pass_verified", "reward_policy_required"],
    };
    assertResolutionTrust(resolution);
    return { resolution, pass: record.pass, actions };
  }

  async recordConversion(input: {
    tenantId: TenantId;
    object: InfinityObjectReference;
    idempotencyKey: string;
    eventType: string;
    occurredAt?: string;
    attributionProofId?: string;
    attributionAssignmentId?: string;
  }): Promise<{ created: boolean; evidence: ConversionEvidence }> {
    if (input.object.tenantId !== input.tenantId) {
      throw new Error("Object tenant does not match authenticated tenant");
    }
    const evidence: ConversionEvidence = {
      evidenceId: randomUUID(),
      tenantId: input.tenantId,
      object: input.object,
      idempotencyKey:
        input.idempotencyKey as ConversionEvidence["idempotencyKey"],
      eventType: input.eventType,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      payoutTriggered: false,
    };
    if (input.attributionProofId) {
      evidence.attributionProofId = input.attributionProofId;
    }
    if (input.attributionAssignmentId) {
      evidence.attributionAssignmentId =
        input.attributionAssignmentId as NonNullable<
          ConversionEvidence["attributionAssignmentId"]
        >;
    }
    assertConversionEvidence(evidence);
    const payloadDigest = digestJson({
      tenantId: evidence.tenantId,
      object: evidence.object,
      idempotencyKey: evidence.idempotencyKey,
      eventType: evidence.eventType,
      occurredAt: evidence.occurredAt,
      attributionProofId: evidence.attributionProofId ?? null,
      attributionAssignmentId: evidence.attributionAssignmentId ?? null,
    });
    const result = await this.store.recordConversionEvidence({
      evidence,
      payloadDigest,
    });
    return { created: result.created, evidence: result.record.evidence };
  }

  private unresolved(reason: string): {
    resolution: ScreenPassResolution;
    pass: null;
    actions: [];
  } {
    return {
      resolution: {
        tenantId: "unresolved" as TenantId,
        method: "signed_watermark",
        confidence: "unresolved",
        authoritative: false,
        payableAttribution: false,
        changed: null,
        safeActionIds: [],
        reasons: [reason],
      },
      pass: null,
      actions: [],
    };
  }
}
