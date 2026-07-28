import type { PublicPassId } from "@tradescout-infinity/contracts";

import type {
  RegistryStore,
  StoredAttributionTouch,
  StoredConversionEvidence,
  StoredPass,
} from "./store.js";

function copyPass(record: StoredPass): StoredPass {
  return structuredClone(record);
}

export class MemoryRegistryStore implements RegistryStore {
  readonly #passes = new Map<string, StoredPass>();
  readonly #conversionEvidence = new Map<
    string,
    Map<string, StoredConversionEvidence>
  >();
  readonly #touches = new Map<string, StoredAttributionTouch>();

  async createPass(record: StoredPass): Promise<void> {
    if (this.#passes.has(record.pass.publicId)) {
      throw new Error("Pass already exists");
    }
    this.#passes.set(record.pass.publicId, copyPass(record));
  }

  async findPass(publicId: PublicPassId): Promise<StoredPass | null> {
    const record = this.#passes.get(publicId);
    return record ? copyPass(record) : null;
  }

  async revokePass(params: {
    tenantId: StoredPass["pass"]["tenantId"];
    publicId: PublicPassId;
    revokedAt: string;
  }): Promise<StoredPass | null> {
    const current = this.#passes.get(params.publicId);
    if (!current || current.pass.tenantId !== params.tenantId) return null;

    const revoked: StoredPass = {
      ...copyPass(current),
      pass: { ...current.pass, status: "revoked" },
    };
    this.#passes.set(params.publicId, revoked);
    return copyPass(revoked);
  }

  async recordConversionEvidence(
    record: StoredConversionEvidence,
  ): Promise<{ created: boolean; record: StoredConversionEvidence }> {
    let tenantEvidence = this.#conversionEvidence.get(record.evidence.tenantId);
    if (!tenantEvidence) {
      tenantEvidence = new Map<string, StoredConversionEvidence>();
      this.#conversionEvidence.set(record.evidence.tenantId, tenantEvidence);
    }
    const current = tenantEvidence.get(record.evidence.idempotencyKey);
    if (current) {
      if (current.payloadDigest !== record.payloadDigest) {
        throw new Error("Idempotency key reused with different payload");
      }
      return { created: false, record: structuredClone(current) };
    }
    tenantEvidence.set(record.evidence.idempotencyKey, structuredClone(record));
    return { created: true, record: structuredClone(record) };
  }

  async recordAttributionTouch(record: StoredAttributionTouch): Promise<void> {
    if (this.#touches.has(record.touch.id))
      throw new Error("Touch already exists");
    this.#touches.set(record.touch.id, structuredClone(record));
  }
}
