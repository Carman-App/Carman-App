import { createHash } from "node:crypto";
import type { UploadSignature } from "@showrooms/shared";
import type { DeliveryType, MediaService, ResourceType, StoredAsset } from "./media.service";

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Cloudinary over its REST API (signed uploads, Admin API lookups, signed private downloads). */
export class CloudinaryMediaService implements MediaService {
  readonly configured = true;

  constructor(
    private readonly config: CloudinaryConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Cloudinary signature: sha1 of the alphabetically sorted params joined with & plus the secret. */
  sign(params: Record<string, string | number>): string {
    const toSign = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== "")
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    return createHash("sha1").update(toSign + this.config.apiSecret).digest("hex");
  }

  signUpload({ publicId, resourceType, deliveryType, maxBytes }: Parameters<MediaService["signUpload"]>[0]): UploadSignature {
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = { public_id: publicId, timestamp, type: deliveryType, overwrite: "false" };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${resourceType}/upload`,
      fields: {
        api_key: this.config.apiKey,
        public_id: publicId,
        timestamp: String(timestamp),
        type: deliveryType,
        overwrite: "false",
        signature: this.sign(params),
      },
      publicId,
      maxBytes,
    };
  }

  private authHeader() {
    return `Basic ${Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString("base64")}`;
  }

  async getAsset(publicId: string, resourceType: ResourceType, deliveryType: DeliveryType): Promise<StoredAsset | null> {
    const url = `https://api.cloudinary.com/v1_1/${this.config.cloudName}/resources/${resourceType}/${deliveryType}/${publicId
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const res = await this.fetchImpl(url, { headers: { Authorization: this.authHeader() }, signal: AbortSignal.timeout(10_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Cloudinary lookup failed (${res.status})`);
    const body = (await res.json()) as {
      public_id: string;
      secure_url: string;
      bytes: number;
      format: string;
      width?: number;
      height?: number;
      duration?: number;
      resource_type: ResourceType;
    };
    return {
      publicId: body.public_id,
      secureUrl: body.secure_url,
      bytes: body.bytes,
      format: body.format,
      width: body.width,
      height: body.height,
      durationSec: body.duration,
      resourceType: body.resource_type,
    };
  }

  async deleteAsset(publicId: string, resourceType: ResourceType, deliveryType: DeliveryType): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: publicId, timestamp, type: deliveryType, invalidate: "true" };
    const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: this.config.apiKey, signature: this.sign(params) });
    await this.fetchImpl(`https://api.cloudinary.com/v1_1/${this.config.cloudName}/${resourceType}/destroy`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(10_000),
    });
  }

  privateUrl(publicId: string, format: string, expiresInSec: number): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: publicId, format, type: "authenticated", timestamp, expires_at: timestamp + expiresInSec };
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      api_key: this.config.apiKey,
      signature: this.sign(params),
    });
    return `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/download?${query}`;
  }
}
