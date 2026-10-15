"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { useFavoriteIds } from "@/features/vehicles/use-favorites";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

export function FavoriteButton({ vehicleId, initial, className, withLabel }: { vehicleId: string; initial?: boolean; className?: string; withLabel?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: ids } = useFavoriteIds();
  // Server-rendered pages are anonymous; the signed-in user's saved list wins once loaded,
  // and a local toggle wins over both until the list refetches.
  const [override, setOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = override ?? (ids ? ids.includes(vehicleId) : !!initial);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !saved;
    setOverride(next);
    setBusy(true);
    try {
      await api(`/favorites/${vehicleId}`, { method: next ? "POST" : "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      setOverride(null);
      if (next) toast.success("Saved", { description: "Find it any time under Saved." });
    } catch (err) {
      setOverride(!next);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save vehicle"}
      className={cn(
        "relative z-10 inline-flex items-center gap-2 rounded-full bg-white/95 p-2 text-ink shadow-card transition hover:scale-105",
        withLabel && "rounded-md border border-border px-4 py-2 text-sm font-semibold shadow-none hover:scale-100 hover:bg-surface",
        className,
      )}
    >
      <Heart className={cn("size-4", saved && "fill-accent text-accent")} aria-hidden />
      {withLabel && (saved ? "Saved" : "Save")}
    </button>
  );
}
