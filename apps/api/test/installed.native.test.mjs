import assert from "node:assert/strict";
import test from "node:test";
import { fork } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

// This runner accepts only an explicitly selected disposable loopback database.
const config = JSON.parse(
  readFileSync(".infinity-native-acceptance.json", "utf8"),
);
const database = new URL(config.databaseUrl);
assert.equal(config.disposable, true);
assert.equal(database.hostname, "127.0.0.1");
assert.match(database.pathname, /^\/infinity_acceptance_[a-z0-9_]+$/);
assert.equal(database.search, "");
const installed = realpathSync(config.installedRoot);
const requireInstalled = createRequire(join(installed, "package.json"));
for (const name of [
  "pg",
  "drizzle-orm/node-postgres",
  "@tradescout-infinity/registry",
]) {
  assert.ok(
    realpathSync(requireInstalled.resolve(name)).startsWith(installed + sep),
    name,
  );
}
const { Pool } = requireInstalled("pg");
const { drizzle } = requireInstalled("drizzle-orm/node-postgres");
const registryModule = await import(
  pathToFileURL(requireInstalled.resolve("@tradescout-infinity/registry"))
);
const { createInfinityServer } = await import(
  pathToFileURL(join(installed, "dist/src/server.js"))
);
const { PostgresApiKeyAuthenticator } = await import(
  pathToFileURL(join(installed, "dist/src/auth.js"))
);
const signingKeys = [
  {
    version: 1,
    status: "active",
    secret: "synthetic-acceptance-only-not-a-production-key",
  },
];

