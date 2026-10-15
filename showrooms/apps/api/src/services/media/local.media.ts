import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import busboy from "busboy";
import { Router, type Request, type Response } from "express";
import type { UploadSignature } from "@showrooms/shared";
import { hmac, safeEqual } from "../../utils/crypto";
import type { DeliveryType, MediaService, ResourceType, StoredAsset } from "./media.service";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const MIME = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

/**
 * Development stand-in for Cloudinary so the whole upload flow (signature →
 * direct upload with progress → /uploads/complete) works on a laptop. Files
 * are written to disk and served by the API. Never enabled in staging or
 * production (enforced in config/env.ts).
 */
export class LocalMediaService implements MediaService {
  readonly configured = true;
  private readonly root: string;

  constructor(
    dir: string,
    private readonly publicApiUrl: string,
    private readonly secret: string,
  ) {
    this.root = resolve(dir);
  }

  private pathFor(publicId: string, delivery: DeliveryType, ext?: string) {
    if (publicId.includes("..")) throw new Error("Invalid public id");
    return join(this.root, delivery === "authenticated" ? "private" : "public", ext ? `${publicId}.${ext}` : publicId);
  }

  private token(publicId: string, delivery: DeliveryType, maxBytes: number, exp: number) {
    return hmac(this.secret, `upload|${publicId}|${delivery}|${maxBytes}|${exp}`);
  }

  signUpload({ publicId, deliveryType, maxBytes }: Parameters<MediaService["signUpload"]>[0]): UploadSignature {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return {
      uploadUrl: `${this.publicApiUrl}/media/upload`,
      fields: { public_id: publicId, type: deliveryType, max_bytes: String(maxBytes), expires: String(exp), signature: this.token(publicId, deliveryType, maxBytes, exp) },
      publicId,
      maxBytes,
    };
  }

  private async find(publicId: string, delivery: DeliveryType): Promise<{ path: string; ext: string } | null> {
    for (const ext of Object.values(EXT)) {
      const path = this.pathFor(publicId, delivery, ext);
      if (await stat(path).then(() => true, () => false)) return { path, ext };
    }
    return null;
  }

  async getAsset(publicId: string, resourceType: ResourceType, delivery: DeliveryType): Promise<StoredAsset | null> {
    const found = await this.find(publicId, delivery);
    if (!found) return null;
    const info = await stat(found.path);
    return {
      publicId,
      secureUrl: `${this.publicApiUrl}/media/${publicId}.${found.ext}`,
      bytes: info.size,
      format: found.ext,
      resourceType,
    };
  }

  async deleteAsset(publicId: string, _rt: ResourceType, delivery: DeliveryType): Promise<void> {
    const found = await this.find(publicId, delivery);
    if (found) await rm(found.path, { force: true });
  }

  privateUrl(publicId: string, format: string, expiresInSec: number): string {
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const sig = hmac(this.secret, `private|${publicId}.${format}|${exp}`);
    return `${this.publicApiUrl}/media-private/${publicId}.${format}?exp=${exp}&sig=${sig}`;
  }

  /** Express routes: multipart upload target, public files, and signed private files. */
  router(): Router {
    const router = Router();

    router.post("/media/upload", (req: Request, res: Response) => {
      const fields: Record<string, string> = {};
      let saved: { path: string; size: number } | null = null;
      let failure: string | null = null;
      const bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: 100 * 1024 * 1024 } });
      bb.on("field", (name, value) => (fields[name] = value));
      bb.on("file", (_name, stream, info) => {
        const { public_id: publicId, type, max_bytes: maxBytes, expires, signature } = fields;
        const delivery = (type === "authenticated" ? "authenticated" : "upload") as DeliveryType;
        const ext = EXT[info.mimeType];
        const valid =
          publicId && signature && expires && maxBytes && Number(expires) > Date.now() / 1000 && safeEqual(signature, this.token(publicId, delivery, Number(maxBytes), Number(expires)));
        if (!valid || !ext) {
          failure = !valid ? "Invalid or expired upload signature" : "File type not allowed";
          stream.resume();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > Number(maxBytes)) {
            failure = "File too large";
            stream.destroy();
          } else chunks.push(c);
        });
        stream.on("end", async () => {
          if (failure) return;
          const path = this.pathFor(publicId, delivery, ext);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, Buffer.concat(chunks), { flag: "wx" }).catch(() => (failure = "File already exists"));
          saved = { path, size };
        });
      });
      bb.on("close", () => {
        setTimeout(() => {
          if (failure || !saved) res.status(400).json({ error: { message: failure ?? "No file received" } });
          else res.json({ public_id: fields.public_id, bytes: saved.size });
        }, 20);
      });
      req.pipe(bb);
    });

    router.get("/media/*path", async (req, res) => {
      const rel = (req.params as { path: string[] }).path.join("/");
      const path = this.pathFor(rel, "upload");
      if (!(await stat(path).then((s) => s.isFile(), () => false))) return void res.status(404).end();
      res.setHeader("Content-Type", MIME[extname(path).slice(1)] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      createReadStream(path).pipe(res);
    });

    router.get("/media-private/*path", async (req, res) => {
      const rel = (req.params as { path: string[] }).path.join("/");
      const exp = String(req.query.exp ?? "");
      const sig = String(req.query.sig ?? "");
      if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000 || !safeEqual(sig, hmac(this.secret, `private|${rel}|${exp}`))) return void res.status(403).end();
      const path = this.pathFor(rel, "authenticated");
      if (!(await stat(path).then((s) => s.isFile(), () => false))) return void res.status(404).end();
      res.setHeader("Content-Type", MIME[extname(path).slice(1)] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "private, no-store");
      createReadStream(path).pipe(res);
    });
    return router;
  }
}
