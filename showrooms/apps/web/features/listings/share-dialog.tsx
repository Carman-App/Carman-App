"use client";

import { Copy, Download, MessageCircle, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { buildWhatsAppShareMessage, type Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { ApiError, errorMessage } from "@/lib/api-error";
import { listingUrl } from "@/lib/utils";

/**
 * Opens WhatsApp or the share sheet with a prefilled message. Nothing is ever
 * sent automatically: the seller picks the chat, group or Status and taps send.
 */
export function ShareDialog({ vehicle, sellerName, open, onOpenChange, celebrate }: { vehicle: Vehicle; sellerName: string; open: boolean; onOpenChange: (o: boolean) => void; celebrate?: boolean }) {
  const message = buildWhatsAppShareMessage(vehicle, listingUrl(vehicle.slug), sellerName);
  const [posterBusy, setPosterBusy] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  async function poster() {
    setPosterBusy(true);
    try {
      const { url } = await api<{ url: string }>(`/vehicles/${vehicle.id}/poster`);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Poster could not be generated");
      const blob = await res.blob();
      const file = new File([blob], `${vehicle.slug}-status.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message }).catch(() => undefined);
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Poster downloaded", { description: "Post it to your WhatsApp Status." });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setNeedsUpgrade(true);
      else toast.error(errorMessage(err));
    } finally {
      setPosterBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={celebrate ? "Your vehicle is listed! Share it with more buyers." : "Share this listing"} description={vehicle.title}>
        <div className="space-y-4">
          <pre className="max-h-48 overflow-auto rounded-lg bg-surface p-3 font-sans text-sm whitespace-pre-wrap">{message}</pre>
          <Button variant="whatsapp" size="lg" className="w-full" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Share to WhatsApp
            </a>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(message).then(() => toast.success("Message copied"))}>
              <Copy /> Copy message
            </Button>
            <Button variant="outline" onClick={() => (navigator.share ? navigator.share({ title: vehicle.title, text: message }).catch(() => undefined) : navigator.clipboard.writeText(listingUrl(vehicle.slug)).then(() => toast.success("Link copied")))}>
              <Share2 /> More options
            </Button>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-semibold">WhatsApp Status poster</p>
            <p className="mt-1 text-xs text-ink-muted">A 1080×1920 image with the photo, price, specs and your name — sized for Status.</p>
            {needsUpgrade ? (
              <p className="mt-3 text-sm">Posters are included in Pro. <Link href="/dashboard/subscription" className="font-semibold text-accent hover:underline">Upgrade</Link></p>
            ) : (
              <Button variant="secondary" size="sm" className="mt-3" onClick={poster} loading={posterBusy}>
                <Download /> Download poster
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
