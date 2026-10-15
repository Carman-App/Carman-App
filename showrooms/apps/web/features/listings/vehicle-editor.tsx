"use client";

import { AlertTriangle, Check, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  BODY_TYPES,
  COMMON_FEATURES,
  CONDITIONS,
  DRIVE_TYPES,
  FUEL_TYPES,
  IMPORT_STATUSES,
  LABELS,
  TOWN_NAMES,
  TRANSMISSIONS,
  vehicleFieldsSchema,
  type Category,
  type Vehicle,
} from "@showrooms/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { api } from "@/lib/api-client";
import { ApiError, errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { MediaManager } from "./media-manager";
import { ShareDialog } from "./share-dialog";

const STEPS = [
  { id: "photos", label: "Photos" },
  { id: "details", label: "Vehicle info" },
  { id: "price", label: "Price & location" },
  { id: "description", label: "Description" },
  { id: "preview", label: "Preview & submit" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

// Form state mirrors the API's draft schema; empty strings mean "not set yet".
const formSchema = z.object({
  make: z.string(),
  model: z.string(),
  year: z.string(),
  mileage: z.string(),
  transmission: z.string(),
  fuelType: z.string(),
  engineCapacity: z.string(),
  bodyType: z.string(),
  driveType: z.string(),
  color: z.string(),
  condition: z.string(),
  importStatus: z.string(),
  price: z.string(),
  priceNegotiable: z.boolean(),
  town: z.string(),
  area: z.string(),
  description: z.string().max(4000),
  features: z.array(z.string()),
});
type FormValues = z.infer<typeof formSchema>;

const STEP_FIELDS: Record<StepId, (keyof FormValues)[]> = {
  photos: [],
  details: ["make", "model", "year", "mileage", "transmission", "fuelType", "engineCapacity", "bodyType", "driveType", "color", "condition", "importStatus"],
  price: ["price", "priceNegotiable", "town", "area"],
  description: ["description", "features"],
  preview: [],
};

function toForm(v: Vehicle): FormValues {
  const s = (n: number | undefined) => (n ? String(n) : "");
  return {
    make: v.make ?? "",
    model: v.model ?? "",
    year: s(v.year),
    mileage: v.mileage !== undefined && (v.status !== "DRAFT" || v.mileage > 0) ? String(v.mileage) : "",
    transmission: v.transmission ?? "",
    fuelType: v.fuelType ?? "",
    engineCapacity: s(v.engineCapacity),
    bodyType: v.bodyType ?? "",
    driveType: v.driveType ?? "",
    color: v.color ?? "",
    condition: v.condition ?? "",
    importStatus: v.importStatus ?? "IN_KENYA",
    price: s(v.price),
    priceNegotiable: v.priceNegotiable,
    town: v.location?.town ?? "",
    area: v.location?.area ?? "",
    description: v.description ?? "",
    features: v.features ?? [],
  };
}

/** Only sends fields that have a value; the API validates each one it receives. */
function toPayload(values: FormValues, fields: (keyof FormValues)[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f];
    if (f === "town" || f === "area") continue;
    if (v === "" || v === undefined) continue;
    out[f] = ["year", "mileage", "engineCapacity", "price"].includes(f) ? Number(String(v).replace(/[^\d]/g, "")) : v;
  }
  if (fields.includes("town") && values.town) out.location = { town: values.town, area: values.area || undefined };
  return out;
}

export function VehicleEditor({ initial, sellerName }: { initial: Vehicle; sellerName: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [vehicle, setVehicle] = useState(initial);
  const [step, setStep] = useState<StepId>(initial.images.length ? "details" : "photos");
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const catalog = useQuery({ queryKey: ["categories"], queryFn: () => api<{ makes: Category[] }>("/categories"), staleTime: 300_000 });
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toForm(initial) });
  const make = useWatch({ control: form.control, name: "make" });
  const features = useWatch({ control: form.control, name: "features" });
  const models = useMemo(() => catalog.data?.makes.find((m) => m.name === make)?.models ?? [], [catalog.data, make]);
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const locked = !["DRAFT", "PENDING_REVIEW", "REJECTED", "ACTIVE"].includes(vehicle.status);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty]);

  async function save(fields: (keyof FormValues)[]): Promise<boolean> {
    const payload = toPayload(form.getValues(), fields);
    if (!Object.keys(payload).length || locked) return true;
    setSaving(true);
    try {
      // Validate locally with the same rules the API uses.
      const check = vehicleFieldsSchema.partial().safeParse(payload);
      if (!check.success) {
        check.error.issues.forEach((i) => {
          const key = (i.path[0] === "location" ? "town" : i.path[0]) as keyof FormValues;
          form.setError(key, { message: i.message });
        });
        return false;
      }
      const updated = await api<Vehicle>(`/vehicles/${vehicle.id}`, { method: "PATCH", body: payload });
      setVehicle(updated);
      form.reset(toForm(updated), { keepValues: true });
      qc.invalidateQueries({ queryKey: ["my-vehicles"] });
      if (updated.status === "PENDING_REVIEW" && vehicle.status === "ACTIVE") toast.info("Back in review", { description: "Changing make, model or year sends a live listing back for review." });
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) Object.entries(err.fieldErrors()).forEach(([k, m]) => form.setError((k.startsWith("location") ? "town" : k) as keyof FormValues, { message: m }));
      else toast.error(errorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function go(next: StepId) {
    if (await save(STEP_FIELDS[step])) setStep(next);
  }

  async function submit() {
    if (!(await save(STEP_FIELDS[step]))) return;
    setSaving(true);
    try {
      const updated = await api<Vehicle>(`/vehicles/${vehicle.id}/submit`, { method: "POST" });
      setVehicle(updated);
      qc.invalidateQueries({ queryKey: ["my-vehicles"] });
      if (updated.status === "ACTIVE") setShareOpen(true);
      else toast.success("Submitted for review", { description: "We'll notify you as soon as it's approved — usually within a few hours." });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const fields = err.fieldErrors();
        Object.entries(fields).forEach(([k, m]) => form.setError((k.startsWith("location") ? "town" : k) as keyof FormValues, { message: m }));
        const first = STEPS.find((s) => STEP_FIELDS[s.id].some((f) => Object.keys(fields).some((k) => k === f || (f === "town" && k.startsWith("location")))));
        toast.error(err.message, { description: Object.values(fields).slice(0, 3).join(" · ") });
        if (fields.images) setStep("photos");
        else if (first) setStep(first.id);
      } else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const err = (k: keyof FormValues) => form.formState.errors[k]?.message;
  const selectField = (name: keyof FormValues, label: string, options: readonly string[], labels?: Record<string, string>) => (
    <Field label={label} htmlFor={name} error={err(name)}>
      <Select id={name} aria-invalid={!!err(name)} {...form.register(name)}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>{labels?.[o] ?? o}</option>
        ))}
      </Select>
    </Field>
  );

  return (
    <div className="space-y-6">
      {vehicle.status === "REJECTED" && vehicle.rejectionReason && (
        <div role="alert" className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <div><p className="font-semibold">Changes requested</p><p className="text-ink-muted">{vehicle.rejectionReason}</p></div>
        </div>
      )}
      {locked && <p className="rounded-lg bg-surface p-4 text-sm">This listing is {LABELS.status[vehicle.status].toLowerCase()} and can no longer be edited.</p>}

      <ol className="flex gap-1 overflow-x-auto" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className="shrink-0">
            <button type="button" onClick={() => go(s.id)} aria-current={s.id === step ? "step" : undefined} className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium", s.id === step ? "bg-ink text-white" : i < stepIndex ? "bg-success-soft text-success" : "bg-white text-ink-muted")}>
              <span className="grid size-5 place-items-center rounded-full bg-white/20 text-xs">{i < stepIndex ? <Check className="size-3" /> : i + 1}</span>
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-white p-5 shadow-card">
        {step === "photos" && <MediaManager vehicle={vehicle} onChange={setVehicle} />}

        {step === "details" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Make" htmlFor="make" error={err("make")}>
              <Select id="make" {...form.register("make", { onChange: () => form.setValue("model", "") })}>
                <option value="">Select…</option>
                {catalog.data?.makes.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Model" htmlFor="model" error={err("model")}>
              <Input id="model" list="model-options" {...form.register("model")} />
              <datalist id="model-options">{models.map((m) => <option key={m} value={m} />)}</datalist>
            </Field>
            <Field label="Year of manufacture" htmlFor="year" error={err("year")}>
              <Input id="year" inputMode="numeric" placeholder="2017" {...form.register("year")} />
            </Field>
            <Field label="Mileage (km)" htmlFor="mileage" error={err("mileage")}>
              <Input id="mileage" inputMode="numeric" placeholder="86000" {...form.register("mileage")} />
            </Field>
            <Field label="Engine capacity (cc)" htmlFor="engineCapacity" error={err("engineCapacity")}>
              <Input id="engineCapacity" inputMode="numeric" placeholder="1500" {...form.register("engineCapacity")} />
            </Field>
            <Field label="Colour" htmlFor="color" error={err("color")}>
              <Input id="color" placeholder="Silver" {...form.register("color")} />
            </Field>
            {selectField("transmission", "Transmission", TRANSMISSIONS, LABELS.transmission)}
            {selectField("fuelType", "Fuel type", FUEL_TYPES, LABELS.fuelType)}
            {selectField("bodyType", "Body type", BODY_TYPES, LABELS.bodyType)}
            {selectField("driveType", "Drive", DRIVE_TYPES, LABELS.driveType)}
            {selectField("condition", "Condition", CONDITIONS, LABELS.condition)}
            {selectField("importStatus", "Import / local status", IMPORT_STATUSES, LABELS.importStatus)}
          </div>
        )}

        {step === "price" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price (KES)" htmlFor="price" hint="Whole shillings, e.g. 1450000" error={err("price")}>
              <Input id="price" inputMode="numeric" placeholder="1450000" {...form.register("price")} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="size-4 accent-[--color-accent]" {...form.register("priceNegotiable")} /> Price is negotiable
            </label>
            {selectField("town", "Town", TOWN_NAMES)}
            <Field label="Area (optional)" htmlFor="area" hint="Estate or road, e.g. Ngong Road" error={err("area")}>
              <Input id="area" {...form.register("area")} />
            </Field>
          </div>
        )}

        {step === "description" && (
          <div className="grid gap-4">
            <Field label="Description" htmlFor="description" hint="At least 30 characters. Mention service history, accident history, and anything a buyer should know." error={err("description")}>
              <Textarea id="description" rows={7} {...form.register("description")} />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Features</legend>
              <div className="flex flex-wrap gap-2">
                {COMMON_FEATURES.map((f) => {
                  const on = features.includes(f);
                  return (
                    <button key={f} type="button" aria-pressed={on} onClick={() => form.setValue("features", on ? form.getValues("features").filter((x) => x !== f) : [...form.getValues("features"), f], { shouldDirty: true })} className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface")}>
                      {f}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {step === "preview" && (
          <div className="grid gap-6 md:grid-cols-[320px_1fr]">
            <VehicleCard vehicle={{ ...vehicle, seller: undefined }} />
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2">Status: <Badge>{LABELS.status[vehicle.status]}</Badge></p>
              <p className="text-ink-muted">{vehicle.images.length} photo(s) · {vehicle.description.length} characters of description</p>
              <p className="text-ink-muted">New listings are reviewed by our team before they go live. You&apos;ll get a notification when it&apos;s approved, then you can share it to WhatsApp.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => (stepIndex > 0 ? go(STEPS[stepIndex - 1]!.id) : router.push("/dashboard/vehicles"))}>
          <ChevronLeft /> {stepIndex > 0 ? "Back" : "My vehicles"}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save(STEP_FIELDS[step]).then((ok) => ok && toast.success("Draft saved"))} loading={saving} disabled={locked}>Save draft</Button>
          {step !== "preview" ? (
            <Button onClick={() => go(STEPS[stepIndex + 1]!.id)} loading={saving}>Continue <ChevronRight /></Button>
          ) : vehicle.status === "DRAFT" || vehicle.status === "REJECTED" ? (
            <Button onClick={submit} loading={saving}><Send /> Submit listing</Button>
          ) : vehicle.status === "ACTIVE" ? (
            <Button variant="whatsapp" onClick={() => setShareOpen(true)}>Share to WhatsApp</Button>
          ) : null}
        </div>
      </div>
      <ShareDialog vehicle={vehicle} sellerName={sellerName} open={shareOpen} onOpenChange={setShareOpen} celebrate />
    </div>
  );
}
