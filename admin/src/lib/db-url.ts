// Hosted Postgres (Supabase, Neon, RDS…) gives URLs ending in `?sslmode=require`.
// node-postgres reads that as "verify the certificate against the system CAs",
// which fails for providers that sign with their own CA. Read it the way
// Postgres itself (libpq) and the Prisma CLI do: encrypted, not verified.
// To verify too, use `sslmode=verify-full` and set NODE_EXTRA_CA_CERTS to the
// provider's CA file.
export function withLibpqSsl(url: string) {
  if (!/[?&]sslmode=(require|prefer)\b/.test(url) || /[?&]uselibpqcompat=/.test(url)) return url;
  return `${url}&uselibpqcompat=true`;
}
