import type { UploadSignature } from "@showrooms/shared";
import { AppError } from "../../utils/app-error";
import type { MediaService, StoredAsset } from "./media.service";

/** Used when no media provider is configured: uploads are refused with a clear message. */
export class DisabledMediaService implements MediaService {
  readonly configured = false;
  private fail(): never {
    throw new AppError(503, "INTERNAL_ERROR", "Media uploads are not configured on this server (set MEDIA_PROVIDER=cloudinary).");
  }
  signUpload(): UploadSignature {
    this.fail();
  }
  async getAsset(): Promise<StoredAsset | null> {
    this.fail();
  }
  async deleteAsset(): Promise<void> {}
  privateUrl(): string {
    this.fail();
  }
}

/** Test double: tests register what "was uploaded" and inspect deletions. */
export class FakeMediaService implements MediaService {
  readonly configured = true;
  readonly assets = new Map<string, StoredAsset>();
  readonly deleted: string[] = [];

  signUpload(input: Parameters<MediaService["signUpload"]>[0]): UploadSignature {
    return { uploadUrl: "https://upload.test/upload", fields: { public_id: input.publicId, signature: "fake" }, publicId: input.publicId, maxBytes: input.maxBytes };
  }
  /** Simulates the client finishing an upload. */
  upload(publicId: string, overrides: Partial<StoredAsset> = {}) {
    this.assets.set(publicId, {
      publicId,
      secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${publicId}.jpg`,
      bytes: 200_000,
      format: "jpg",
      width: 1600,
      height: 1200,
      resourceType: "image",
      ...overrides,
    });
  }
  async getAsset(publicId: string) {
    return this.assets.get(publicId) ?? null;
  }
  async deleteAsset(publicId: string) {
    this.deleted.push(publicId);
    this.assets.delete(publicId);
  }
  privateUrl(publicId: string, format: string, expiresInSec: number) {
    return `https://private.test/${publicId}.${format}?expires=${expiresInSec}`;
  }
}
