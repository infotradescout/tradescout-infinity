import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { PostgresApiKeyAuthenticator } from "../dist/src/auth.js";

// Execute the real authenticator and SQL builder. Only the database transport
// is synthetic; these checks do not replace installed PostgreSQL acceptance.
function harness(initialRows = [], error = null) {
  const calls = [];
  let rows = initialRows;
  const client = {
    async query(query, values) {
      calls.push({
        sql: query.text,
        values: values ?? query.values ?? [],
        rowMode: query.rowMode,
      });
      if (error) throw error;
      return { rows };
    },
  };
  const auth = new PostgresApiKeyAuthenticator(drizzle(client));
  return {
    auth,
    calls,
    setRows: (next) => {
      rows = next;
    },
  };
}
const token = "inf_synthetic-local-query-regression";

test("invalid API key prefix never queries the database", async () => {
  const { auth, calls } = harness();
  for (const value of ["", "wrong-prefix", "INF_wrong-case"]) {
    assert.equal(await auth.authenticate(value), null);
  }
  assert.equal(calls.length, 0);
});

test("authentication SQL joins the exact tenant and requires both active statuses", async () => {
  const { auth, calls } = harness();
  assert.equal(await auth.authenticate(token), null);
  assert.equal(calls.length, 1);
  const { sql, values } = calls[0];
  assert.match(
    sql,
    /inner join "infinity_tenants" on "infinity_api_keys"\."tenant_id" = "infinity_tenants"\."id"/,
  );
  assert.match(sql, /"infinity_api_keys"\."status" = \$2/);
  assert.match(sql, /"infinity_tenants"\."status" = \$3/);
  assert.deepEqual(values.slice(0, 3), [
    createHash("sha256").update(token).digest("hex"),
    "active",
    "active",
  ]);
  assert.match(sql, /limit \$5$/);
  assert.equal(values[4], 1);
});

test("expiration remains null-or-future and uses a fresh observation", async () => {
  const { auth, calls } = harness();
  const before = Date.now();
  await auth.authenticate(token);
  const after = Date.now();
  assert.match(
    calls[0].sql,
    /\("infinity_api_keys"\."expires_at" is null or "infinity_api_keys"\."expires_at" > \$4\)/,
  );
  const observed = new Date(calls[0].values[3]).getTime();
  assert.ok(observed >= before && observed <= after);
});

test("accepted identity comes only from the returned key owner", async () => {
  const { auth } = harness([["key-fixture", "tenant-fixture"]]);
  assert.deepEqual(await auth.authenticate(token), {
    tenantId: "tenant-fixture",
    apiKeyId: "key-fixture",
  });
});

test("SQL projects only the two identity fields", async () => {
  const { auth, calls } = harness([["key-fixture", "tenant-fixture"]]);
  const result = await auth.authenticate(token);
  assert.match(
    calls[0].sql,
    /^select "infinity_api_keys"\."id", "infinity_api_keys"\."tenant_id" from /,
  );
  assert.deepEqual(Object.keys(result).sort(), ["apiKeyId", "tenantId"]);
});

test("raw key material never enters generated SQL or parameters", async () => {
  const { auth, calls } = harness();
  const input = "inf_' OR 1=1 -- synthetic";
  await auth.authenticate(input);
  assert.equal(calls[0].sql.includes(input), false);
  assert.equal(calls[0].values.includes(input), false);
  assert.equal(
    calls[0].values[0],
    createHash("sha256").update(input).digest("hex"),
  );
});

test("a later failed lookup does not reuse an earlier authenticated identity", async () => {
  const { auth, calls, setRows } = harness([["key-fixture", "tenant-fixture"]]);
  assert.ok(await auth.authenticate(token));
  setRows([]);
  assert.equal(await auth.authenticate(token), null);
  assert.equal(calls.length, 2);
});

test("database failure propagates without granting a fallback identity", async () => {
  const failure = new Error("synthetic database unavailable");
  const { auth } = harness([], failure);
  await assert.rejects(
    auth.authenticate(token),
    (error) => error === failure || error.cause === failure,
  );
});
