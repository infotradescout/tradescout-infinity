import type { PublicPassId, TenantId } from "@tradescout-infinity/contracts";

export interface IssueOverlayInput {
  tenantId: TenantId;
  publicId: PublicPassId;
  width: number;
  height: number;
}

export interface OverlayResult {
  provider: string;
  carrier: string;
  expiresAt?: string;
}

export interface EmbedAssetInput {
  tenantId: TenantId;
  publicId: PublicPassId;
  bytes: Uint8Array;
  mediaType: string;
}

export interface EmbeddedAssetResult {
  provider: string;
  bytes: Uint8Array;
  mediaType: string;
}

export interface DetectAssetInput {
  tenantId: TenantId;
  bytes: Uint8Array;
  mediaType: string;
}

export interface WatermarkDetection {
  provider: string;
  publicId?: PublicPassId;
  confidence: number;
  signed: boolean;
}

export interface ProviderHealth {
  provider: string;
  status: "available" | "degraded" | "unavailable";
  checkedAt: string;
  details?: string;
}

export interface WatermarkProvider {
  issueOverlay(input: IssueOverlayInput): Promise<OverlayResult>;
  embedAsset(input: EmbedAssetInput): Promise<EmbeddedAssetResult>;
  detectAsset(input: DetectAssetInput): Promise<WatermarkDetection[]>;
  healthCheck(): Promise<ProviderHealth>;
}
