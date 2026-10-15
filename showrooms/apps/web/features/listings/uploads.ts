"use client";

import type { UploadPurpose, UploadSignature } from "@showrooms/shared";
import { api } from "@/lib/api-client";

/**
 * Shrinks large photos in the browser before upload: phone cameras produce
 * 4-8 MB images, which is slow and costly on mobile data. Keeps JPEG/WebP
 * under ~2000px on the long edge.
 */
export async function compressImage(file: File, maxEdge = 2000, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.size < 700_000) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return blob && blob.size < file.size ? blob : file;
}

function postWithProgress(url: string, form: FormData, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
}

/** signature → direct upload to Cloudinary → server-side confirmation. */
export async function uploadFile<T = { publicId: string; url?: string }>(
  file: File,
  purpose: UploadPurpose,
  opts: { vehicleId?: string; onProgress?: (pct: number) => void; signal?: AbortSignal } = {},
): Promise<T> {
  const body = purpose === "VEHICLE_IMAGE" || purpose.startsWith("PROFILE") || purpose === "AVATAR" ? await compressImage(file) : file;
  const contentType = body instanceof File ? body.type : "image/jpeg";
  const sig = await api<UploadSignature>("/uploads/signature", { method: "POST", body: { purpose, vehicleId: opts.vehicleId, contentType, fileSize: body.size } });
  const form = new FormData();
  Object.entries(sig.fields).forEach(([k, v]) => form.append(k, v));
  form.append("file", body, file.name);
  await postWithProgress(sig.uploadUrl, form, opts.onProgress ?? (() => undefined), opts.signal);
  return api<T>("/uploads/complete", { method: "POST", body: { purpose, vehicleId: opts.vehicleId, publicId: sig.publicId } });
}
