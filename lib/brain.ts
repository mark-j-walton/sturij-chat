// Server-only helper for talking to the brain edge functions.
// The ingest token lives in server env and is NEVER sent to the browser.
const BASE = process.env.BRAIN_BASE!;
const TOKEN = process.env.BRAIN_INGEST_TOKEN!;

export function brainFetch(fn: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ingest-token": TOKEN },
    body: JSON.stringify(body),
  });
}
