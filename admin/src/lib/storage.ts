import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Small storage abstraction over the S3 API shape, for VehicleDocument (and
 * Report) file storage. Works against real AWS S3 or any S3-compatible
 * service (Cloudflare R2, etc.) by pointing S3_ENDPOINT at it.
 *
 * No bucket is provisioned by this codebase — plug in real credentials via
 * the env vars below (see .env.example) when ready. Nothing in the Next.js
 * build calls this module at build time, so a missing/placeholder
 * configuration never breaks `npm run build`; calls will simply fail (or
 * reject) at request time until real credentials are supplied.
 */

function getClient(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT), // R2/MinIO-style endpoints need path-style addressing
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error(
      "S3_BUCKET is not set. Add S3_BUCKET/S3_REGION/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY (and optionally S3_ENDPOINT for R2-style services) to .env.",
    );
  }
  return bucket;
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string,
): Promise<{ key: string }> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { key };
}

export async function deleteFile(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/** A time-limited URL for reading (GET) the given object key. */
export async function getSignedReadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/** True when a bucket and credentials are configured. */
export function storageConfigured(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

/**
 * A short-lived URL the app PUTs the file to directly, so uploads never pass
 * through (or tie up) the API servers. The signature binds the content type
 * and exact size, so the URL cannot be reused for a different file.
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresInSeconds = 300,
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType, ContentLength: contentLength });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds, signableHeaders: new Set(["content-type", "content-length"]) });
}
