"use client";

import { Flag, MessageCircle, Phone, Share2, CalendarCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { buildBuyerEnquiryMessage, REPORT_REASON_LABELS, REPORT_REASONS, whatsappLink, type Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { FavoriteButton } from "@/components/vehicles/favorite-button";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api-client";
import { ApiError, errorMessage } from "@/lib/api-error";
import { listingUrl } from "@/lib/utils";

/** Fire-and-forget; analytics must never block a buyer from contacting a seller. */
function track(vehicleId: string, path: "view" | "contact", body?: object) {
  api(`/vehicles/${vehicleId}/${path}`, { method: "POST", body: body ?? {} }).catch(() => undefined);
}

export function ViewTracker({ vehicleId }: { vehicleId: string }) {
  const { status } = useAuth();
  const sent = useRef(false);
  useEffect(() => {
    if (status === "loading" || sent.current) return;
    sent.current = true;
    track(vehicleId, "view");
  }, [status, vehicleId]);
  return null;
}

function useRequireLogin() {
  const { user } = useAuth();
  const router = useRouter();
  return () => {
    if (user) return true;
    router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    return false;
  };
}

export function ContactButtons({ vehicle, layout = "stack" }: { vehicle: Vehicle; layout?: "stack" | "bar" }) {
  const phone = vehicle.seller?.whatsappNumber ?? vehicle.seller?.phone;
  const callNumber = vehicle.seller?.phone ?? phone;
  if (!phone || vehicle.status !== "ACTIVE") return null;
  const wa = whatsappLink(phone, buildBuyerEnquiryMessage(vehicle, listingUrl(vehicle.slug)));
  return (
    <div className={layout === "bar" ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
      <Button variant="whatsapp" size="lg" asChild>
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track(vehicle.id, "contact", { channel: "WHATSAPP" })}>
          <MessageCircle /> WhatsApp seller
        </a>
      </Button>
      {callNumber && (
        <Button variant="outline" size="lg" asChild>
          <a href={`tel:${callNumber}`} onClick={() => track(vehicle.id, "contact", { channel: "CALL" })}>
            <Phone /> Call seller
          </a>
        </Button>
      )}
    </div>
  );
}

const viewingSchema = z.object({
  preferredDate: z.string().optional(),
  message: z.string().max(1000),
  phone: z.string().max(20).optional(),
});

export function RequestViewing({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const requireLogin = useRequireLogin();
  const { user } = useAuth();
  const form = useForm<z.infer<typeof viewingSchema>>({ resolver: zodResolver(viewingSchema), defaultValues: { message: "", phone: user?.phone ?? "" } });
  const [minDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  if (vehicle.status !== "ACTIVE") return null;

  async function submit(values: z.infer<typeof viewingSchema>) {
    try {
      await api(`/vehicles/${vehicle.id}/inquiries`, {
        method: "POST",
        body: {
          type: "VIEWING_REQUEST",
          message: values.message,
          phone: values.phone || undefined,
          preferredDate: values.preferredDate ? new Date(`${values.preferredDate}T10:00:00+03:00`).toISOString() : undefined,
        },
      });
      toast.success("Viewing requested", { description: "The seller has been notified and will contact you." });
      setOpen(false);
      form.reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) Object.entries(err.fieldErrors()).forEach(([k, m]) => form.setError(k as never, { message: m }));
      else toast.error(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? requireLogin() && setOpen(true) : setOpen(false))}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="lg" className="w-full">
          <CalendarCheck /> Request viewing
        </Button>
      </DialogTrigger>
      <DialogContent title="Request a viewing" description={`${vehicle.title} in ${vehicle.location.town}`}>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4" noValidate>
          <Field label="Preferred date" htmlFor="v-date" error={form.formState.errors.preferredDate?.message}>
            <Input id="v-date" type="date" min={minDate} {...form.register("preferredDate")} />
          </Field>
          <Field label="Your phone" htmlFor="v-phone" hint="The seller will call or WhatsApp you on this number." error={form.formState.errors.phone?.message}>
            <Input id="v-phone" type="tel" inputMode="tel" placeholder="0712 345 678" {...form.register("phone")} />
          </Field>
          <Field label="Message (optional)" htmlFor="v-msg" error={form.formState.errors.message?.message}>
            <Textarea id="v-msg" placeholder="Is the price negotiable? Can I bring a mechanic?" {...form.register("message")} />
          </Field>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Send request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ShareButton({ vehicle }: { vehicle: Vehicle }) {
  async function share() {
    const url = listingUrl(vehicle.slug);
    if (navigator.share) {
      await navigator.share({ title: vehicle.title, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  }
  return (
    <Button variant="outline" onClick={share}>
      <Share2 /> Share
    </Button>
  );
}

export function ReportListing({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const requireLogin = useRequireLogin();
  const form = useForm<{ reason: (typeof REPORT_REASONS)[number]; details: string }>({ defaultValues: { reason: "SCAM", details: "" } });
  async function submit(values: { reason: string; details: string }) {
    try {
      await api(`/vehicles/${vehicle.id}/reports`, { method: "POST", body: values });
      toast.success("Report sent", { description: "Thank you. Our team will review this listing." });
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? requireLogin() && setOpen(true) : setOpen(false))}>
      <DialogTrigger className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-danger">
        <Flag className="size-4" /> Report listing
      </DialogTrigger>
      <DialogContent title="Report this listing" description="Tell us what looks wrong. Reports are confidential.">
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <Field label="Reason" htmlFor="r-reason">
            <Select id="r-reason" {...form.register("reason")}>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Details" htmlFor="r-details" hint="Required for 'Something else'.">
            <Textarea id="r-details" {...form.register("details")} />
          </Field>
          <Button type="submit" variant="danger" loading={form.formState.isSubmitting}>
            Send report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SaveButton({ vehicleId }: { vehicleId: string }) {
  return <FavoriteButton vehicleId={vehicleId} withLabel />;
}
