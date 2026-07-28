import type { TenantId } from "./types.js";

export const TRADE_SCOUT_PLUGIN_SCOPES = [
  "business.read",
  "profile.write",
  "services.write",
  "documents.write",
] as const;

export type TradeScoutPluginScope = (typeof TRADE_SCOUT_PLUGIN_SCOPES)[number];

export type EvidenceReviewState = "selected" | "suggested" | "unselected";
export type EvidenceSource =
  "owner_statement" | "owner_file" | "public_web" | "model_inference";

export interface EvidenceReference {
  id: string;
  source: EvidenceSource;
  reviewState: EvidenceReviewState;
  statement: string;
  observedAt: string;
  effectiveAt?: string;
  expiresAt?: string;
  sourceUrl?: string;
  fileId?: string;
  publisher?: string;
  warning?: string;
}

export interface ManagedBusinessSummary {
  id: string;
  tenantId: TenantId;
  name: string;
  slug: string;
  role: "owner" | "admin" | "manager";
  profileVersion: string;
}

export interface BusinessHubSnapshot {
  business: ManagedBusinessSummary;
  profile: Record<string, unknown>;
  services: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  inventory: Array<Record<string, unknown>>;
  portfolio: Array<Record<string, unknown>>;
  directConnect: Record<string, unknown>;
  connections: Array<{
    id: string;
    provider: string;
    capabilities: string[];
  }>;
  versions: Record<string, string>;
}

export type ChangeActionKind =
  "profile.update" | "services.upsert" | "artifact.flyer_pdf";

export interface ChangeAction {
  id: string;
  kind: ChangeActionKind;
  label: string;
  selectedByDefault: boolean;
  requiredScope: TradeScoutPluginScope;
  input: Record<string, unknown>;
  evidenceIds: string[];
  warnings: string[];
}

export interface ChangeSetProposal {
  id: string;
  businessId: string;
  expectedProfileVersion: string;
  actions: ChangeAction[];
  evidence: EvidenceReference[];
  conflicts: string[];
  unknowns: string[];
  createdAt: string;
  expiresAt: string;
}

export interface SignedChangeSetProposal {
  proposal: ChangeSetProposal;
  proposalToken: string;
}

export interface PublishChangeSetInput {
  proposalToken: string;
  selectedActionIds: string[];
  expectedProfileVersion: string;
  idempotencyKey: string;
  authorizedTargetConnectionIds: string[];
  publishAt: string | "now";
}

export interface ChangeSetReceipt {
  id: string;
  proposalId: string;
  businessId: string;
  status: "completed" | "partial" | "failed";
  appliedActionIds: string[];
  failedActions: Array<{ actionId: string; error: string }>;
  previousProfileVersion: string;
  resultingProfileVersion?: string;
  artifactUrls: string[];
  liveUrls: string[];
  rollbackToken?: string;
  createdAt: string;
}

export interface OwnerAuthorization {
  subject: string;
  tenantId: TenantId;
  scopes: TradeScoutPluginScope[];
}
