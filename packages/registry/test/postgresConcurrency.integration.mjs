import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import {
  PostgresRegistryStore,
  RegistryService,
  SigningKeyRing,
} from "../dist/src/index.js";
import { PostgresApiKeyAuthenticator } from "../../../apps/api/dist/src/auth.js";
import { createInfinityServer } from "../../../apps/api/dist/src/server.js";

const { Pool } = pg;
const scriptPath = fileURLToPath(import.meta.url);
const disposableDatabasePattern = /^codex_rw2_infinity_[a-z0-9_]+$/;
const allowedLoopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

function connectionConfig(max = 20) {
  const host = process.env.INFINITY_TEST_PGHOST || "127.0.0.1";
  const database = process.env.INFINITY_TEST_PGDATABASE || "";
  assert.equal(
    process.env.INFINITY_TEST_ALLOW_DISPOSABLE_DB,
    "YES",
    "INFINITY_TEST_ALLOW_DISPOSABLE_DB must be YES",
  );
  assert.ok(
    allowedLoopbackHosts.has(host),
    "PostgreSQL concurrency integration requires a loopback host",
  );
  assert.match(
    database,
    disposableDatabasePattern,
    "PostgreSQL concurrency integration requires a disposable database name",
  );
  return {
    host,
    port: Number(process.env.INFINITY_TEST_PGPORT || 55432),
    user: process.env.INFINITY_TEST_PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database,
    max,
  };
}

function serviceFor(database) {
  return new RegistryService(
    new PostgresRegistryStore(database),
    new SigningKeyRing([
      { version: 1, secret: "w".repeat(64), status: "active" },
    ]),
  );
}

function objectFor(tenantId) {
  return {
    tenantId,
    objectType: "wave2_test_object",
    objectId: "wave2-object-1",
  };
}

function errorChainIncludes(error, expectedMessage) {
  let current = error;
  const visited = new Set();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    if (
      typeof current.message === "string" &&
      current.message.includes(expectedMessage)
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

function safeErrorCode(error) {
  let current = error;
  const visited = new Set();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    if (
      typeof current.code === "string" &&
      /^[A-Z0-9_]{1,32}$/i.test(current.code)
    ) {
      return current.code;
    }
    current = current.cause;
  }
  return error instanceof assert.AssertionError ? "ASSERTION_FAILED" : "ERROR";
}

async function worker(payloadText) {
  const payload = JSON.parse(
    Buffer.from(payloadText, "base64url").toString("utf8"),
  );
  const delay = Math.max(0, Number(payload.startAt || 0) - Date.now());
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  const pool = new Pool(connectionConfig(1));
  try {
    const database = drizzle(pool);
    const result = await serviceFor(database).recordConversion(payload.input);
    process.stdout.write(
      JSON.stringify({
        created: result.created,
        evidenceId: result.evidence.evidenceId,
        occurredAt: result.evidence.occurredAt,
      }),
    );
  } finally {
    await pool.end();
  }
}

function spawnWorker(input, startAt = 0) {
  const payload = Buffer.from(JSON.stringify({ input, startAt })).toString(
    "base64url",
  );
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, "worker", payload], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `worker exited ${String(code)}: ${stderr.trim() || "no diagnostic"}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `worker returned invalid JSON: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    });
  });
}

async function countEvidence(pool, tenantId, idempotencyKey) {
  const result = await pool.query(
    `SELECT count(*)::integer AS count
       FROM infinity_conversion_evidence
      WHERE tenant_id = $1 AND idempotency_key = $2`,
    [tenantId, idempotencyKey],
  );
  return result.rows[0].count;
}

async function requestConversion({
  port,
  token,
  tenantId,
  idempotencyKey,
  eventType = "request_created",
}) {
  const response = await fetch(
    `http://127.0.0.1:${port}/v1/conversion-evidence`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        object: objectFor(tenantId),
        eventType,
      }),
    },
  );
  return { status: response.status, body: await response.json() };
}

