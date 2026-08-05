// Server-only helper for talking to the brain edge functions.
// The ingest token lives in server env and is NEVER sent to the browser.
// Values are trimmed because a pasted trailing newline/space in a Vercel env
// var makes the header invalid and turns every request into a blank 500.
const BASE = (process.env.BRAIN_BASE ?? "").trim().replace(/\/+$/, "");
const TOKEN = (process.env.BRAIN_INGEST_TOKEN ?? "").trim();

export async function brainFetch(fn: string, body: unknown): Promise<Response> {
  if (!BASE || !TOKEN) {
    return new Response(
      JSON.stringify({ error: "brain not configured — set BRAIN_BASE and BRAIN_INGEST_TOKEN in the server environment" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }
  try {
    return await fetch(`${BASE}/${fn}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ingest-token": TOKEN },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `brain unreachable: ${String(e).slice(0, 200)}` }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}
