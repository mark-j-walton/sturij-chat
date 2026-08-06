import { NextRequest } from "next/server";
import { brainFetch } from "@/lib/brain";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

// Proxy chat to the brain `chat` function. V0: every call requires a signed-in,
// invited user; their email rides along so the brain keys sessions per user —
// each person sees only their own conversations. Session ops return JSON; a
// chat turn streams the SSE straight through.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "not signed in — or not on the invite list" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const b = await req.json().catch(() => ({}));

  if (b.op === "sessions" || b.op === "history") {
    const r = await brainFetch("chat", { op: b.op, session_id: b.session_id, user: user.email });
    return new Response(await r.text(), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  }

  const r = await brainFetch("chat", {
    messages: b.messages ?? [],
    session_id: b.session_id ?? null,
    user: user.email,
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
