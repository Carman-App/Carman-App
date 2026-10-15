import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="container-page flex h-16 items-center">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center">
        <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-card sm:p-8">{children}</div>
      </main>
    </div>
  );
}
