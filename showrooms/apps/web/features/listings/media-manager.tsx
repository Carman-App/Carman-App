"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, RotateCcw, Star, Trash2, Video } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { IMAGE_MIME_TYPES, UPLOAD_RULES, VEHICLE_LIMITS, VIDEO_MIME_TYPES, type Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { uploadFile } from "./uploads";

interface PendingUpload {
  key: string;
  file: File;
  kind: "image" | "video";
  progress: number;
  error?: string;
  preview: string;
}

export function MediaManager({ vehicle, onChange }: { vehicle: Vehicle; onChange: (v: Vehicle) => void }) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const editable = ["DRAFT", "PENDING_REVIEW", "REJECTED", "ACTIVE"].includes(vehicle.status);

  const update = (key: string, patch: Partial<PendingUpload>) => setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  async function run(item: PendingUpload) {
    update(item.key, { error: undefined, progress: 0 });
    try {
      await uploadFile(item.file, item.kind === "image" ? "VEHICLE_IMAGE" : "VEHICLE_VIDEO", { vehicleId: vehicle.id, onProgress: (progress) => update(item.key, { progress }) });
      setPending((list) => list.filter((p) => p.key !== item.key));
      URL.revokeObjectURL(item.preview);
      onChange(await api<Vehicle>(`/vehicles/${vehicle.id}`));
    } catch (err) {
      update(item.key, { error: errorMessage(err) });
    }
  }

  function add(files: FileList | null, kind: "image" | "video") {
    if (!files) return;
    const rule = UPLOAD_RULES[kind === "image" ? "VEHICLE_IMAGE" : "VEHICLE_VIDEO"];
    const room = (kind === "image" ? VEHICLE_LIMITS.maxImages - vehicle.images.length : VEHICLE_LIMITS.maxVideos - vehicle.videos.length) - pending.filter((p) => p.kind === kind).length;
    const accepted: PendingUpload[] = [];
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      if (!rule.mime.includes(file.type)) {
        toast.error(`${file.name}: file type not allowed`);
        continue;
      }
      // Images are compressed before upload, so only reject videos on size here.
      if (kind === "video" && file.size > rule.maxBytes) {
        toast.error(`${file.name} is larger than ${Math.round(rule.maxBytes / 1024 / 1024)} MB`);
        continue;
      }
      accepted.push({ key: crypto.randomUUID(), file, kind, progress: 0, preview: URL.createObjectURL(file) });
    }
    if (files.length > accepted.length && room <= 0) toast.error(`You can add up to ${kind === "image" ? VEHICLE_LIMITS.maxImages : VEHICLE_LIMITS.maxVideos} ${kind}s`);
    setPending((list) => [...list, ...accepted]);
    // Upload two at a time: friendlier to slow connections than all at once.
    (async () => {
      const queue = [...accepted];
      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) await run(item);
      };
      await Promise.all([worker(), worker()]);
    })();
  }

  async function reorder(order: string[], videos?: string[]) {
    setBusy(true);
    try {
      onChange(await api<Vehicle>(`/vehicles/${vehicle.id}`, { method: "PATCH", body: { imageOrder: order, ...(videos ? { videoOrder: videos } : {}) } }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const ids = vehicle.images.map((i) => i.publicId);
  const move = (from: number, to: number) => {
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    reorder(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => imageInput.current?.click()} disabled={!editable}>
          <ImagePlus /> Add photos
        </Button>
        <Button type="button" variant="outline" onClick={() => videoInput.current?.click()} disabled={!editable || vehicle.videos.length >= VEHICLE_LIMITS.maxVideos}>
          <Video /> Add video
        </Button>
        <input ref={imageInput} type="file" accept={IMAGE_MIME_TYPES.join(",")} multiple hidden onChange={(e) => (add(e.target.files, "image"), (e.target.value = ""))} />
        <input ref={videoInput} type="file" accept={VIDEO_MIME_TYPES.join(",")} hidden onChange={(e) => (add(e.target.files, "video"), (e.target.value = ""))} />
      </div>
      <p className="text-xs text-ink-muted">
        Up to {VEHICLE_LIMITS.maxImages} photos and {VEHICLE_LIMITS.maxVideos} short videos. The first photo is the cover. Photos are resized on your device to save data.
      </p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Photos">
        {vehicle.images.map((img, i) => (
          <li key={img.publicId} className={cn("overflow-hidden rounded-lg border bg-white", i === 0 ? "border-accent ring-1 ring-accent" : "border-border")}>
            <div className="relative aspect-[4/3] bg-surface">
              <Image src={img.url} alt={`Photo ${i + 1}`} fill sizes="200px" className="object-cover" />
              {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">Cover</span>}
            </div>
            <div className="flex items-center justify-between p-1.5">
              <div className="flex">
                <button type="button" className="rounded p-1.5 hover:bg-surface disabled:opacity-30" disabled={busy || i === 0} onClick={() => move(i, i - 1)} aria-label="Move earlier"><ArrowUp className="size-4" /></button>
                <button type="button" className="rounded p-1.5 hover:bg-surface disabled:opacity-30" disabled={busy || i === ids.length - 1} onClick={() => move(i, i + 1)} aria-label="Move later"><ArrowDown className="size-4" /></button>
                <button type="button" className="rounded p-1.5 hover:bg-surface disabled:opacity-30" disabled={busy || i === 0} onClick={() => move(i, 0)} aria-label="Make cover photo"><Star className="size-4" /></button>
              </div>
              <button type="button" className="rounded p-1.5 text-danger hover:bg-danger-soft disabled:opacity-30" disabled={busy || !editable} onClick={() => reorder(ids.filter((id) => id !== img.publicId))} aria-label="Remove photo"><Trash2 className="size-4" /></button>
            </div>
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.key} className="overflow-hidden rounded-lg border border-dashed border-border bg-white">
            <div className="relative aspect-[4/3] bg-surface">
              {p.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.preview} alt="" className="h-full w-full object-cover opacity-60" />
              ) : (
                <div className="grid h-full place-items-center"><Video className="size-8 text-ink-subtle" /></div>
              )}
              <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${p.file.name}`}>
                <div className="h-full bg-accent transition-all" style={{ width: `${p.progress}%` }} />
              </div>
            </div>
            <div className="p-2 text-xs">
              {p.error ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-danger" title={p.error}>{p.error}</span>
                  <button type="button" onClick={() => run(p)} className="flex items-center gap-1 font-semibold text-accent"><RotateCcw className="size-3.5" /> Retry</button>
                </div>
              ) : (
                <span className="text-ink-muted tabular">{p.progress < 100 ? `Uploading ${p.progress}%` : "Processing…"}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {vehicle.videos.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Videos">
          {vehicle.videos.map((v) => (
            <li key={v.publicId} className="flex items-center gap-3 rounded-lg border border-border bg-white p-3">
              <Video className="size-5 text-ink-muted" />
              <span className="flex-1 truncate text-sm">Video{v.durationSec ? ` · ${Math.round(v.durationSec)}s` : ""}</span>
              <button type="button" className="text-danger" onClick={() => reorder(ids, vehicle.videos.filter((x) => x.publicId !== v.publicId).map((x) => x.publicId))} aria-label="Remove video"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
