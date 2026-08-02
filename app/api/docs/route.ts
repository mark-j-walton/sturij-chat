import { NextRequest } from "next/server";
import { brainFetch } from "@/lib/brain";

export const runtime = "nodejs";

const pass = async (r: Response) =>
  new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });

// GET /api/docs               -> list Workspace Docs
export async function GET() {
  return pass(await brainFetch("docs-read", { op: "list" }));
}

// POST /api/docs { op:"get", path }            -> load one doc
// POST /api/docs { op:"save", path, title, content, category } -> upsert
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (b.op === "save") {
    return pass(await brainFetch("docs-upsert", {
      path: b.path, title: b.title, category: b.category,
      content: b.content, collection: "Workspace Docs",
    }));
  }
  return pass(await brainFetch("docs-read", { op: "get", path: b.path, id: b.id }));
}
