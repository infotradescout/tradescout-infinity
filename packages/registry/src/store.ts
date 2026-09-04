import type {
  AttributionTouch,
  ConversionEvidence,
} from "@tradescout-infinity/contracts";

export interface StoredConversionEvidence {
  evidence: ConversionEvidence;
  payloadDigest: string;
}

export interface StoredAttributionTouch {
  touch: AttributionTouch;
}

export interface RegistryStore {
  recordAttributionTouch(record: StoredAttributionTouch): Promise<void>;
  recordConversionEvidence(
    record: StoredConversionEvidence,
  ): Promise<{ created: boolean; record: StoredConversionEvidence }>;
}
