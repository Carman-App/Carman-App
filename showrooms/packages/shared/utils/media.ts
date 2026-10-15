export interface ImageTransform {
  width?: number;
  height?: number;
  crop?: "fill" | "limit" | "fit" | "pad";
  quality?: "auto" | number;
}

/**
 * Adds Cloudinary delivery transformations (auto format, auto quality, resize)
 * to a Cloudinary URL. Other URLs (placeholder images in development) are
 * returned unchanged. Used for responsive images on slow mobile networks.
 */
export function imageUrl(url: string, t: ImageTransform = {}): string {
  const marker = "/image/upload/";
  const at = url.indexOf(marker);
  if (at === -1 || !url.includes("res.cloudinary.com")) return url;
  const parts = ["f_auto", `q_${t.quality ?? "auto"}`];
  if (t.width) parts.push(`w_${t.width}`);
  if (t.height) parts.push(`h_${t.height}`);
  if (t.width || t.height) parts.push(`c_${t.crop ?? "limit"}`);
  return url.slice(0, at + marker.length) + parts.join(",") + "/" + url.slice(at + marker.length);
}

/** Breakpoints for srcset / expo-image. */
export const IMAGE_WIDTHS = [320, 480, 768, 1080, 1600] as const;

export function imageSrcSet(url: string, widths: readonly number[] = IMAGE_WIDTHS): string {
  return widths.map((w) => `${imageUrl(url, { width: w })} ${w}w`).join(", ");
}

export const POSTER_SIZE = { width: 1080, height: 1920 } as const;
