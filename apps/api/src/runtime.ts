import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import {
  PostgresRegistryStore,
  RegistryService,
  SigningKeyRing,
  type SigningKey,
} from "@tradescout-infinity/registry";

import { PostgresApiKeyAuthenticator } from "./auth.js";

function required(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// Each entrypoint constructs this once. Durable state and current tenant/key
// status come from the same Postgres owners in every process or isolate.
export function createPostgresRuntime(options: Pick<PoolConfig, "max"> = {}) {
  const connectionString = required("DATABASE_URL");
  const keys = new SigningKeyRing(
    JSON.parse(required("INFINITY_SIGNING_KEYS_JSON")) as SigningKey[],
  );
  const pool = new Pool({ connectionString, ...options });
  const db = drizzle(pool);
  return {
    pool,
    registry: new RegistryService(new PostgresRegistryStore(db), keys),
    authenticator: new PostgresApiKeyAuthenticator(db),
  };
}
