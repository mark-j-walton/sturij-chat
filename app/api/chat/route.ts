import { NextRequest } from "next/server";
import { brainFetch } from "@/lib/brain";

export const runtime = "nodejs";

// Proxy chat to the brain `chat` function and stream the SSE straight through.
export async function POST(req: NextRequest) {
  const { messages } = await req.json().catch(() => ({ messages: [] }));
  const r = await brainFetch("chat", { messages, stream: true });
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
