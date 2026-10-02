import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { api } from '@/data/api/client';

/**
 * Photos and PDFs go straight from the phone to object storage: the API
 * signs a one-time upload URL for this vehicle, the app PUTs the file there,
 * and the document is saved with the returned file key.
 */

export type PickedFile = { uri: string; name: string; mimeType: string; size: number | null };

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'];

export async function takePhoto(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Carma needs the camera to photograph a document. Allow it in Settings.');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (res.canceled) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.fileName ?? 'photo.jpg', mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null };
}

export async function chooseFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (res.canceled) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size ?? null };
}

export function describeFile(f: PickedFile): string {
  const kb = f.size ? Math.round(f.size / 1024) : null;
  return kb ? `${f.name} · ${kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}` : f.name;
}

/** Uploads a picked file for a vehicle and returns the file key to save on the document. */
export async function uploadFile(vehicleId: string, file: PickedFile): Promise<{ fileKey: string; sizeBytes: number }> {
  if (!ALLOWED.includes(file.mimeType)) throw new Error('Use a photo or a PDF.');
  const blob = await (await fetch(file.uri)).blob();
  if (blob.size > MAX_BYTES) throw new Error('That file is over 15 MB.');

  const signed = await api.post<{ fileKey: string; uploadUrl: string; headers: Record<string, string> }>('uploads', {
    vehicleId,
    contentType: file.mimeType,
    sizeBytes: blob.size,
  });
  const put = await fetch(signed.uploadUrl, { method: 'PUT', headers: signed.headers, body: blob });
  if (!put.ok) throw new Error('The upload did not go through. Check your connection and try again.');
  return { fileKey: signed.fileKey, sizeBytes: blob.size };
}
