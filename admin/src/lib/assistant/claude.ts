import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * Carma's assistant: one Claude call per question, answered from a text
 * snapshot of the caller's own garage or workshop (see ./context.ts).
 *
 * The reply is structured (Zod-validated) so the app can render the answer
 * and, when the owner described something that happened, an editable draft
 * record. The model never writes anything: drafts go through the app's
 * Review → "What will change" → save flow like any hand-entered record.
 */

export const MODEL = "claude-opus-5-5";

const DraftSchema = z.object({
  kind: z.enum(["fuel", "service", "repair", "part", "expense", "odometer"]),
  vehicleId: z.string().nullable().describe("Id from the vehicles list, or null if unclear"),
  amount: z.number().nullable(),
  litres: z.number().nullable(),
  odometer: z.number().int().nullable(),
  place: z.string().nullable(),
  category: z.enum(["fuel", "service", "insurance", "loan", "other"]).nullable(),
  title: z.string().nullable().describe("Short description of the work or item, e.g. 'Front pads and discs'"),
  date: z.string().nullable().describe("YYYY-MM-DD if the user gave a date, else null"),
});

const LinkSchema = z.object({
  label: z.string(),
  target: z.enum(["insights", "documents", "reminders", "garage", "timeline", "job_board", "job"]),
  id: z.string().nullable().describe("Vehicle id for 'timeline', job id for 'job', else null"),
});

export const AssistantReplySchema = z.object({
  lead: z.string().describe("The answer in one sentence. Shown in bold."),
  body: z.string().nullable().describe("At most two further sentences of supporting detail, or null."),
  checked: z.string().nullable().describe("What was looked at, e.g. 'Checked 38 fills', or null."),
  draft: DraftSchema.nullable().describe("Only when the user described something that happened to a vehicle."),
  link: LinkSchema.nullable(),
  jobIds: z.array(z.string()).describe("Mechanic mode: job ids the answer is about. Owner mode: empty."),
});

export type AssistantReply = z.infer<typeof AssistantReplySchema>;

export type Turn = { question: string; answer: string };

// Stable instructions, kept byte-identical across requests so they cache.
const OWNER_SYSTEM = `You are Carma, the assistant inside a vehicle-ownership app. You answer the owner's questions about their own garage from the records supplied in the conversation, and you turn descriptions of things that happened into draft records.

How to answer:
- Answer from the supplied records only. If the records don't hold the answer, say so plainly and say what record would make it answerable. Never invent figures, dates, places or vehicles.
- Put the direct answer in "lead" as one sentence. Use "body" for at most two short sentences of useful detail (a comparison with their own average, what is next). Plain language, no markdown, no bullet points.
- Money is in the account's currency, written like "KES 6,480". Distances in the account's unit.
- When the question is about one vehicle, scope it to that vehicle. "The car" means the vehicle the user has selected, if one is given.
- Cost per km is total spend divided by the distance between the lowest and highest odometer readings in the period.
- Set "link" when a screen in the app would show more: insights for spending, documents for papers and expiry, reminders for what is due, timeline (with the vehicle id) for one car's history.

Drafts:
- Only when the user describes something that happened ("filled up at Shell, 6,480, 47 litres", "Joe's did the brakes for 24,500", "odo is 85,102 today"), fill "draft". For questions, "draft" is null.
- kind: fuel, service, repair, part, expense (insurance, loan, licence, parking, car wash, fines, accessories and anything else - set category), or odometer for a bare reading.
- Read slang amounts literally: "6,480 bob" is 6480 in the local currency. Leave a field null rather than guess it.
- Pick vehicleId from the vehicles list when the vehicle is clear from the message or the selected vehicle; otherwise null.
- In "lead", say what the draft is and one useful observation (price per litre against their average, distance since the last reading). The user checks every field before anything is saved.`;

const MECHANIC_SYSTEM = `You are Carma, the assistant inside a workshop's job board. You answer the mechanic's questions about their own jobs, customers, job lines and what is owed, from the supplied job list only.

How to answer:
- Answer from the supplied jobs only. Never invent jobs, prices or customers. If the data doesn't hold the answer, say so.
- Put the direct answer in "lead" as one sentence; "body" holds at most two short sentences or a short list of jobs as "Customer · Job · amount" lines separated by newlines. No markdown.
- Statuses: INTAKE (new), AWAITING_APPROVAL (waiting on the owner), APPROVED, IN_PROGRESS, READY_FOR_COLLECTION, INVOICED and PARTIALLY_PAID (still owed), PAID, DECLINED, CANCELLED.
- A job's value is the sum of its lines. Money in the account's currency, like "KES 34,600".
- List the job ids the answer is about in "jobIds". Set "link" to job (with its id) when the answer is about one job, or job_board for several. "draft" is always null.`;

export class AssistantNotConfiguredError extends Error {
  constructor() {
    super("The assistant is not configured on this server (no Anthropic credentials).");
    this.name = "AssistantNotConfiguredError";
  }
}

export class AssistantRefusedError extends Error {
  constructor() {
    super("Carma can't help with that one.");
    this.name = "AssistantRefusedError";
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new AssistantNotConfiguredError();
  }
  client ??= new Anthropic();
  return client;
}

export async function askClaude(input: {
  mode: "owner" | "mechanic";
  context: string;
  question: string;
  history: Turn[];
  currency: string;
  distanceUnit: "km" | "mi";
  today: string;
  selectedVehicle: string | null;
}): Promise<AssistantReply> {
  const anthropic = getClient();

  const preamble = [
    `Today is ${input.today}. Currency: ${input.currency}. Distance unit: ${input.distanceUnit}.`,
    input.mode === "owner" ? `Selected vehicle: ${input.selectedVehicle ?? "none (the whole garage)"}.` : null,
    "",
    input.context,
  ]
    .filter((l) => l !== null)
    .join("\n");

  // History is replayed as plain text turns (never edited), then the new question.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: [{ type: "text", text: preamble, cache_control: { type: "ephemeral" } }] },
    { role: "assistant", content: "I have the records. What would you like to know?" },
  ];
  for (const t of input.history) {
    messages.push({ role: "user", content: t.question });
    messages.push({ role: "assistant", content: t.answer });
  }
  messages.push({ role: "user", content: input.question });

  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: input.mode === "owner" ? OWNER_SYSTEM : MECHANIC_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    output_config: {
      // A chat answer over a known record set: low effort keeps replies quick.
      effort: "low",
      format: betaZodOutputFormat(AssistantReplySchema),
    },
    messages,
  });

  if (response.stop_reason === "refusal") throw new AssistantRefusedError();
  if (!response.parsed_output) {
    throw new Error(`Assistant reply could not be parsed (stop_reason: ${response.stop_reason}).`);
  }
  return response.parsed_output;
}
