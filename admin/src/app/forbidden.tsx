import Link from "next/link";

// Rendered by next/navigation's forbidden() (see src/lib/auth/rbac.ts) —
// the real, server-enforced 403 when a signed-in admin's role doesn't allow
// a page, not a client-side hidden nav link. Returns an actual 403 status
// (next.config.ts sets experimental.authInterrupts to enable this API).
export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-neutral-600">403</p>
        <h1 className="mt-2 text-xl font-semibold text-neutral-100">Not available to your role</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Your admin role doesn&rsquo;t include this screen. If you need access, ask an Owner to
          change your role.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
        >
          Back to Pulse
        </Link>
      </div>
    </div>
  );
}
