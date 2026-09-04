import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { ConversionEvidence } from "@tradescout-infinity/contracts";

import {
  infinityConversionEvidence,
  infinityAttributionTouches,
} from "./schema.js";
import type {
  RegistryStore,
  StoredAttributionTouch,
  StoredConversionEvidence,
} from "./store.js";

type RegistryDatabase = NodePgDatabase<Record<string, never>>;

function rowToEvidence(
  row: typeof infinityConversionEvidence.$inferSelect,
): StoredConversionEvidence {
  const evidence: ConversionEvidence = {
    evidenceId: row.id,
    tenantId: row.tenantId as ConversionEvidence["tenantId"],
    object: row.objectReference,
    idempotencyKey: row.idempotencyKey as ConversionEvidence["idempotencyKey"],
    eventType: row.eventType,
    occurredAt: row.occurredAt.toISOString(),
    payoutTriggered: false,
  };
  if (row.attributionProofId)
    evidence.attributionProofId = row.attributionProofId;
  if (row.attributionAssignmentId) {
    evidence.attributionAssignmentId =
      row.attributionAssignmentId as NonNullable<
        ConversionEvidence["attributionAssignmentId"]
      >;
  }
  return { evidence, payloadDigest: row.payloadDigest };
}

export class PostgresRegistryStore implements RegistryStore {
  constructor(private readonly db: RegistryDatabase) {}

  async recordConversionEvidence(
    record: StoredConversionEvidence,
  ): Promise<{ created: boolean; record: StoredConversionEvidence }> {
    const inserted = await this.db
      .insert(infinityConversionEvidence)
      .values({
        id: record.evidence.evidenceId,
        tenantId: record.evidence.tenantId,
        objectReference: record.evidence.object,
        idempotencyKey: record.evidence.idempotencyKey,
        eventType: record.evidence.eventType,
        occurredAt: new Date(record.evidence.occurredAt),
        attributionProofId: record.evidence.attributionProofId ?? null,
        attributionAssignmentId:
          record.evidence.attributionAssignmentId ?? null,
        payloadDigest: record.payloadDigest,
      })
      .onConflictDoNothing({
        target: [
          infinityConversionEvidence.tenantId,
          infinityConversionEvidence.idempotencyKey,
        ],
      })
      .returning();
    if (inserted[0])
      return { created: true, record: rowToEvidence(inserted[0]) };

    const [current] = await this.db
      .select()
      .from(infinityConversionEvidence)
      .where(
        and(
          eq(infinityConversionEvidence.tenantId, record.evidence.tenantId),
          eq(
            infinityConversionEvidence.idempotencyKey,
            record.evidence.idempotencyKey,
          ),
        ),
      )
      .limit(1);
    if (!current)
      throw new Error("Failed to resolve idempotent conversion evidence");
    if (current.payloadDigest !== record.payloadDigest) {
      throw new Error("Idempotency key reused with different payload");
    }
    return { created: false, record: rowToEvidence(current) };
  }

  async recordAttributionTouch(record: StoredAttributionTouch): Promise<void> {
    const touch = record.touch;
    await this.db.insert(infinityAttributionTouches).values({
      id: touch.id,
      tenantId: touch.tenantId,
      programId: touch.programId,
      partnerId: touch.partnerId,
      linkId: touch.linkId ?? null,
      sourceEvidenceReference: touch.sourceEvidenceReference ?? null,
      carrier: touch.carrier,
      target: touch.target,
      occurredAt: new Date(touch.occurredAt),
      evidenceDigest: touch.evidenceDigest,
      verified: touch.verified,
    });
  }
}
