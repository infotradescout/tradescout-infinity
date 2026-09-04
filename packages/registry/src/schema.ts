import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import type {
  AttributionCarrier,
  AttributionRule,
  InfinityObjectReference,
} from "@tradescout-infinity/contracts";

export const infinityTenants = pgTable(
  "infinity_tenants",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    key: varchar("key", { length: 80 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("infinity_tenants_key_unique").on(table.key)],
);

export const infinityApiKeys = pgTable(
  "infinity_api_keys",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => infinityTenants.id),
    name: varchar("name", { length: 120 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("infinity_api_keys_hash_unique").on(table.keyHash),
    index("infinity_api_keys_tenant_idx").on(table.tenantId),
  ],
);

export const infinityPartnerPrograms = pgTable(
  "infinity_partner_programs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => infinityTenants.id),
    name: varchar("name", { length: 160 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    attributionRule: varchar("attribution_rule", { length: 40 })
      .$type<AttributionRule>()
      .notNull(),
    attributionWindowDays: integer("attribution_window_days"),
    eligibleConversionTypes: jsonb("eligible_conversion_types")
      .$type<string[]>()
      .notNull(),
    rewardPolicyReference: varchar("reward_policy_reference", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("infinity_programs_tenant_idx").on(table.tenantId)],
);

export const infinityPartnerIdentities = pgTable(
  "infinity_partner_identities",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => infinityTenants.id),
    programId: varchar("program_id", { length: 64 })
      .notNull()
      .references(() => infinityPartnerPrograms.id),
    subjectReference: varchar("subject_reference", { length: 160 }).notNull(),
    publicTag: varchar("public_tag", { length: 80 }),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("infinity_partner_subject_unique").on(
      table.tenantId,
      table.programId,
      table.subjectReference,
    ),
    uniqueIndex("infinity_partner_public_tag_unique").on(
      table.tenantId,
      table.programId,
      table.publicTag,
    ),
  ],
);

export const infinityObjects = pgTable(
  "infinity_objects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => infinityTenants.id),
    objectType: varchar("object_type", { length: 80 }).notNull(),
    externalObjectId: varchar("external_object_id", { length: 160 }).notNull(),
    currentVersion: varchar("current_version", { length: 120 }).notNull(),
    canonicalPath: text("canonical_path").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("infinity_objects_external_unique").on(
      table.tenantId,
      table.objectType,
      table.externalObjectId,
    ),
  ],
);

export const infinityAttributionTouches = pgTable(
  "infinity_attribution_touches",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    programId: varchar("program_id", { length: 64 }).notNull(),
    partnerId: varchar("partner_id", { length: 64 }).notNull(),
    linkId: varchar("link_id", { length: 64 }),
    sourceEvidenceReference: varchar("source_evidence_reference", {
      length: 160,
    }),
    carrier: varchar("carrier", { length: 40 })
      .$type<AttributionCarrier>()
      .notNull(),
    target: jsonb("target").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    evidenceDigest: varchar("evidence_digest", { length: 128 }).notNull(),
    verified: boolean("verified").notNull().default(false),
  },
  (table) => [
    index("infinity_touches_program_idx").on(table.tenantId, table.programId),
  ],
);

export const infinityAttributionAssignments = pgTable(
  "infinity_attribution_assignments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    programId: varchar("program_id", { length: 64 }).notNull(),
    partnerId: varchar("partner_id", { length: 64 }).notNull(),
    subjectReference: varchar("subject_reference", { length: 160 }).notNull(),
    winningTouchId: varchar("winning_touch_id", { length: 64 }).notNull(),
    rule: varchar("rule", { length: 40 }).$type<AttributionRule>().notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    locked: boolean("locked").notNull().default(false),
  },
  (table) => [
    uniqueIndex("infinity_assignment_subject_unique").on(
      table.tenantId,
      table.programId,
      table.subjectReference,
    ),
  ],
);

export const infinityConversionEvidence = pgTable(
  "infinity_conversion_evidence",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    objectReference: jsonb("object_reference")
      .$type<InfinityObjectReference>()
      .notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    attributionProofId: varchar("attribution_proof_id", { length: 64 }),
    attributionAssignmentId: varchar("attribution_assignment_id", {
      length: 64,
    }),
    payloadDigest: varchar("payload_digest", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("infinity_conversion_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
  ],
);
