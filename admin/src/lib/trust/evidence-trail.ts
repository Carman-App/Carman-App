import "server-only";
import { prisma } from "@/lib/prisma";

// TRUST-02 — evidence trail for a disputed invoice/vehicle/job/estimate.
//
// Builds one chronological list from whatever real rows exist: job, its
// estimates (+ items + decisions), invoices (+ items + payments),
// inspections, and any documents on the linked vehicle. There is no
// updatedAt on Invoice/Payment/Estimate/EstimateDecision in this schema, so
// "edited" markers are NOT derivable — only "entered late" (a timestamp
// that is chronologically impossible/implausible given its parent record)
// is flagged, and only where it can actually be detected from real fields.

const LATE_DECISION_THRESHOLD_DAYS = 14; // decidedAt this far after the estimate was created looks like a late-entered decision, not a same-session approval

export type EvidenceEntry = {
  id: string;
  at: Date;
  kind:
    | "Job opened"
    | "Job status change"
    | "Inspection"
    | "Estimate"
    | "Estimate decision"
    | "Invoice"
    | "Payment"
    | "Vehicle document";
  summary: string;
  anachrony?: string; // set when this entry looks entered-late relative to a related record
};

type DisputeSubject = {
  jobId?: string | null;
  vehicleId?: string | null;
  invoiceId?: string | null; // plain id, no back-relation (see schema header convention)
  estimateId?: string | null;
};

export async function getDisputeEvidenceTrail(dispute: DisputeSubject): Promise<EvidenceEntry[]> {
  const entries: EvidenceEntry[] = [];

  if (dispute.jobId) {
    const job = await prisma.job.findUnique({
      where: { id: dispute.jobId },
      include: {
        statusEvents: { orderBy: { changedAt: "asc" } },
        inspections: { orderBy: { createdAt: "asc" } },
        estimates: { include: { items: true, decisions: true }, orderBy: { createdAt: "asc" } },
        invoices: { include: { items: true, payments: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (job) {
      entries.push({
        id: `job:${job.id}`,
        at: job.createdAt,
        kind: "Job opened",
        summary: `Job opened — ${job.faultDescription}`,
      });

      for (const evt of job.statusEvents) {
        entries.push({
          id: `jobstatus:${evt.id}`,
          at: evt.changedAt,
          kind: "Job status change",
          summary: `${evt.fromStatus ?? "(new)"} → ${evt.toStatus}`,
        });
      }

      for (const insp of job.inspections) {
        entries.push({
          id: `inspection:${insp.id}`,
          at: insp.createdAt,
          kind: "Inspection",
          summary: insp.summary,
        });
      }

      for (const est of job.estimates) {
        entries.push({
          id: `estimate:${est.id}`,
          at: est.createdAt,
          kind: "Estimate",
          summary: `Estimate ${est.status} — ${est.items.length} line(s)`,
        });
        for (const dec of est.decisions) {
          const gapDays = (dec.decidedAt.getTime() - est.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          entries.push({
            id: `estimatedecision:${dec.id}`,
            at: dec.decidedAt,
            kind: "Estimate decision",
            summary: `${dec.decision}${dec.note ? ` — ${dec.note}` : ""}`,
            anachrony:
              gapDays > LATE_DECISION_THRESHOLD_DAYS
                ? `Decided ${Math.round(gapDays)} days after the estimate was created — flagged as possibly entered late.`
                : gapDays < 0
                  ? "Decision timestamp is before the estimate's createdAt — impossible ordering, flagged."
                  : undefined,
          });
        }
      }

      for (const inv of job.invoices) {
        entries.push({
          id: `invoice:${inv.id}`,
          at: inv.createdAt,
          kind: "Invoice",
          summary: `Invoice ${inv.status} — ${inv.items.length} line(s)`,
        });
        for (const pay of inv.payments) {
          const beforeInvoice = pay.paidAt.getTime() < inv.createdAt.getTime();
          entries.push({
            id: `payment:${pay.id}`,
            at: pay.paidAt,
            kind: "Payment",
            summary: `Payment recorded (${pay.method})`,
            anachrony: beforeInvoice
              ? "Payment is dated before its invoice was created — impossible ordering, flagged as a chronological anomaly."
              : undefined,
          });
        }
      }
    }
  }

  if (dispute.vehicleId) {
    const documents = await prisma.document.findMany({
      where: { vehicleId: dispute.vehicleId, deletedAt: null },
      orderBy: { addedAt: "asc" },
    });
    for (const doc of documents) {
      entries.push({
        id: `document:${doc.id}`,
        at: doc.addedAt,
        kind: "Vehicle document",
        summary: doc.takedownAt
          ? `${doc.title} — [Image removed: ${doc.takedownReason ?? "no reason recorded"}]`
          : doc.title,
      });
    }
  }

  // dispute.invoiceId / dispute.estimateId are plain ids with no FK — if the
  // dispute names one directly (rather than reaching it via jobId), surface
  // that honestly rather than silently ignoring it.
  if (dispute.invoiceId && !dispute.jobId) {
    entries.push({
      id: `invoice-ref:${dispute.invoiceId}`,
      at: new Date(0),
      kind: "Invoice",
      summary: `Dispute references invoice id ${dispute.invoiceId} directly (no jobId on this dispute to join through) — open it separately to inspect.`,
    });
  }
  if (dispute.estimateId && !dispute.jobId) {
    entries.push({
      id: `estimate-ref:${dispute.estimateId}`,
      at: new Date(0),
      kind: "Estimate",
      summary: `Dispute references estimate id ${dispute.estimateId} directly (no jobId on this dispute to join through) — open it separately to inspect.`,
    });
  }

  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}
