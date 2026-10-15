import type { RequestHandler, Response } from "express";

/** Default for every API response: never cache, so private data can't leak between accounts via shared caches. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
};

/**
 * Public, anonymous listing responses may be cached briefly by browsers and CDNs.
 * Signed-in responses (which include `isFavorite` etc.) stay private.
 */
export function publicCache(res: Response, signedIn: boolean, seconds = 30): void {
  if (signedIn) return;
  res.setHeader("Cache-Control", `public, max-age=${seconds}, s-maxage=${seconds * 2}, stale-while-revalidate=${seconds * 4}`);
  res.setHeader("Vary", "Authorization");
}
