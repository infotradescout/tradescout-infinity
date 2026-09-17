import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

import {
  MemoryRegistryStore,
  RegistryService,
  SigningKeyRing,
} from "@tradescout-infinity/registry";

import { createInfinityFetchHandler } from "../dist/src/fetch.js";
import { FixedWindowRateLimiter } from "../dist/src/rateLimit.js";
import { createInfinityServer } from "../dist/src/server.js";

const object = { tenantId: "tenant_a", objectType: "fixture", objectId: "one" };
const token = "inf_local_transport_fixture";

function fixture(rateLimiter) {
  const identities = new Map([
    [token, { tenantId: "tenant_a", apiKeyId: "key_a" }],
    ["inf_foreign_fixture", { tenantId: "tenant_b", apiKeyId: "key_b" }],
  ]);
  const registry = new RegistryService(
    new MemoryRegistryStore(),
    new SigningKeyRing([
      {
        version: 1,
        status: "active",
        secret: "local-test-signing-secret-at-least-32-characters",
      },
    ]),
  );
  const dependencies = {
    registry,
    authenticator: { authenticate: async (key) => identities.get(key) ?? null },
    ...(rateLimiter ? { rateLimiter } : {}),
  };
  return {
    dependencies,
    identities,
    handler: createInfinityFetchHandler(dependencies),
  };
}

function request(path, { method = "GET", body, key, headers = {} } = {}) {
  return new Request(`https://infinity.test${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...headers,
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

async function result(response) {
  return {
    status: response.status,
    headers: Object.fromEntries(
      [
        "content-type",
        "content-length",
        "cache-control",
        "x-content-type-options",
        "retry-after",
      ].map((key) => [key, response.headers.get(key)]),
    ),
    body: await response.text(),
  };
}

test("Node and Fetch return identical statuses, errors and security headers", async (t) => {
  const { dependencies, handler } = fixture();
  const server = createInfinityServer(dependencies);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cases = [
    ["/health", {}],
    ["/missing", {}],
    ["/health", { method: "HEAD" }],
    ["/v1/resolve", { method: "POST", body: {} }],
    ["/v1/passes", { method: "POST", body: {} }],
    ["/v1/passes", { method: "POST", body: {}, key: "inf_invalid" }],
    ["/v1/passes/missing", { key: token }],
    ["/v1/passes/%", { key: token }],
    ...["{", "null", "[]", "12", ""].map((body) => [
      "/v1/passes",
      { method: "POST", key: token, body },
    ]),
  ];
  for (const [path, options] of cases) {
    const nativeRequest = request(path, options);
    const native = await fetch(new Request(base + path, nativeRequest));
    const standard = await handler.fetch(request(path, options));
    assert.deepEqual(await result(standard), await result(native), path);
  }
});

test("Fetch keeps signed public resolution, tenant isolation, revocation and non-payable evidence", async () => {
  const { handler, identities } = fixture();
  const issuedResponse = await handler.fetch(
    request("/v1/passes", {
      method: "POST",
      key: token,
      body: {
        object,
        scopes: ["screen", "action"],
        objectVersion: "v1",
        actions: [
          {
            id: "inspect",
            kind: "open",
            label: "Inspect",
            destination: "/fixture",
          },
        ],
      },
    }),
  );
  assert.equal(issuedResponse.status, 201);
  const issued = await issuedResponse.json();
  const resolve = (payload) =>
    handler.fetch(
      request("/v1/resolve", { method: "POST", body: { payload } }),
    );
  const resolved = await (await resolve(issued.visualPayload)).json();
  assert.equal(resolved.resolution.authoritative, true);
  assert.equal(resolved.resolution.payableAttribution, false);
  assert.equal(resolved.actions[0].destination, "/fixture");
  const tampered = await (
    await resolve({ ...issued.visualPayload, signature: "tampered" })
  ).json();
  assert.equal(tampered.resolution.authoritative, false);
  assert.deepEqual(tampered.actions, []);

  for (const [path, method] of [
    [`/v1/passes/${issued.pass.publicId}`, "GET"],
    [`/v1/passes/${issued.pass.publicId}/revoke`, "POST"],
  ]) {
    assert.equal(
      (
        await handler.fetch(
          request(path, { method, key: "inf_foreign_fixture" }),
        )
      ).status,
      404,
    );
  }
  const evidenceRequest = () =>
    request("/v1/conversion-evidence", {
      method: "POST",
      key: token,
      headers: { "idempotency-key": "transport:header-wins" },
      body: {
        object,
        idempotencyKey: "body-key",
        eventType: "request_created",
      },
    });
  const first = await handler.fetch(evidenceRequest());
  assert.equal(first.status, 201);
  const evidence = (await first.json()).evidence;
  assert.equal(evidence.idempotencyKey, "transport:header-wins");
  assert.equal(evidence.payoutTriggered, false);
  const replay = await handler.fetch(evidenceRequest());
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).evidence, evidence);

  const revoked = await handler.fetch(
    request(`/v1/passes/${issued.pass.publicId}/revoke`, {
      method: "POST",
      key: token,
    }),
  );
  assert.equal(revoked.status, 200);
  const afterRevoke = await (await resolve(issued.visualPayload)).json();
  assert.equal(afterRevoke.resolution.authoritative, false);
  assert.deepEqual(afterRevoke.actions, []);
  identities.delete(token);
  assert.equal((await handler.fetch(evidenceRequest())).status, 401);
});

test("all protected routes reject credentials before reading the request stream", async () => {
  const { handler } = fixture();
  for (const path of [
    "/v1/passes",
    "/v1/attribution-touches",
    "/v1/passes/one/revoke",
    "/v1/conversion-evidence",
    "/v1/selective-inheritance/evaluations",
  ]) {
    let pulls = 0;
    const stream = new ReadableStream(
      {
        pull() {
          pulls += 1;
        },
      },
      { highWaterMark: 0 },
    );
    const response = await handler.fetch(
      new Request(`https://infinity.test${path}`, {
        method: "POST",
        body: stream,
        duplex: "half",
      }),
    );
    assert.equal(response.status, 401, path);
    assert.equal(pulls, 0, path);
    await stream.cancel();
  }
});

