import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  OwnerAuthorization,
  PublishChangeSetInput,
} from "@tradescout-infinity/contracts";

import type {
  PluginFileInput,
  TradeScoutPluginService,
} from "./tradeScoutPlugin.js";

type Json = Record<string, unknown>;

export interface OwnerTokenAuthenticator {
  authenticateOwner(rawAccessToken: string): Promise<OwnerAuthorization | null>;
}

const TOOL_DEFINITIONS = [
  {
    name: "list_my_businesses",
    description:
      "List TradeScout businesses the authenticated owner may manage.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_business_hub",
    description: "Read the current Business Profile and Business Hub snapshot.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["business_id"],
      properties: { business_id: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "change_set.prepare",
    description:
      "Analyze compact owner instructions and authorized files into an expiring signed proposal. Does not persist or publish.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: [
        "business_id",
        "instruction",
        "files",
        "expected_profile_version",
      ],
      properties: {
        business_id: { type: "string" },
        instruction: { type: "string" },
        expected_profile_version: { type: "string" },
        files: {
          type: "array",
          items: {
            type: "object",
            required: ["fileId", "name", "mediaType"],
            properties: {
              fileId: { type: "string" },
              name: { type: "string" },
              mediaType: { type: "string" },
            },
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "change_set.publish",
    description:
      "Apply only selected proposal actions after consequential confirmation.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: [
        "proposal_token",
        "selected_action_ids",
        "expected_profile_version",
        "idempotency_key",
        "authorized_target_connection_ids",
        "publish_at",
      ],
      properties: {
        proposal_token: { type: "string" },
        selected_action_ids: { type: "array", items: { type: "string" } },
        expected_profile_version: { type: "string" },
        idempotency_key: { type: "string" },
        authorized_target_connection_ids: {
          type: "array",
          items: { type: "string" },
        },
        publish_at: { type: "string" },
      },
      additionalProperties: false,
    },
  },
] as const;

function result(value: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export async function handleMcpRequest(input: {
  body: Json;
  req: IncomingMessage;
  res: ServerResponse;
  auth: OwnerAuthorization;
  service: TradeScoutPluginService;
}): Promise<Json> {
  const { body, auth, service } = input;
  const id = body.id ?? null;
  if (body.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "tradescout", version: "0.1.0" },
      },
    };
  }
  if (body.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOL_DEFINITIONS } };
  }
  if (body.method !== "tools/call") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" },
    };
  }
  const params = (body.params ?? {}) as Json;
  const args = (params.arguments ?? {}) as Json;
  let value: unknown;
  switch (params.name) {
    case "list_my_businesses":
      value = await service.listMyBusinesses(auth);
      break;
    case "get_business_hub":
      value = await service.getBusinessHub(auth, String(args.business_id));
      break;
    case "change_set.prepare":
      value = await service.prepare(auth, {
        businessId: String(args.business_id),
        instruction: String(args.instruction),
        files: (args.files ?? []) as PluginFileInput[],
        expectedProfileVersion: String(args.expected_profile_version),
      });
      break;
    case "change_set.publish":
      value = await service.publish(auth, {
        proposalToken: String(args.proposal_token),
        selectedActionIds: args.selected_action_ids as string[],
        expectedProfileVersion: String(args.expected_profile_version),
        idempotencyKey: String(args.idempotency_key),
        authorizedTargetConnectionIds:
          args.authorized_target_connection_ids as string[],
        publishAt: String(args.publish_at),
      } satisfies PublishChangeSetInput);
      break;
    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Unknown tool" },
      };
  }
  return { jsonrpc: "2.0", id, result: result(value) };
}