async function main() {
  const config = connectionConfig();
  const pool = new Pool(config);
  const database = drizzle(pool);
  const service = serviceFor(database);
  let server;

  try {
    const identity = await pool.query(
      "SELECT current_database() AS database, inet_server_addr()::text AS address",
    );
    assert.equal(identity.rows[0].database, config.database);
    const initialRows = await pool.query(
      "SELECT count(*)::integer AS count FROM infinity_conversion_evidence",
    );
    assert.equal(
      initialRows.rows[0].count,
      0,
      "disposable integration database must begin empty",
    );

    const constraint = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conname = 'infinity_conversion_idempotency_unique'`,
    );
    assert.equal(constraint.rowCount, 1);
    assert.match(
      constraint.rows[0].definition,
      /UNIQUE \(tenant_id, idempotency_key\)/,
    );

    const tenantA = "wave2-tenant-a";
    const tenantB = "wave2-tenant-b";

    const concurrentInput = {
      tenantId: tenantA,
      object: objectFor(tenantA),
      idempotencyKey: "wave2:concurrent-same-payload",
      eventType: "request_created",
    };
    const startAt = Date.now() + 3_000;
    const concurrent = await Promise.all(
      Array.from({ length: 12 }, () => spawnWorker(concurrentInput, startAt)),
    );
    assert.equal(concurrent.filter((result) => result.created).length, 1);
    assert.equal(concurrent.filter((result) => !result.created).length, 11);
    assert.equal(
      new Set(concurrent.map((result) => result.evidenceId)).size,
      1,
    );
    assert.equal(
      new Set(concurrent.map((result) => result.occurredAt)).size,
      1,
    );
    assert.equal(
      await countEvidence(pool, tenantA, concurrentInput.idempotencyKey),
      1,
    );

    const sequentialReplay = await service.recordConversion(concurrentInput);
    assert.equal(sequentialReplay.created, false);
    assert.equal(
      sequentialReplay.evidence.evidenceId,
      concurrent[0].evidenceId,
    );
    await assert.rejects(
      service.recordConversion({
        ...concurrentInput,
        eventType: "signup_completed",
      }),
      /Idempotency key reused with different payload/,
    );
    assert.equal(
      await countEvidence(pool, tenantA, concurrentInput.idempotencyKey),
      1,
    );

    const restartInput = {
      tenantId: tenantA,
      object: objectFor(tenantA),
      idempotencyKey: "wave2:process-restart",
      eventType: "request_created",
    };
    const beforeRestart = await spawnWorker(restartInput);
    const afterRestart = await spawnWorker(restartInput);
    assert.equal(beforeRestart.created, true);
    assert.equal(afterRestart.created, false);
    assert.equal(beforeRestart.evidenceId, afterRestart.evidenceId);
    assert.equal(beforeRestart.occurredAt, afterRestart.occurredAt);
    assert.equal(
      await countEvidence(pool, tenantA, restartInput.idempotencyKey),
      1,
    );

    await pool.query(`
      CREATE SEQUENCE infinity_wave2_fail_once_seq START WITH 1;
      CREATE FUNCTION infinity_wave2_fail_once()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.idempotency_key = 'wave2:failed-first'
           AND nextval('infinity_wave2_fail_once_seq') = 1 THEN
          RAISE EXCEPTION 'wave2_simulated_prewrite_failure';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER infinity_wave2_fail_once_trigger
      BEFORE INSERT ON infinity_conversion_evidence
      FOR EACH ROW
      EXECUTE FUNCTION infinity_wave2_fail_once();
    `);

    const failedFirstInput = {
      tenantId: tenantA,
      object: objectFor(tenantA),
      idempotencyKey: "wave2:failed-first",
      eventType: "request_created",
    };
    try {
      let firstFailure;
      try {
        await service.recordConversion(failedFirstInput);
      } catch (error) {
        firstFailure = error;
      }
      assert.ok(firstFailure, "the simulated first request must fail");
      assert.ok(
        errorChainIncludes(firstFailure, "wave2_simulated_prewrite_failure"),
        "the database failure must remain available in the error cause chain",
      );
      assert.equal(
        await countEvidence(pool, tenantA, failedFirstInput.idempotencyKey),
        0,
      );
      const retry = await service.recordConversion(failedFirstInput);
      const replay = await service.recordConversion(failedFirstInput);
      assert.equal(retry.created, true);
      assert.equal(replay.created, false);
      assert.equal(retry.evidence.evidenceId, replay.evidence.evidenceId);
      assert.equal(
        await countEvidence(pool, tenantA, failedFirstInput.idempotencyKey),
        1,
      );
    } finally {
      await pool.query(`
        DROP TRIGGER IF EXISTS infinity_wave2_fail_once_trigger
          ON infinity_conversion_evidence;
        DROP FUNCTION IF EXISTS infinity_wave2_fail_once();
        DROP SEQUENCE IF EXISTS infinity_wave2_fail_once_seq;
      `);
    }

    const rollbackInput = {
      tenantId: tenantA,
      object: objectFor(tenantA),
      idempotencyKey: "wave2:transaction-rollback",
      eventType: "request_created",
    };
    await assert.rejects(
      database.transaction(async (transaction) => {
        const result =
          await serviceFor(transaction).recordConversion(rollbackInput);
        assert.equal(result.created, true);
        throw new Error("wave2_forced_transaction_rollback");
      }),
      /wave2_forced_transaction_rollback/,
    );
    assert.equal(
      await countEvidence(pool, tenantA, rollbackInput.idempotencyKey),
      0,
    );
    const rollbackRetry = await service.recordConversion(rollbackInput);
    const rollbackReplay = await service.recordConversion(rollbackInput);
    assert.equal(rollbackRetry.created, true);
    assert.equal(rollbackReplay.created, false);
    assert.equal(
      rollbackRetry.evidence.evidenceId,
      rollbackReplay.evidence.evidenceId,
    );
    assert.equal(
      await countEvidence(pool, tenantA, rollbackInput.idempotencyKey),
      1,
    );

    const tokenA1 = `inf_${"a".repeat(40)}`;
    const tokenA2 = `inf_${"b".repeat(40)}`;
    const tokenB = `inf_${"c".repeat(40)}`;
    await pool.query(
      `INSERT INTO infinity_tenants (id, key, display_name)
       VALUES ($1, $2, $3), ($4, $5, $6)`,
      [
        tenantA,
        "wave2-business-a",
        "Wave 2 Business A",
        tenantB,
        "wave2-business-b",
        "Wave 2 Business B",
      ],
    );
    for (const [id, tenantId, name, token] of [
      ["wave2-key-a1", tenantA, "Wave 2 identity A1", tokenA1],
      ["wave2-key-a2", tenantA, "Wave 2 identity A2", tokenA2],
      ["wave2-key-b", tenantB, "Wave 2 identity B", tokenB],
    ]) {
      await pool.query(
        `INSERT INTO infinity_api_keys
          (id, tenant_id, name, key_prefix, key_hash)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          tenantId,
          name,
          token.slice(0, 12),
          createHash("sha256").update(token).digest("hex"),
        ],
      );
    }

    server = createInfinityServer({
      registry: service,
      authenticator: new PostgresApiKeyAuthenticator(database),
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const identityKey = "wave2:authenticated-identities";
    const identityA1 = await requestConversion({
      port: address.port,
      token: tokenA1,
      tenantId: tenantA,
      idempotencyKey: identityKey,
    });
    const identityA2 = await requestConversion({
      port: address.port,
      token: tokenA2,
      tenantId: tenantA,
      idempotencyKey: identityKey,
    });
    const identityB = await requestConversion({
      port: address.port,
      token: tokenB,
      tenantId: tenantB,
      idempotencyKey: identityKey,
    });

    assert.equal(identityA1.status, 201);
    assert.equal(identityA1.body.created, true);
    assert.equal(identityA2.status, 200);
    assert.equal(identityA2.body.created, false);
    assert.equal(
      identityA1.body.evidence.evidenceId,
      identityA2.body.evidence.evidenceId,
    );
    assert.equal(identityB.status, 201);
    assert.equal(identityB.body.created, true);
    assert.notEqual(
      identityA1.body.evidence.evidenceId,
      identityB.body.evidence.evidenceId,
    );
    assert.equal(await countEvidence(pool, tenantA, identityKey), 1);
    assert.equal(await countEvidence(pool, tenantB, identityKey), 1);

    const total = await pool.query(
      "SELECT count(*)::integer AS count FROM infinity_conversion_evidence",
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          result: "PASS",
          databaseConstraint: constraint.rows[0].definition,
          concurrentSamePayload: {
            processes: 12,
            created: 1,
            replayed: 11,
            durableRows: 1,
            uniqueEvidenceIds: 1,
            uniqueTimestamps: 1,
          },
          sequentialSamePayload: {
            created: false,
            durableRows: 1,
          },
          sameKeyDifferentPayload: {
            rejected: true,
            durableRows: 1,
          },
          processRestart: {
            firstProcessCreated: true,
            secondProcessReplayed: true,
            durableRows: 1,
          },
          failedFirstRetry: {
            firstFailed: true,
            rowsAfterFailure: 0,
            retryCreated: true,
            subsequentReplay: true,
            durableRows: 1,
          },
          transactionRollback: {
            rowsAfterRollback: 0,
            retryCreated: true,
            subsequentReplay: true,
            durableRows: 1,
          },
          authenticatedIdentities: {
            supportedIdentityModel: "api_key",
            sameBusinessDistinctKeysReplay: true,
            differentBusinessesCreateIndependently: true,
            humanUserIsolationClaimed: false,
            durableRowsPerBusiness: 1,
          },
          totalDurableEvidenceRows: total.rows[0].count,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    if (server) {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await pool.end();
  }
}

if (process.argv[2] === "worker") {
  try {
    await worker(process.argv[3]);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ result: "FAIL", code: safeErrorCode(error) })}\n`,
    );
    process.exitCode = 1;
  }
} else {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ result: "FAIL", code: safeErrorCode(error) })}\n`,
    );
    process.exitCode = 1;
  }
}
