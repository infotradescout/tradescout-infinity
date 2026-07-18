import type {
  ConversionEvidence,
  PublicPassId,
  ScreenPass,
  ScreenPassAction,
  TenantId,
} from "@tradescout-infinity/contracts";

export interface StoredPass {
  pass: ScreenPass;
  actions: ScreenPassAction[];
}

export interface StoredConversionEvidence {
  evidence: ConversionEvidence;
  payloadDigest: string;
}

export interface RegistryStore {
  createPass(record: StoredPass): Promise<void>;
  findPass(publicId: PublicPassId): Promise<StoredPass | null>;
  revokePass(params: {
    tenantId: TenantId;
    publicId: PublicPassId;
    revokedAt: string;
  }): Promise<StoredPass | null>;
  recordConversionEvidence(
    record: StoredConversionEvidence,
  ): Promise<{ created: boolean; record: StoredConversionEvidence }>;
}
