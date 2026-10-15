"use client";

import { BadgeCheck, FileUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DOCUMENT_MIME_TYPES, ID_TYPES, VERIFICATION_DOC_KINDS, VERIFICATION_EXPLAINER } from "@showrooms/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { uploadFile } from "@/features/listings/uploads";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

type Kind = (typeof VERIFICATION_DOC_KINDS)[number];
interface MyVerification { status: string; latest?: { status: string; reviewNotes?: string; submittedAt: string } }

const DOC_LABEL: Record<Kind, string> = { ID_FRONT: "ID (front)", ID_BACK: "ID (back)", SELFIE: "Selfie holding ID", BUSINESS_PERMIT: "Business permit", KRA_PIN: "KRA PIN certificate", CERTIFICATE_OF_INCORPORATION: "Certificate of incorporation", OTHER: "Other" };

export function VerificationCard({ kind }: { kind: "brokers" | "dealers" }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["verification", kind], queryFn: () => api<MyVerification>(`/${kind}/verification`) });
  const [docs, setDocs] = useState<{ publicId: string; kind: Kind; name: string }[]>([]);
  const [uploading, setUploading] = useState<Kind | null>(null);
  const [form, setForm] = useState({ fullName: "", idType: "NATIONAL_ID", idNumber: "", kraPin: "", businessName: "", businessRegNumber: "" });
  const [busy, setBusy] = useState(false);
  const status = me.data?.status ?? "UNVERIFIED";
  const canSubmit = status === "UNVERIFIED" || status === "REJECTED" || status === "INFO_REQUESTED";

  async function upload(docKind: Kind, file: File | undefined) {
    if (!file) return;
    setUploading(docKind);
    try {
      const res = await uploadFile<{ publicId: string }>(file, "VERIFICATION_DOC");
      setDocs((d) => [...d.filter((x) => x.kind !== docKind), { publicId: res.publicId, kind: docKind, name: file.name }]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/${kind}/verification`, {
        method: "POST",
        body: { ...form, kraPin: form.kraPin || undefined, businessName: form.businessName || undefined, businessRegNumber: form.businessRegNumber || undefined, documents: docs.map(({ publicId, kind }) => ({ publicId, kind })) },
      });
      toast.success("Submitted", { description: "We'll review your documents within 1–2 business days." });
      qc.invalidateQueries({ queryKey: ["verification"] });
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="verification">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BadgeCheck className="size-5 text-verified" /> Verification <Badge tone={status === "VERIFIED" ? "success" : status === "PENDING" ? "info" : status === "UNVERIFIED" ? "neutral" : "warning"}>{status.replace("_", " ").toLowerCase()}</Badge></CardTitle>
        <CardDescription>{VERIFICATION_EXPLAINER.broker} Your documents are stored privately and only our verification team can see them.</CardDescription>
      </CardHeader>
      <CardContent>
        {me.data?.latest?.reviewNotes && status !== "VERIFIED" && <p className="mb-4 rounded-md bg-warning-soft p-3 text-sm">Reviewer note: {me.data.latest.reviewNotes}</p>}
        {canSubmit ? (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name (as on ID)" htmlFor="v-name"><Input id="v-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="ID type" htmlFor="v-type">
              <Select id="v-type" value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
                {ID_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ").toLowerCase()}</option>)}
              </Select>
            </Field>
            <Field label="ID number" htmlFor="v-idn"><Input id="v-idn" required value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} autoComplete="off" /></Field>
            <Field label="KRA PIN (optional)" htmlFor="v-kra"><Input id="v-kra" value={form.kraPin} onChange={(e) => setForm({ ...form, kraPin: e.target.value })} placeholder="A123456789B" /></Field>
            {kind === "dealers" && (
              <>
                <Field label="Registered business name" htmlFor="v-biz"><Input id="v-biz" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
                <Field label="Registration number" htmlFor="v-reg"><Input id="v-reg" value={form.businessRegNumber} onChange={(e) => setForm({ ...form, businessRegNumber: e.target.value })} /></Field>
              </>
            )}
            <div className="grid gap-2 sm:col-span-2">
              <p className="text-sm font-medium">Documents</p>
              {(["ID_FRONT", "ID_BACK", ...(kind === "dealers" ? (["BUSINESS_PERMIT", "CERTIFICATE_OF_INCORPORATION"] as const) : (["SELFIE"] as const))] as Kind[]).map((k) => {
                const done = docs.find((d) => d.kind === k);
                return (
                  <label key={k} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-border p-3 text-sm hover:bg-surface">
                    <span className="flex items-center gap-2">{uploading === k ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4 text-ink-muted" />} {DOC_LABEL[k]}</span>
                    <span className="truncate text-xs text-ink-muted">{done ? `✓ ${done.name}` : "Choose file"}</span>
                    <input type="file" className="sr-only" accept={DOCUMENT_MIME_TYPES.join(",")} onChange={(e) => upload(k, e.target.files?.[0])} />
                  </label>
                );
              })}
            </div>
            <Button type="submit" loading={busy} disabled={!docs.some((d) => d.kind === "ID_FRONT")} className="sm:col-span-2">Submit for verification</Button>
          </form>
        ) : (
          <p className="text-sm text-ink-muted">{status === "VERIFIED" ? "You're verified. Your badge shows on your showroom and listings." : "Your documents are being reviewed. We'll notify you when there's a decision."}</p>
        )}
      </CardContent>
    </Card>
  );
}
