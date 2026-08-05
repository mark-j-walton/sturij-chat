"use client";

import { Component, ReactNode, useEffect, useState } from "react";
import { Editor } from "./Editor";

type DocMeta = {
  id: string; path: string; title: string;
  category: string | null; chars: number; updated_at: string;
};

// If MDXEditor can't parse a doc as MDX, fall back to a raw-markdown textarea.
class EditorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode; resetKey: string },
  { err: boolean }
> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: false });
  }
  render() {
    return this.state.err ? this.props.fallback : this.props.children;
  }
}

export default function DocsPane() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [sel, setSel] = useState<DocMeta | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/docs");
      const j = await r.json();
      setDocs(j.docs || []);
    })();
  }, []);

  async function open(d: DocMeta) {
    setLoading(true);
    setStatus("");
    const r = await fetch("/api/docs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "get", path: d.path }),
    });
    const j = await r.json();
    setSel(d);
    setContent(j.content || "");
    setDirty(false);
    setLoading(false);
  }

  async function save() {
    if (!sel) return;
    setStatus("Saving…");
    const r = await fetch("/api/docs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "save", path: sel.path, title: sel.title, category: sel.category, content }),
    });
    const j = await r.json();
    setStatus(
      j.ok
        ? j.searchable
          ? `Saved ✓ · searchable (${j.chunks} chunks)`
          : `Saved ✓ (${j.action})`
        : `⚠️ ${j.error || "failed"}`
    );
    setDirty(false);
  }

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 overflow-y-auto border-r p-2">
        <div className="text-muted-foreground px-2 py-1 text-xs font-semibold uppercase tracking-wide">
          Workspace Docs
        </div>
        {docs.map((d) => (
          <button
            key={d.path}
            onClick={() => open(d)}
            className={`hover:bg-muted block w-full truncate rounded px-2 py-1.5 text-left text-sm ${
              sel?.path === d.path ? "bg-muted font-medium" : ""
            }`}
          >
            {d.path}
          </button>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {sel ? (
          <>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="truncate text-sm font-medium">
                {sel.path}
                {dirty && <span className="text-amber-500"> •</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">{status}</span>
                <button
                  onClick={save}
                  disabled={!dirty}
                  className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-muted-foreground p-6 text-sm">Loading…</div>
              ) : (
                <EditorBoundary
                  resetKey={sel.path}
                  fallback={
                    <textarea
                      className="h-full min-h-[60vh] w-full resize-none p-4 font-mono text-sm outline-none"
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        setDirty(true);
                      }}
                    />
                  }
                >
                  <Editor
                    key={sel.path}
                    markdown={content}
                    onChange={(md) => {
                      setContent(md);
                      setDirty(true);
                    }}
                  />
                </EditorBoundary>
              )}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground m-auto text-sm">Pick a document to edit.</div>
        )}
      </div>
    </div>
  );
}
