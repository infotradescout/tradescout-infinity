import assert from "node:assert/strict";
import test from "node:test";

import type { OwnerAuthorization } from "@tradescout-infinity/contracts";

import { TradeScoutHttpOwnerAdapter } from "../src/tradeScoutHttpAdapter.js";

const auth: OwnerAuthorization = {
  subject: "owner_1",
  tenantId: "tenant_1" as any,
  scopes: ["business.read"],
};

test("HTTP adapter binds owner subject server-side and never trusts business ownership", async () => {
  let request: { url: string; init: RequestInit | undefined } | undefined;
  const adapter = new TradeScoutHttpOwnerAdapter({
    baseUrl: "https://api.thetradescout.com",
    serviceToken: "service-secret",
    fetch: async (url, init) => {
      request = { url: String(url), init };
      return Response.json([]);
    },
  });
  await adapter.listBusinesses(auth);
  assert.equal(
    request?.url,
    "https://api.thetradescout.com/api/plugin/v1/businesses",
  );
  assert.equal(
    new Headers(request?.init?.headers).get("x-tradescout-oauth-subject"),
    "owner_1",
  );
  assert.equal(
    new Headers(request?.init?.headers).get("authorization"),
    "Bearer service-secret",
  );
});

test("HTTP adapter fails closed on authorization errors", async () => {
  const adapter = new TradeScoutHttpOwnerAdapter({
    baseUrl: "https://api.thetradescout.com",
    serviceToken: "service-secret",
    fetch: async () => new Response(null, { status: 403 }),
  });
  await assert.rejects(adapter.getBusinessHub(auth, "not-owned"), /forbidden/);
});
