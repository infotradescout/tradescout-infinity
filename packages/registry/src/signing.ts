import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  PublicPassId,
  TenantId,
  VisualPassPayload,
} from "@tradescout-infinity/contracts";

export interface SigningKey {
  version: number;
  secret: string;
  status: "active" | "verify_only";
}

function signingMessage(params: {
  tenantId: TenantId;
  publicId: PublicPassId;
  signatureVersion: number;
}): string {
  return `${params.tenantId}:${params.publicId}:${params.signatureVersion}`;
}

export class SigningKeyRing {
  readonly #keys: Map<number, SigningKey>;
  readonly #active: SigningKey;

  constructor(keys: SigningKey[]) {
    if (keys.length === 0)
      throw new Error("At least one signing key is required");
    this.#keys = new Map(keys.map((key) => [key.version, key]));
    if (this.#keys.size !== keys.length)
      throw new Error("Signing key versions must be unique");

    const active = keys.filter((key) => key.status === "active");
    if (active.length !== 1)
      throw new Error("Exactly one active signing key is required");
    const activeKey = active[0];
    if (!activeKey) throw new Error("Active signing key is required");
    if (activeKey.secret.length < 32)
      throw new Error("Signing key must contain at least 32 characters");
    for (const key of keys) {
      if (!Number.isInteger(key.version) || key.version < 1) {
        throw new Error("Signing key version must be a positive integer");
      }
      if (key.secret.length < 32)
        throw new Error("Signing key must contain at least 32 characters");
    }
    this.#active = activeKey;
  }

  get activeVersion(): number {
    return this.#active.version;
  }

  sign(params: {
    tenantId: TenantId;
    publicId: PublicPassId;
  }): VisualPassPayload {
    const signature = createHmac("sha256", this.#active.secret)
      .update(
        signingMessage({
          ...params,
          signatureVersion: this.#active.version,
        }),
      )
      .digest("base64url");
    return {
      publicId: params.publicId,
      signatureVersion: this.#active.version,
      signature,
    };
  }

  verify(params: { tenantId: TenantId; payload: VisualPassPayload }): boolean {
    const key = this.#keys.get(params.payload.signatureVersion);
    if (!key) return false;
    const expected = createHmac("sha256", key.secret)
      .update(
        signingMessage({
          tenantId: params.tenantId,
          publicId: params.payload.publicId,
          signatureVersion: params.payload.signatureVersion,
        }),
      )
      .digest();
    let received: Buffer;
    try {
      received = Buffer.from(params.payload.signature, "base64url");
    } catch {
      return false;
    }
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }
}
