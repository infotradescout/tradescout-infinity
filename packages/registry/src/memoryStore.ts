import type { PublicPassId } from "@tradescout-infinity/contracts";

import type {
  RegistryStore,
  StoredConversionEvidence,
  StoredPass,
} from "./store.js";

function copyPass(record: StoredPass): StoredPass {
  return structuredClone(record);
}

export class MemoryRegistryStore implements RegistryStore {
  readonly #passes = new Map<string, StoredPass>();
  readonly #conversionEvidence = new Map<string, StoredConversionEvidence>();

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
    const key = `${record.evidence.tenantId}:${record.evidence.idempotencyKey}`;
    const current = this.#conversionEvidence.get(key);
    if (current) {
      if (current.payloadDigest !== record.payloadDigest) {
        throw new Error("Idempotency key reused with different payload");
      }
      return { created: false, record: structuredClone(current) };
    }
    this.#conversionEvidence.set(key, structuredClone(record));
    return { created: true, record: structuredClone(record) };
  }
}
