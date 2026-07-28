import type {
  BusinessHubSnapshot,
  ChangeAction,
  ChangeSetProposal,
  ChangeSetReceipt,
  ManagedBusinessSummary,
  OwnerAuthorization,
} from "@tradescout-infinity/contracts";

import type { TradeScoutOwnerAdapter } from "./tradeScoutPlugin.js";

export interface TradeScoutHttpAdapterConfig {
  baseUrl: string;
  serviceToken: string;
  fetch?: typeof globalThis.fetch;
}

function assertHttps(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("tradescout_https_required");
  return url.toString().replace(/\/$/, "");
}

export class TradeScoutHttpOwnerAdapter implements TradeScoutOwnerAdapter {
  private readonly baseUrl: string;
  private readonly request: typeof globalThis.fetch;

  constructor(private readonly config: TradeScoutHttpAdapterConfig) {
    this.baseUrl = assertHttps(config.baseUrl);
    if (!config.serviceToken)
      throw new Error("tradescout_service_token_required");
    this.request = config.fetch ?? globalThis.fetch;
  }

  listBusinesses(auth: OwnerAuthorization): Promise<ManagedBusinessSummary[]> {
    return this.call(auth, "/api/plugin/v1/businesses", { method: "GET" });
  }

  getBusinessHub(
    auth: OwnerAuthorization,
    businessId: string,
  ): Promise<BusinessHubSnapshot> {
    return this.call(
      auth,
      `/api/plugin/v1/businesses/${encodeURIComponent(businessId)}/hub`,
      { method: "GET" },
    );
  }

  applyChangeSet(input: {
    auth: OwnerAuthorization;
    proposal: ChangeSetProposal;
    selectedActions: ChangeAction[];
    idempotencyKey: string;
    publishAt: string | "now";
    authorizedTargetConnectionIds: string[];
  }): Promise<ChangeSetReceipt> {
    return this.call(input.auth, "/api/plugin/v1/change-sets/publish", {
      method: "POST",
      headers: { "idempotency-key": input.idempotencyKey },
      body: JSON.stringify({
        proposal: input.proposal,
        selectedActions: input.selectedActions,
        publishAt: input.publishAt,
        authorizedTargetConnectionIds: input.authorizedTargetConnectionIds,
      }),
    });
  }

  private async call<T>(
    auth: OwnerAuthorization,
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await this.request(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${this.config.serviceToken}`,
        "content-type": "application/json",
        "x-tradescout-oauth-subject": auth.subject,
        "x-tradescout-tenant-id": auth.tenantId,
      },
      redirect: "error",
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("forbidden");
      }
      if (response.status === 409) throw new Error("profile_version_conflict");
      throw new Error(`tradescout_adapter_error:${response.status}`);
    }
    return (await response.json()) as T;
  }
}
