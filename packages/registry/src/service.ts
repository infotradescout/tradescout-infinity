import { createHash, randomUUID } from "node:crypto";

import {
  assertConversionEvidence,
  type AttributionCarrier,
  type AttributionTouch,
  type ConversionEvidence,
  type InfinityObjectReference,
  type PartnerId,
  type ProgramId,
  type TenantId,
} from "@tradescout-infinity/contracts";
import type { RegistryStore } from "./store.js";

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

export interface RecordAttributionTouchInput {
  tenantId: TenantId;
  programId: ProgramId;
  partnerId: PartnerId;
  linkId?: string;
  carrier: AttributionCarrier;
  target: {
    tenantId: TenantId;
    object: InfinityObjectReference;
    canonicalPath: string;
    actionId?: string;
  };
  occurredAt?: string;
  evidence: unknown;
}

export class RegistryService {
  constructor(private readonly store: RegistryStore) {}

  async recordAttributionTouch(
    input: RecordAttributionTouchInput,
  ): Promise<AttributionTouch> {
    if (
      input.target.tenantId !== input.tenantId ||
      input.target.object.tenantId !== input.tenantId
    ) {
      throw new Error(
        "Touch target tenant does not match authenticated tenant",
      );
    }
    if (!isSafeDestination(input.target.canonicalPath)) {
      throw new Error("Touch contains a blocked target destination");
    }
    const touch: AttributionTouch = {
      id: randomUUID() as AttributionTouch["id"],
      tenantId: input.tenantId,
      programId: input.programId,
      partnerId: input.partnerId,
      ...(input.linkId ? { linkId: input.linkId } : {}),
      carrier: input.carrier,
      target: input.target,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      evidenceDigest: digestJson(input.evidence),
      verified: false,
    };
    await this.store.recordAttributionTouch({ touch });
    return touch;
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
}
