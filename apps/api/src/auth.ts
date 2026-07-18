import { createHash } from "node:crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { TenantId } from "@tradescout-infinity/contracts";
import { infinityApiKeys } from "@tradescout-infinity/registry/schema";

export interface AuthenticatedTenant {
  tenantId: TenantId;
  apiKeyId: string;
}

export interface ApiKeyAuthenticator {
  authenticate(rawApiKey: string): Promise<AuthenticatedTenant | null>;
}

export function hashApiKey(rawApiKey: string): string {
  return createHash("sha256").update(rawApiKey).digest("hex");
}

export class PostgresApiKeyAuthenticator implements ApiKeyAuthenticator {
  constructor(private readonly db: NodePgDatabase<Record<string, never>>) {}

  async authenticate(rawApiKey: string): Promise<AuthenticatedTenant | null> {
    if (!rawApiKey.startsWith("inf_")) return null;
    const [key] = await this.db
      .select({ id: infinityApiKeys.id, tenantId: infinityApiKeys.tenantId })
      .from(infinityApiKeys)
      .where(
        and(
          eq(infinityApiKeys.keyHash, hashApiKey(rawApiKey)),
          eq(infinityApiKeys.status, "active"),
          or(
            isNull(infinityApiKeys.expiresAt),
            gt(infinityApiKeys.expiresAt, new Date()),
          ),
        ),
      )
      .limit(1);
    return key
      ? { tenantId: key.tenantId as TenantId, apiKeyId: key.id }
      : null;
  }
}