if (process.argv.includes("--serve")) {
  const pool = new Pool({ connectionString: config.databaseUrl, max: 8 });
  const db = drizzle(pool);
  const registry = new registryModule.RegistryService(
    new registryModule.PostgresRegistryStore(db),
    new registryModule.SigningKeyRing(signingKeys),
  );
  const server = createInfinityServer({
    registry,
    authenticator: new PostgresApiKeyAuthenticator(db),
  });
  server.listen(0, "127.0.0.1", () =>
    process.send({ port: server.address().port, pid: process.pid }),
  );
  process.on("SIGTERM", () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
} else {
  test(
    "installed Infinity API with native persistence and process restart",
    { timeout: 45000 },
    async (t) => {
      const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });
      const children = [];
      async function start() {
        const child = fork(import.meta.filename, ["--serve"], {
          stdio: ["ignore", "ignore", "pipe", "ipc"],
        });
        children.push(child);
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("local API startup timeout")),
            10000,
          );
          child.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.once("exit", (code) => {
            clearTimeout(timer);
            reject(new Error(`local API exited ${code}`));
          });
          child.once("message", (message) => {
            clearTimeout(timer);
            resolve({
              child,
              base: `http://127.0.0.1:${message.port}`,
              pid: message.pid,
            });
          });
        });
      }
      async function stop(child) {
        if (child.exitCode !== null || child.signalCode !== null) return;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("owned API shutdown timeout")),
            5000,
          );
          child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
          child.kill("SIGTERM");
        });
      }
      t.after(async () => {
        await Promise.all(children.map(stop));
        await pool.end();
      });
      const id = randomUUID().replaceAll("-", "");
      const tenantA = `acceptance_a_${id}`;
      const tenantB = `acceptance_b_${id}`;
      const tokenA = `inf_${randomUUID()}`;
      const tokenB = `inf_${randomUUID()}`;
      for (const [tenant, token] of [
        [tenantA, tokenA],
        [tenantB, tokenB],
      ]) {
        await pool.query(
          "INSERT INTO infinity_tenants(id,key,display_name) VALUES($1,$1,$2)",
          [tenant, "Synthetic acceptance"],
        );
        await pool.query(
          "INSERT INTO infinity_api_keys(id,tenant_id,name,key_prefix,key_hash) VALUES($1,$2,$3,$4,$5)",
          [
            randomUUID(),
            tenant,
            "Synthetic acceptance",
            "inf_",
            createHash("sha256").update(token).digest("hex"),
          ],
        );
      }
      const object = {
        tenantId: tenantA,
        objectType: "acceptance",
        objectId: id,
      };
      let first = await start();
      const second = await start();
      assert.notEqual(first.pid, second.pid);
      async function request(
        server,
        path,
        method = "GET",
        body,
        token = tokenA,
      ) {
        const response = await fetch(server.base + path, {
          method,
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(5000),
        });
        return {
          status: response.status,
          body: await response.json(),
          cache: response.headers.get("cache-control"),
        };
      }
      await t.test(
        "missing and wrong API credentials cannot issue a pass",
        async () => {
          for (const token of ["", "inf_invalid"])
            assert.equal(
              (await request(first, "/v1/passes", "POST", {}, token)).status,
              401,
            );
        },
      );
      let issued;
      await t.test(
        "persisted signed pass resolves its exact non-payable action",
        async () => {
          const result = await request(first, "/v1/passes", "POST", {
            object,
            scopes: ["screen", "action"],
            actions: [
              {
                id: "inspect",
                kind: "open",
                label: "Inspect",
                destination: "/acceptance",
              },
            ],
            objectVersion: "v1",
          });
          assert.equal(result.status, 201);
          assert.equal(result.cache, "no-store");
          issued = result.body;
          const resolved = await request(second, "/v1/resolve", "POST", {
            payload: issued.visualPayload,
          });
          assert.equal(resolved.body.resolution.authoritative, true);
          assert.equal(resolved.body.resolution.payableAttribution, false);
          assert.equal(resolved.body.actions[0].destination, "/acceptance");
        },
      );
      await t.test(
        "foreign tenant cannot read, revoke, or impersonate pass ownership",
        async () => {
          assert.equal(
            (
              await request(
                second,
                `/v1/passes/${issued.pass.publicId}`,
                "GET",
                undefined,
                tokenB,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                second,
                `/v1/passes/${issued.pass.publicId}/revoke`,
                "POST",
                {},
                tokenB,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                second,
                "/v1/passes",
                "POST",
                { object, scopes: ["screen"], objectVersion: "v1" },
                tokenB,
              )
            ).status,
            400,
          );
        },
      );
      const conversion = {
        object,
        idempotencyKey: `acceptance:${id}`,
        eventType: "request_created",
      };
      let evidence;
      await t.test(
        "sixteen concurrent requests across two processes create one evidence row",
        async () => {
          const results = await Promise.all(
            Array.from({ length: 16 }, (_, i) =>
              request(
                i % 2 ? first : second,
                "/v1/conversion-evidence",
                "POST",
                conversion,
              ),
            ),
          );
          assert.equal(
            results.filter((result) => result.status === 201).length,
            1,
          );
          assert.equal(
            results.filter((result) => result.status === 200).length,
            15,
          );
          evidence = results[0].body.evidence;
          for (const result of results) {
            assert.deepEqual(result.body.evidence, evidence);
            assert.equal(result.body.evidence.payoutTriggered, false);
          }
          const rows = await pool.query(
            "SELECT count(*)::int AS count FROM infinity_conversion_evidence WHERE tenant_id=$1 AND idempotency_key=$2",
            [tenantA, conversion.idempotencyKey],
          );
          assert.equal(rows.rows[0].count, 1);
        },
      );
      await t.test(
        "changed payload cannot reuse an existing conversion key",
        async () => {
          assert.equal(
            (
              await request(second, "/v1/conversion-evidence", "POST", {
                ...conversion,
                eventType: "signup_completed",
              })
            ).status,
            400,
          );
        },
      );
      await t.test(
        "fresh API process recovers pass and identical original conversion timestamp",
        async () => {
          const previousPid = first.pid;
          await stop(first.child);
          first = await start();
          assert.notEqual(first.pid, previousPid);
          assert.equal(
            (await request(first, `/v1/passes/${issued.pass.publicId}`)).body
              .pass.publicId,
            issued.pass.publicId,
          );
          const replay = await request(
            first,
            "/v1/conversion-evidence",
            "POST",
            conversion,
          );
          assert.equal(replay.status, 200);
          assert.deepEqual(replay.body.evidence, evidence);
        },
      );
      await t.test(
        "revoked pass cannot return executable actions",
        async () => {
          assert.equal(
            (
              await request(
                first,
                `/v1/passes/${issued.pass.publicId}/revoke`,
                "POST",
                {},
              )
            ).status,
            200,
          );
          const resolved = await request(second, "/v1/resolve", "POST", {
            payload: issued.visualPayload,
          });
          assert.equal(resolved.body.resolution.authoritative, false);
          assert.deepEqual(resolved.body.actions, []);
        },
      );
      await t.test(
        "suspended tenant loses API access even when its key remains active",
        async () => {
          await pool.query(
            "UPDATE infinity_tenants SET status='suspended' WHERE id=$1",
            [tenantA],
          );
          try {
            assert.equal(
              (await request(first, `/v1/passes/${issued.pass.publicId}`))
                .status,
              401,
            );
          } finally {
            await pool.query(
              "UPDATE infinity_tenants SET status='active' WHERE id=$1",
              [tenantA],
            );
          }
        },
      );
      await t.test(
        "revoked API key cannot regain access through another process",
        async () => {
          await pool.query(
            "UPDATE infinity_api_keys SET status='revoked' WHERE tenant_id=$1",
            [tenantA],
          );
          assert.equal(
            (await request(second, `/v1/passes/${issued.pass.publicId}`))
              .status,
            401,
          );
        },
      );
    },
  );
}
