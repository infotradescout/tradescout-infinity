import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  ConversionEvidence,
  PublicPassId,
  ScreenPass,
  ScreenPassAction,
} from "@tradescout-infinity/contracts";

import {
  infinityConversionEvidence,
  infinityAttributionTouches,
  infinityPassActions,
  infinityPasses,
} from "./schema.js";
import type {
  RegistryStore,
  StoredAttributionTouch,
  StoredConversionEvidence,
  StoredPass,
} from "./store.js";

type RegistryDatabase = NodePgDatabase<Record<string, never>>;

function rowToPass(row: typeof infinityPasses.$inferSelect): ScreenPass {
  return {
    publicId: row.publicId as ScreenPass["publicId"],
    tenantId: row.tenantId as ScreenPass["tenantId"],
    object: row.objectReference,
    scopes: row.scopes,
    actionIds: row.actionIds,
    ...(row.attribution ? { attribution: row.attribution } : {}),
    version: {
      objectVersion: row.objectVersion,
      renderedAt: row.renderedAt.toISOString(),
      ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
      ...(row.supersededBy
        ? { supersededBy: row.supersededBy as ScreenPass["publicId"] }
        : {}),
    },
    signatureVersion: row.signatureVersion,
    status: row.status as ScreenPass["status"],
  };
}

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

  async createPass(record: StoredPass): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(infinityPasses).values({
        publicId: record.pass.publicId,
        tenantId: record.pass.tenantId,
        objectReference: record.pass.object,
        scopes: record.pass.scopes,
        actionIds: record.pass.actionIds,
        attribution: record.pass.attribution ?? null,
        objectVersion: record.pass.version.objectVersion,
        renderedAt: new Date(record.pass.version.renderedAt),
        expiresAt: record.pass.version.expiresAt
          ? new Date(record.pass.version.expiresAt)
          : null,
        signatureVersion: record.pass.signatureVersion,
        status: record.pass.status,
      });
      if (record.actions.length > 0) {
        await tx.insert(infinityPassActions).values(
          record.actions.map((action) => ({
            id: `${record.pass.publicId}:${action.id}`,
            tenantId: record.pass.tenantId,
            passPublicId: record.pass.publicId,
            action,
          })),
        );
      }
    });
  }

  async findPass(publicId: PublicPassId): Promise<StoredPass | null> {
    const [passRow] = await this.db
      .select()
      .from(infinityPasses)
      .where(eq(infinityPasses.publicId, publicId))
      .limit(1);
    if (!passRow) return null;
    const actionRows = await this.db
      .select({ action: infinityPassActions.action })
      .from(infinityPassActions)
      .where(eq(infinityPassActions.passPublicId, publicId));
    return {
      pass: rowToPass(passRow),
      actions: actionRows.map((row) => row.action as ScreenPassAction),
    };
  }

  async revokePass(params: {
    tenantId: ScreenPass["tenantId"];
    publicId: PublicPassId;
    revokedAt: string;
  }): Promise<StoredPass | null> {
    const [updated] = await this.db
      .update(infinityPasses)
      .set({ status: "revoked", revokedAt: new Date(params.revokedAt) })
      .where(
        and(
          eq(infinityPasses.publicId, params.publicId),
          eq(infinityPasses.tenantId, params.tenantId),
        ),
      )
      .returning({ publicId: infinityPasses.publicId });
    return updated ? this.findPass(updated.publicId as PublicPassId) : null;
  }

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
      passPublicId: touch.passId ?? null,
      carrier: touch.carrier,
      target: touch.target,
      occurredAt: new Date(touch.occurredAt),
      evidenceDigest: touch.evidenceDigest,
      verified: touch.verified,
    });
  }
}
