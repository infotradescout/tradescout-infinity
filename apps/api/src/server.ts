import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import type {
  InfinityObjectReference,
  AttributionCarrier,
  PartnerId,
  ProgramId,
  PublicPassId,
  ScreenPassAction,
  ScreenPassAttribution,
  ScreenPassScope,
  TenantId,
  VisualPassPayload,
} from "@tradescout-infinity/contracts";
import type { RegistryService } from "@tradescout-infinity/registry";

import type { ApiKeyAuthenticator, AuthenticatedTenant } from "./auth.js";
import { FixedWindowRateLimiter } from "./rateLimit.js";

const MAX_BODY_BYTES = 1_000_000;

type JsonObject = Record<string, unknown>;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_BODY_BYTES) throw new Error("request_too_large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_json_object");
  }
  return parsed as JsonObject;
}

function bearerToken(req: IncomingMessage): string {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function authenticate(
  req: IncomingMessage,
  res: ServerResponse,
  authenticator: ApiKeyAuthenticator,
): Promise<AuthenticatedTenant | null> {
  const token = bearerToken(req);
  const tenant = token ? await authenticator.authenticate(token) : null;
  if (!tenant) sendJson(res, 401, { error: "unauthorized" });
  return tenant;
}

function asObjectReference(value: unknown): InfinityObjectReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("object_reference_required");
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.tenantId !== "string" ||
    typeof candidate.objectType !== "string" ||
    typeof candidate.objectId !== "string"
  ) {
    throw new Error("invalid_object_reference");
  }
  return candidate as unknown as InfinityObjectReference;
}

export function createInfinityServer(params: {
  registry: RegistryService;
  authenticator: ApiKeyAuthenticator;
  rateLimiter?: FixedWindowRateLimiter;
}) {
  const limiter = params.rateLimiter ?? new FixedWindowRateLimiter(120, 60_000);

  return createServer(async (req, res) => {
    const method = req.method || "GET";
    const url = new URL(req.url || "/", "http://infinity.local");
    const clientKey = String(req.socket.remoteAddress || "unknown");
    const rate = limiter.take(`${clientKey}:${url.pathname}`);
    if (!rate.allowed) {
      res.setHeader("retry-after", String(rate.retryAfterSeconds));
      sendJson(res, 429, { error: "rate_limited" });
      return;
    }

    try {
      if (method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { status: "ok" });
        return;
      }

      if (method === "POST" && url.pathname === "/v1/passes") {
        const auth = await authenticate(req, res, params.authenticator);
        if (!auth) return;
        const body = await readJson(req);
        const object = asObjectReference(body.object);
        const issued = await params.registry.issuePass({
          tenantId: auth.tenantId,
          object,
          scopes: body.scopes as ScreenPassScope[],
          actions: (body.actions || []) as ScreenPassAction[],
          ...(body.attribution
            ? { attribution: body.attribution as ScreenPassAttribution }
            : {}),
          objectVersion: String(body.objectVersion || ""),
          ...(typeof body.renderedAt === "string"
            ? { renderedAt: body.renderedAt }
            : {}),
          ...(typeof body.expiresAt === "string"
            ? { expiresAt: body.expiresAt }
            : {}),
        });
        sendJson(res, 201, issued);
        return;
      }

      if (method === "POST" && url.pathname === "/v1/attribution-touches") {
        const auth = await authenticate(req, res, params.authenticator);
        if (!auth) return;
        const body = await readJson(req);
        const targetBody = body.target as JsonObject;
        const touch = await params.registry.recordAttributionTouch({
          tenantId: auth.tenantId,
          programId: String(body.programId || "") as ProgramId,
          partnerId: String(body.partnerId || "") as PartnerId,
          ...(typeof body.linkId === "string" ? { linkId: body.linkId } : {}),
          carrier: String(body.carrier || "") as AttributionCarrier,
          target: {
            tenantId: auth.tenantId,
            object: asObjectReference(targetBody?.object),
            canonicalPath: String(targetBody?.canonicalPath || ""),
            ...(typeof targetBody?.actionId === "string"
              ? { actionId: targetBody.actionId }
              : {}),
          },
          ...(typeof body.occurredAt === "string"
            ? { occurredAt: body.occurredAt }
            : {}),
          evidence: body.evidence ?? {},
        });
        sendJson(res, 201, { touch });
        return;
      }

      const passMatch = url.pathname.match(/^\/v1\/passes\/([^/]+)$/);
      if (method === "GET" && passMatch?.[1]) {
        const auth = await authenticate(req, res, params.authenticator);
        if (!auth) return;
        const record = await params.registry.getPass(
          auth.tenantId,
          decodeURIComponent(passMatch[1]) as PublicPassId,
        );
        sendJson(
          res,
          record ? 200 : 404,
          record ?? { error: "pass_not_found" },
        );
        return;
      }

      const revokeMatch = url.pathname.match(/^\/v1\/passes\/([^/]+)\/revoke$/);
      if (method === "POST" && revokeMatch?.[1]) {
        const auth = await authenticate(req, res, params.authenticator);
        if (!auth) return;
        const record = await params.registry.revokePass(
          auth.tenantId,
          decodeURIComponent(revokeMatch[1]) as PublicPassId,
        );
        sendJson(
          res,
          record ? 200 : 404,
          record ?? { error: "pass_not_found" },
        );
        return;
      }

      if (method === "POST" && url.pathname === "/v1/resolve") {
        const body = await readJson(req);
        const result = await params.registry.resolve({
          payload: body.payload as VisualPassPayload,
          ...(typeof body.currentObjectVersion === "string"
            ? { currentObjectVersion: body.currentObjectVersion }
            : {}),
        });
        sendJson(res, 200, result);
        return;
      }

      if (method === "POST" && url.pathname === "/v1/conversion-evidence") {
        const auth = await authenticate(req, res, params.authenticator);
        if (!auth) return;
        const body = await readJson(req);
        const result = await params.registry.recordConversion({
          tenantId: auth.tenantId,
          object: asObjectReference(body.object),
          idempotencyKey: String(
            req.headers["idempotency-key"] || body.idempotencyKey || "",
          ),
          eventType: String(body.eventType || ""),
          ...(typeof body.occurredAt === "string"
            ? { occurredAt: body.occurredAt }
            : {}),
          ...(typeof body.attributionProofId === "string"
            ? { attributionProofId: body.attributionProofId }
            : {}),
          ...(typeof body.attributionAssignmentId === "string"
            ? { attributionAssignmentId: body.attributionAssignmentId }
            : {}),
        });
        sendJson(res, result.created ? 201 : 200, result);
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "invalid_request";
      const safeCode = /^[a-z0-9_ -]{1,120}$/i.test(message)
        ? message.replaceAll(" ", "_").toLowerCase()
        : "invalid_request";
      sendJson(res, message === "request_too_large" ? 413 : 400, {
        error: safeCode,
      });
    }
  });
}
