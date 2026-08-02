"use client";

import { useState } from "react";
import ChatPane from "@/components/ChatPane";
import DocsPane from "@/components/DocsPane";

export default function Home() {
  const [tab, setTab] = useState<"chat" | "docs">("chat");
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="font-semibold">
          vchat <span className="text-muted-foreground font-normal">· your brain</span>
        </div>
        <nav className="bg-muted flex gap-1 rounded-lg p-1 text-sm">
          {(["chat", "docs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 capitalize ${
                tab === t ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>
      <main className="min-h-0 flex-1">{tab === "chat" ? <ChatPane /> : <DocsPane />}</main>
    </div>
  );
}
