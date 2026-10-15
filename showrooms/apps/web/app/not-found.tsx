import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="container-page flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="text-3xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-ink-muted">The car may have been sold or the link is out of date.</p>
      <Button asChild><Link href="/vehicles">Browse vehicles</Link></Button>
    </main>
  );
}
