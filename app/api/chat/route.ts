import { NextRequest } from "next/server";
import { brainFetch } from "@/lib/brain";

export const runtime = "nodejs";

// Proxy chat to the brain `chat` function. Session ops (list/history) return
// JSON; a chat turn streams the SSE straight through. session_id rides along so
// the brain persists every conversation (S7: nothing ages out).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));

  if (b.op === "sessions" || b.op === "history") {
    const r = await brainFetch("chat", { op: b.op, session_id: b.session_id });
    return new Response(await r.text(), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  }

  const r = await brainFetch("chat", {
    messages: b.messages ?? [],
    session_id: b.session_id ?? null,
    stream: true,
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    return new Response(`data: ${JSON.stringify({ error: text || r.statusText })}\n\ndata: [DONE]\n\n`, {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }
  return new Response(r.body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
