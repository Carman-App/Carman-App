import { randomBytes } from "node:crypto";
import type { Model } from "mongoose";
import { slugify } from "@showrooms/shared";

export function shortId(length = 6): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** `otieno-motors`, or `otieno-motors-x7k2` if taken. */
export async function uniqueSlug(model: Model<never>, base: string): Promise<string> {
  const root = slugify(base) || "showroom";
  if (!(await model.exists({ slug: root }))) return root;
  for (let i = 0; i < 5; i++) {
    const candidate = `${root}-${shortId(4)}`;
    if (!(await model.exists({ slug: candidate }))) return candidate;
  }
  return `${root}-${shortId(8)}`;
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function paginate(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
