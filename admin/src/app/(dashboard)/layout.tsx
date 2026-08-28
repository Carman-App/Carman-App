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
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-800 px-3 py-4">
        <div className="px-3 pb-4">
          <p className="text-sm font-semibold">Carma Admin</p>
          <p className="text-xs text-neutral-500">Internal ops dashboard</p>
        </div>
        <div className="flex-1">
          <SidebarNav role={session.role} />
        </div>
        <div className="border-t border-neutral-800 px-3 pt-3">
          <p className="truncate text-xs text-neutral-300">{session.name}</p>
          <p className="truncate text-xs text-neutral-500">
            {session.email} · {roleLabel(session.role)}
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 text-xs text-neutral-400 underline-offset-2 hover:text-neutral-100 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden px-8 py-6">
        {session.isNewLocation && (
          <div className="mb-4 rounded border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
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
