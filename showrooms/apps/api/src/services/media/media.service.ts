import type { UploadSignature } from "@showrooms/shared";

export type ResourceType = "image" | "video";
/** `upload` is publicly deliverable; `authenticated` needs a signed URL (verification documents). */
export type DeliveryType = "upload" | "authenticated";

export interface StoredAsset {
  publicId: string;
  secureUrl: string;
  bytes: number;
  format: string;
  width?: number;
  height?: number;
  durationSec?: number;
  resourceType: ResourceType;
}

/** Media storage boundary. Binary data never touches MongoDB, only these references. */
export interface MediaService {
  readonly configured: boolean;
  signUpload(input: { publicId: string; resourceType: ResourceType; deliveryType: DeliveryType; maxBytes: number }): UploadSignature;
  getAsset(publicId: string, resourceType: ResourceType, deliveryType: DeliveryType): Promise<StoredAsset | null>;
  deleteAsset(publicId: string, resourceType: ResourceType, deliveryType: DeliveryType): Promise<void>;
  /** Short-lived URL for private files. */
  privateUrl(publicId: string, format: string, expiresInSec: number): string;
}
