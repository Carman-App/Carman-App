import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { UploadPurpose, UploadSignature } from "@showrooms/shared";
import { api } from "./api";

export interface LocalAsset {
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
  width?: number;
}

/** Resize to 1600px and re-encode: a 6 MB phone photo becomes ~300 KB on mobile data. */
export async function compressPhoto(asset: LocalAsset): Promise<LocalAsset> {
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (!asset.width || asset.width > 1600) ctx.resize({ width: 1600 });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
    return { uri: out.uri, mimeType: "image/jpeg", fileName: asset.fileName.replace(/\.\w+$/, ".jpg") };
  } catch {
    return asset;
  }
}

async function fileSize(asset: LocalAsset): Promise<number> {
  if (asset.fileSize) return asset.fileSize;
  const blob = await (await fetch(asset.uri)).blob();
  return blob.size;
}

function postWithProgress(url: string, form: FormData, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}

/** signature (ownership checked by the API) → direct upload → server-side confirmation. */
export async function uploadAsset<T = { publicId: string; url?: string }>(asset: LocalAsset, purpose: UploadPurpose, opts: { vehicleId?: string; onProgress?: (pct: number) => void } = {}): Promise<T> {
  const file = purpose === "VEHICLE_VIDEO" || asset.mimeType === "application/pdf" ? asset : await compressPhoto(asset);
  const sig = await api<UploadSignature>("/uploads/signature", { method: "POST", body: { purpose, vehicleId: opts.vehicleId, contentType: file.mimeType, fileSize: await fileSize(file) } });
  const form = new FormData();
  Object.entries(sig.fields).forEach(([k, v]) => form.append(k, v));
  // React Native's FormData accepts { uri, name, type } file parts.
  form.append("file", { uri: file.uri, name: file.fileName, type: file.mimeType } as unknown as Blob);
  await postWithProgress(sig.uploadUrl, form, opts.onProgress ?? (() => undefined));
  return api<T>("/uploads/complete", { method: "POST", body: { purpose, vehicleId: opts.vehicleId, publicId: sig.publicId } });
}
