import { NextRequest } from "next/server";
import { brainFetch } from "@/lib/brain";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const pass = async (r: Response) =>
  new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });

const denied = () =>
  new Response(JSON.stringify({ error: "not signed in — or not on the invite list" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });

// GET /api/docs               -> list Workspace Docs
export async function GET() {
  if (!(await requireUser())) return denied();
  return pass(await brainFetch("docs-read", { op: "list" }));
}

// POST /api/docs { op:"get", path }            -> load one doc
// POST /api/docs { op:"save", path, title, content, category } -> upsert
export async function POST(req: NextRequest) {
  if (!(await requireUser())) return denied();
  const b = await req.json().catch(() => ({}));
  if (b.op === "save") {
    return pass(await brainFetch("docs-upsert", {
      path: b.path, title: b.title, category: b.category,
      content: b.content, collection: "Workspace Docs",
    }));
  }
  return pass(await brainFetch("docs-read", { op: "get", path: b.path, id: b.id }));
}
