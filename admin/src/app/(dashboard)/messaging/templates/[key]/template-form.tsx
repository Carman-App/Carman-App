"use client";

import { useActionState, useMemo, useState } from "react";
import { saveTemplate, type ActionState } from "../actions";
import { renderTemplateText, sampleValuesFor, validateTemplateVariables } from "@/lib/messaging/templates";

export function TemplateForm({
  templateKey,
  language,
  initialSubject,
  initialBody,
  initialVariables,
}: {
  templateKey: string;
  language: string;
  initialSubject: string;
  initialBody: string;
  initialVariables: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveTemplate, undefined);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [variablesRaw, setVariablesRaw] = useState(initialVariables.join(", "));

  const variables = useMemo(
    () => variablesRaw.split(",").map((v) => v.trim()).filter(Boolean),
    [variablesRaw],
  );
  const undeclared = useMemo(() => validateTemplateVariables(subject, body, variables), [subject, body, variables]);
  const samples = useMemo(() => sampleValuesFor(variables), [variables]);
  const previewSubject = useMemo(() => renderTemplateText(subject, samples), [subject, samples]);
  const previewBody = useMemo(() => renderTemplateText(body, samples), [body, samples]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
        <input type="hidden" name="key" value={templateKey} />
        <div>
          <label className="block text-xs text-neutral-500">Language</label>
          <input
            name="language"
            defaultValue={language}
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Subject</label>
          <input
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Body — use {"{{variableName}}"} placeholders</label>
          <textarea
            name="body"
            required
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Declared variables (comma-separated)</label>
          <input
            name="variables"
            value={variablesRaw}
            onChange={(e) => setVariablesRaw(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>

        {undeclared.length > 0 && (
          <p className="text-sm text-amber-700">
            Uses undeclared placeholder{undeclared.length === 1 ? "" : "s"}: {undeclared.map((v) => `{{${v}}}`).join(", ")}.
            Saving will be rejected until these are added to Variables or removed from Subject/Body.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save template"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
      </form>

      <div className="space-y-2 rounded border border-neutral-200 p-4">
        <h3 className="text-sm font-medium text-neutral-800">Preview (sample values)</h3>
        <p className="text-xs text-neutral-500">
          Each declared variable is substituted with a placeholder sample value (e.g. {"<vehicleName>"}).
          This is a rendering preview only — nothing is sent.
        </p>
        {previewSubject && <p className="text-sm font-medium text-neutral-900">{previewSubject}</p>}
        <p className="whitespace-pre-wrap text-sm text-neutral-700">{previewBody}</p>
      </div>
    </div>
  );
}
