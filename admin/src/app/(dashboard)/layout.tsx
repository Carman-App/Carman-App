import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SidebarNav } from "@/components/sidebar-nav";
import { roleLabel } from "@/lib/auth/rbac";
import { logout } from "./logout-action";

// Defense-in-depth on top of src/proxy.ts: this layout re-checks the
// session server-side (the optimistic proxy check only reads the cookie
// signature, never the database, and doesn't know about force-revoked
// sessions) before rendering any dashboard route.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 px-3 py-4">
        <div className="px-3 pb-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-carma-600" />
            <span className="text-[10px] tracking-[0.28em] text-neutral-800">CARMA</span>
          </div>
          <p className="mt-3 text-lg font-bold leading-tight tracking-tight">Admin</p>
          <p className="text-xs text-slate-blue">Internal ops dashboard</p>
          <div className="mt-3 flex h-1 gap-1.5">
            <span className="flex-1 bg-carma-600" />
            <span className="flex-1 bg-signal" />
            <span className="flex-1 bg-cta" />
          </div>
        </div>
        <div className="flex-1">
          <SidebarNav role={session.role} />
        </div>
        <div className="border-t border-neutral-200 px-3 pt-3">
          <p className="truncate text-xs text-neutral-700">{session.name}</p>
          <p className="truncate text-xs text-neutral-500">
            {session.email} · {roleLabel(session.role)}
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 text-xs text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden px-8 py-6">
        {session.isNewLocation && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-100 px-4 py-2 text-sm text-amber-800">
            This session started from a location we haven&rsquo;t seen for your account before
            ({session.email}). If this wasn&rsquo;t you, sign out and change your password, then
            review active sessions under <span className="font-medium">My security</span>.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
