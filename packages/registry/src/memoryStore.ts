import type {
  RegistryStore,
  StoredAttributionTouch,
  StoredConversionEvidence,
} from "./store.js";

export class MemoryRegistryStore implements RegistryStore {
  readonly #conversionEvidence = new Map<string, StoredConversionEvidence>();
  readonly #touches = new Map<string, StoredAttributionTouch>();

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

  async recordAttributionTouch(record: StoredAttributionTouch): Promise<void> {
    if (this.#touches.has(record.touch.id))
      throw new Error("Touch already exists");
    this.#touches.set(record.touch.id, structuredClone(record));
  }
}