test("streamed JSON preserves split UTF-8 bytes and the exact one-million-byte ceiling", async () => {
  const { handler } = fixture();
  const value = JSON.stringify({
    object,
    scopes: ["screen"],
    objectVersion: "crème 雪",
  });
  const bytes = new TextEncoder().encode(value);
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) controller.close();
      else controller.enqueue(bytes.subarray(offset, ++offset));
    },
  });
  const issued = await handler.fetch(
    new Request("https://infinity.test/v1/passes", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: stream,
      duplex: "half",
    }),
  );
  assert.equal(issued.status, 201);
  assert.equal((await issued.json()).pass.version.objectVersion, "crème 雪");

  const exactBody = JSON.stringify({ padding: "x".repeat(1_000_000 - 14) });
  assert.equal(Buffer.byteLength(exactBody), 1_000_000);
  assert.equal(
    (
      await handler.fetch(
        request("/v1/resolve", { method: "POST", body: exactBody }),
      )
    ).status,
    200,
  );
  const tooBig = await handler.fetch(
    request("/v1/resolve", { method: "POST", body: `${exactBody} ` }),
  );
  assert.equal(tooBig.status, 413);
  assert.deepEqual(await tooBig.json(), { error: "request_too_large" });
});

test("oversized streams are cancelled without buffering their remaining bytes", async () => {
  const { handler } = fixture();
  let reads = 0;
  let cancelled = false;
  const stream = new ReadableStream(
    {
      pull(controller) {
        reads += 1;
        controller.enqueue(new Uint8Array(250_001));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const response = await handler.fetch(
    new Request("https://infinity.test/v1/resolve", {
      method: "POST",
      body: stream,
      duplex: "half",
    }),
  );
  assert.equal(response.status, 413);
  assert.equal(reads, 4);
  assert.equal(cancelled, true);
});

test("forwarded headers cannot create new Fetch rate-limit identities", async () => {
  const { handler } = fixture(new FixedWindowRateLimiter(2, 60_000));
  for (let i = 0; i < 3; i += 1) {
    const response = await handler.fetch(
      request("/health", {
        headers: {
          "x-forwarded-for": `192.0.2.${i}`,
          "x-real-ip": `192.0.2.${i}`,
          forwarded: `for=192.0.2.${i}`,
        },
      }),
    );
    assert.equal(response.status, i < 2 ? 200 : 429);
    if (i === 2) {
      assert.ok(Number(response.headers.get("retry-after")) > 0);
      assert.deepEqual(await response.json(), { error: "rate_limited" });
    }
  }
});

test("default Neon entrypoint starts without a listening socket and rejects missing configuration", () => {
  const moduleUrl = new URL("../dist/src/neon.js", import.meta.url).href;
  const source = `
    const { default: handler } = await import(${JSON.stringify(moduleUrl)});
    const health = await handler.fetch(new Request("https://infinity.test/health"));
    if (health.status !== 200) throw new Error("Health check failed");
    const denied = await handler.fetch(new Request("https://infinity.test/v1/passes", {method:"POST"}));
    if (denied.status !== 401) throw new Error("Authentication failed open");
  `;
  const env = {
    ...process.env,
    DATABASE_URL: "postgresql://fixture@127.0.0.1:1/unreachable_fixture",
    INFINITY_SIGNING_KEYS_JSON: JSON.stringify([
      {
        version: 1,
        status: "active",
        secret: "local-test-signing-secret-at-least-32-characters",
      },
    ]),
  };
  const invoke = (environment) =>
    spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      env: environment,
      encoding: "utf8",
      timeout: 10_000,
    });
  const healthy = invoke(env);
  assert.equal(healthy.error, undefined);
  assert.equal(healthy.status, 0, healthy.stderr);
  for (const name of ["DATABASE_URL", "INFINITY_SIGNING_KEYS_JSON"]) {
    const failed = invoke({ ...env, [name]: "" });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, new RegExp(`${name} is required`));
  }
});
