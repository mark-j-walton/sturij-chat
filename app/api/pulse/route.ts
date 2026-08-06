import { brainFetch } from "@/lib/brain";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

// S12 the Fold: platform status inside the one door. Proxies the steward's
// read-only metrics op — loop health, audit trail, latest Programme.
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "not signed in — or not on the invite list" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const r = await brainFetch("steward", { op: "metrics" });
  return new Response(await r.text(), {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}
