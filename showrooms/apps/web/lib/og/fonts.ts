import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Plus Jakarta Sans (SIL OFL), bundled as woff because ImageResponse can't read woff2. */
export async function ogFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  const [regular, bold] = await Promise.all([
    readFile(join(dir, "plus-jakarta-sans-latin-500-normal.woff")),
    readFile(join(dir, "plus-jakarta-sans-latin-800-normal.woff")),
  ]);
  return [
    { name: "Jakarta", data: regular, weight: 500 as const, style: "normal" as const },
    { name: "Jakarta", data: bold, weight: 800 as const, style: "normal" as const },
  ];
}

/** Ask Cloudinary for a JPEG at the size we need (satori can't decode WebP/AVIF). */
export function ogImageSrc(url: string, width: number, height: number): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  return url.replace("/image/upload/", `/image/upload/f_jpg,q_80,c_fill,w_${width},h_${height}/`);
}
