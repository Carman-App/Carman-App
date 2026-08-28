/**
 * COMM-04 — NotificationTemplate variable validation + rendering.
 *
 * IMPORTANT (checked against the codebase before writing this): no code path
 * anywhere in this app currently reads from NotificationTemplate to render
 * an actual notification. `src/lib/notifications/provider.ts`'s `notify()`
 * is called from exactly one place today (garage ownership transfer, in
 * src/app/(dashboard)/garages/[id]/actions.ts) and it hardcodes its title/
 * body inline with NotificationType.GENERIC — it does not look up a
 * template by key/language. None of NotificationType's other members
 * (JOB_UPDATE, ESTIMATE_READY, INVOICE_ISSUED, DOCUMENT_EXPIRING,
 * ACCESS_REQUEST) are referenced by any call site in src/app/api/v1/** or
 * elsewhere. The six NotificationTemplate keys this editor manages
 * (SERVICE_DUE, DOCUMENT_EXPIRING, INVITE, ESTIMATE, INVOICE, PAYMENT) don't
 * even correspond 1:1 to NotificationType's members — they're a separate,
 * forward-looking key namespace. So: editing a template here is a real,
 * validated, audited write to a real table, but it has ZERO effect on what
 * the app actually sends today. This is the editing surface for when a real
 * send path is built to read from it — say so plainly in the UI.
 */

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(PLACEHOLDER_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    found.add(match[1]);
  }
  return [...found];
}

/**
 * Returns every {{placeholder}} used in subject/body that is NOT present in
 * the declared `variables` list — an empty array means the template is
 * valid. Save should reject (or at least warn strongly) when this is
 * non-empty, per COMM-04 "variable validation... reject/warn otherwise".
 */
export function validateTemplateVariables(
  subject: string | null | undefined,
  body: string,
  variables: string[],
): string[] {
  const declared = new Set(variables.map((v) => v.trim()).filter(Boolean));
  const used = new Set<string>([...(subject ? extractPlaceholders(subject) : []), ...extractPlaceholders(body)]);
  return [...used].filter((v) => !declared.has(v));
}

/**
 * Renders a template's text substituting `values` for each {{placeholder}}.
 * A declared variable with no supplied sample value is left as the literal
 * "{{name}}" text rather than silently blanked, so a preview makes a
 * missing sample obvious instead of hiding it.
 */
export function renderTemplateText(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER_RE, (full, name: string) => (name in values ? values[name] : full));
}

/** One sample value per declared variable, used to populate the preview form. */
export function sampleValuesFor(variables: string[]): Record<string, string> {
  const samples: Record<string, string> = {};
  for (const v of variables) samples[v] = `<${v}>`;
  return samples;
}

export type SeedTemplate = {
  key: string;
  variables: string[];
  subject: string;
  body: string;
};

/**
 * Starting-draft copy for the six required keys, seeded once (see
 * templates/page.tsx) so the editor isn't empty on first load. No real
 * call-site copy exists anywhere in this codebase to base these on (see the
 * module comment above) — these are reasonable placeholder drafts, not
 * fabricated production copy, and are labelled as drafts in the UI.
 */
export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    key: "SERVICE_DUE",
    variables: ["vehicleName", "dueDate"],
    subject: "Service due soon",
    body: "Your {{vehicleName}} is due for service around {{dueDate}}. Book a workshop visit soon.",
  },
  {
    key: "DOCUMENT_EXPIRING",
    variables: ["documentTitle", "expiryDate"],
    subject: "A document is expiring",
    body: "Your {{documentTitle}} expires on {{expiryDate}}. Renew it to stay compliant.",
  },
  {
    key: "INVITE",
    variables: ["inviterName", "garageName"],
    subject: "You've been invited",
    body: "{{inviterName}} invited you to join {{garageName}} on Carma.",
  },
  {
    key: "ESTIMATE",
    variables: ["workshopName", "total"],
    subject: "New estimate ready",
    body: "{{workshopName}} sent you an estimate for {{total}}. Review and approve it in the app.",
  },
  {
    key: "INVOICE",
    variables: ["workshopName", "total"],
    subject: "Invoice issued",
    body: "{{workshopName}} issued an invoice for {{total}}. View and pay it in the app.",
  },
  {
    key: "PAYMENT",
    variables: ["amount", "invoiceRef"],
    subject: "Payment recorded",
    body: "A payment of {{amount}} was recorded against invoice {{invoiceRef}}. Thanks!",
  },
];
