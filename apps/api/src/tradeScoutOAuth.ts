import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import {
  TRADE_SCOUT_PLUGIN_SCOPES,
  type OwnerAuthorization,
  type TradeScoutPluginScope,
  type TenantId,
} from "@tradescout-infinity/contracts";

import type { OwnerTokenAuthenticator } from "./mcp.js";

export interface TradeScoutOAuthConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
}

function scopesFrom(payload: JWTPayload): TradeScoutPluginScope[] {
  const raw = [
    ...(typeof payload.scope === "string" ? payload.scope.split(/\s+/) : []),
    ...(Array.isArray(payload.scp) ? payload.scp.map(String) : []),
  ];
  const supported = new Set<string>(TRADE_SCOUT_PLUGIN_SCOPES);
  return [...new Set(raw)].filter((scope): scope is TradeScoutPluginScope =>
    supported.has(scope),
  );
}

export class TradeScoutJwtAuthenticator implements OwnerTokenAuthenticator {
  private readonly jwks;

  constructor(private readonly config: TradeScoutOAuthConfig) {
    if (
      !config.issuer.startsWith("https://") ||
      !config.audience ||
      !config.jwksUri.startsWith("https://")
    ) {
      throw new Error("invalid_tradescout_oauth_config");
    }
    this.jwks = createRemoteJWKSet(new URL(config.jwksUri));
  }

  async authenticateOwner(
    rawAccessToken: string,
  ): Promise<OwnerAuthorization | null> {
    try {
      const { payload } = await jwtVerify(rawAccessToken, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ["RS256", "ES256"],
      });
      if (
        typeof payload.sub !== "string" ||
        !payload.sub ||
        typeof payload.tenant_id !== "string" ||
        !payload.tenant_id
      ) {
        return null;
      }
      return {
        subject: payload.sub,
        tenantId: payload.tenant_id as TenantId,
        scopes: scopesFrom(payload),
      };
    } catch {
      return null;
    }
  }
}
