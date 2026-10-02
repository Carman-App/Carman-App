import type { Metadata } from "next";
import type { ReactNode } from "react";

// Public pages linked from the app and the store listings (privacy policy,
// terms, account deletion). No sign-in; see src/proxy.ts.
// The wording describes what this codebase actually does with data. Have it
// reviewed for your company and jurisdiction before submitting to the stores,
// and set SUPPORT_EMAIL / COMPANY_NAME in the environment.
export const metadata: Metadata = { title: "Carma", robots: { index: true } };

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <a href="/legal/privacy" className="mb-8 flex items-center gap-2 text-xs tracking-[0.2em] text-neutral-500">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-carma-600" /> CARMA
      </a>
      <div className="space-y-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-neutral-900 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_li]:ml-5 [&_li]:list-disc [&_a]:text-carma-600 [&_a]:underline">
        {children}
      </div>
      <nav className="mt-12 flex gap-5 border-t border-neutral-200 pt-5 text-sm text-neutral-500">
        <a href="/legal/privacy">Privacy</a>
        <a href="/legal/terms">Terms</a>
        <a href="/legal/delete-account">Delete your account</a>
      </nav>
    </main>
  );
}
