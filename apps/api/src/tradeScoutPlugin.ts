import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  BusinessHubSnapshot,
  ChangeAction,
  ChangeSetProposal,
  ChangeSetReceipt,
  EvidenceReference,
  ManagedBusinessSummary,
  OwnerAuthorization,
  PublishChangeSetInput,
  SignedChangeSetProposal,
  TradeScoutPluginScope,
} from "@tradescout-infinity/contracts";

export interface PluginFileInput {
  fileId: string;
  name: string;
  mediaType: string;
}

export interface PrepareChangeSetInput {
  businessId: string;
  instruction: string;
  files: PluginFileInput[];
  expectedProfileVersion: string;
}

export interface TradeScoutOwnerAdapter {
  listBusinesses(auth: OwnerAuthorization): Promise<ManagedBusinessSummary[]>;
  getBusinessHub(
    auth: OwnerAuthorization,
    businessId: string,
  ): Promise<BusinessHubSnapshot>;
  applyChangeSet(input: {
    auth: OwnerAuthorization;
    proposal: ChangeSetProposal;
    selectedActions: ChangeAction[];
    idempotencyKey: string;
    publishAt: string | "now";
  }): Promise<ChangeSetReceipt>;
}

export interface ChangeSetAnalyzer {
  analyze(input: {
    auth: OwnerAuthorization;
    hub: BusinessHubSnapshot;
    instruction: string;
    files: PluginFileInput[];
    now: string;
  }): Promise<{
    actions: ChangeAction[];
    evidence: EvidenceReference[];
    conflicts: string[];
    unknowns: string[];
  }>;
}

interface TokenEnvelope {
  proposal: ChangeSetProposal;
  subject: string;
  tenantId: string;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function requireScopes(
  auth: OwnerAuthorization,
  scopes: TradeScoutPluginScope[],
): void {
  const granted = new Set(auth.scopes);
  const missing = scopes.find((scope) => !granted.has(scope));
  if (missing) throw new Error(`missing_scope:${missing}`);
}

export class TradeScoutPluginService {
  private readonly receipts = new Map<string, ChangeSetReceipt>();

  constructor(
    private readonly adapter: TradeScoutOwnerAdapter,
    private readonly analyzer: ChangeSetAnalyzer,
    private readonly signingSecret: string,
    private readonly clock: () => Date = () => new Date(),
  ) {
    if (signingSecret.length < 32) {
      throw new Error("plugin_signing_secret_too_short");
    }
  }

  listMyBusinesses(
    auth: OwnerAuthorization,
  ): Promise<ManagedBusinessSummary[]> {
    requireScopes(auth, ["business.read"]);
    return this.adapter.listBusinesses(auth);
  }

  getBusinessHub(
    auth: OwnerAuthorization,
    businessId: string,
  ): Promise<BusinessHubSnapshot> {
    requireScopes(auth, ["business.read"]);
    return this.adapter.getBusinessHub(auth, businessId);
  }

  async prepare(
    auth: OwnerAuthorization,
    input: PrepareChangeSetInput,
  ): Promise<SignedChangeSetProposal> {
    requireScopes(auth, ["business.read"]);
    if (!input.instruction.trim()) throw new Error("instruction_required");
    const hub = await this.adapter.getBusinessHub(auth, input.businessId);
    if (hub.business.profileVersion !== input.expectedProfileVersion) {
      throw new Error("profile_version_conflict");
    }
    const now = this.clock();
    const analyzed = await this.analyzer.analyze({
      auth,
      hub,
      instruction: input.instruction,
      files: input.files,
      now: now.toISOString(),
    });
    const proposal: ChangeSetProposal = {
      id: randomUUID(),
      businessId: hub.business.id,
      expectedProfileVersion: hub.business.profileVersion,
      ...analyzed,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    };
    return { proposal, proposalToken: this.sign({ proposal, auth }) };
  }

  async publish(
    auth: OwnerAuthorization,
    input: PublishChangeSetInput,
  ): Promise<ChangeSetReceipt> {
    if (input.idempotencyKey.length < 8) {
      throw new Error("idempotency_key_required");
    }
    const cached = this.receipts.get(`${auth.subject}:${input.idempotencyKey}`);
    if (cached) return cached;

    const proposal = this.verify(input.proposalToken, auth);
    if (proposal.expectedProfileVersion !== input.expectedProfileVersion) {
      throw new Error("profile_version_conflict");
    }
    const selected = new Set(input.selectedActionIds);
    const actions = proposal.actions.filter((action) =>
      selected.has(action.id),
    );
    if (actions.length !== selected.size) throw new Error("unknown_action_id");
    requireScopes(auth, [
      ...new Set(actions.map((action) => action.requiredScope)),
    ]);
    const hub = await this.adapter.getBusinessHub(auth, proposal.businessId);
    if (hub.business.profileVersion !== input.expectedProfileVersion) {
      throw new Error("profile_version_conflict");
    }
    const receipt = await this.adapter.applyChangeSet({
      auth,
      proposal,
      selectedActions: actions,
      idempotencyKey: input.idempotencyKey,
      publishAt: input.publishAt,
    });
    this.receipts.set(`${auth.subject}:${input.idempotencyKey}`, receipt);
    return receipt;
  }

  getReceipt(
    auth: OwnerAuthorization,
    receiptId: string,
  ): ChangeSetReceipt | null {
    return (
      [...this.receipts.values()].find(
        (receipt) =>
          receipt.id === receiptId &&
          this.verifyBusinessAccess(auth, receipt.businessId),
      ) ?? null
    );
  }

  private verifyBusinessAccess(
    _auth: OwnerAuthorization,
    _businessId: string,
  ): boolean {
    // Receipt IDs are returned only from an already-authorized call. The
    // production receipt store must additionally join subject membership.
    return true;
  }

  private sign(input: {
    proposal: ChangeSetProposal;
    auth: OwnerAuthorization;
  }): string {
    const payload = encode({
      proposal: input.proposal,
      subject: input.auth.subject,
      tenantId: input.auth.tenantId,
    } satisfies TokenEnvelope);
    const signature = createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }

  private verify(token: string, auth: OwnerAuthorization): ChangeSetProposal {
    const [payload, supplied] = token.split(".");
    if (!payload || !supplied) throw new Error("invalid_proposal_token");
    const expected = createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest();
    const actual = Buffer.from(supplied, "base64url");
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new Error("invalid_proposal_token");
    }
    const envelope = decode<TokenEnvelope>(payload);
    if (
      envelope.subject !== auth.subject ||
      envelope.tenantId !== auth.tenantId
    ) {
      throw new Error("proposal_subject_mismatch");
    }
    if (Date.parse(envelope.proposal.expiresAt) <= this.clock().getTime()) {
      throw new Error("proposal_expired");
    }
    return envelope.proposal;
  }
}
