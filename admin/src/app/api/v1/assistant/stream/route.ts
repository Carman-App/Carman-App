import type { NextRequest } from "next/server";
import { streamClaude } from "@/lib/assistant/claude";
import { assistantError, assistantErrorResponse, prepareAssistant } from "@/lib/assistant/request";
import { handleApiError } from "@/lib/api/errors";

// POST /api/v1/assistant/stream — same request as /api/v1/assistant, answered
// as newline-delimited JSON so the app can show the answer as it is written:
//   {"type":"text","lead":"...","body":"..."}   (repeated, growing)
//   {"type":"done","data":{...full reply...}}
//   {"type":"error","code":"...","message":"..."}   (failure after the stream began)
// Failures before the model starts (auth, validation, rate limit, no key)
// come back as an ordinary JSON error response with the right status.
export async function POST(req: NextRequest) {
  let input;
  try {
    input = await prepareAssistant(req);
  } catch (error) {
    return assistantErrorResponse(error);
  }
  const prepared = input;

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const reply = await streamClaude(prepared, { onText: (p) => send({ type: "text", ...p }) });
        send({ type: "done", data: reply });
      } catch (error) {
        const mapped = assistantError(error);
        if (!mapped) handleApiError(error); // logs it
        send({ type: "error", code: mapped?.code ?? "INTERNAL_ERROR", message: mapped?.message ?? "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
