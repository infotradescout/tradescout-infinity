import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  PostgresRegistryStore,
  RegistryService,
  SigningKeyRing,
  type SigningKey,
} from "@tradescout-infinity/registry";

import { PostgresApiKeyAuthenticator } from "./auth.js";
import { createInfinityServer } from "./server.js";

function required(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const pool = new Pool({ connectionString: required("DATABASE_URL") });
const db = drizzle(pool);
const signingKeys = JSON.parse(
  required("INFINITY_SIGNING_KEYS_JSON"),
) as SigningKey[];
const registry = new RegistryService(
  new PostgresRegistryStore(db),
  new SigningKeyRing(signingKeys),
);
const server = createInfinityServer({
  registry,
  authenticator: new PostgresApiKeyAuthenticator(db),
});
const port = Number(process.env.PORT || 4100);

server.listen(port, () => {
  console.log(`TradeScout Infinity API listening on port ${port}`);
});

async function shutdown() {
  server.close();
  await pool.end();
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
