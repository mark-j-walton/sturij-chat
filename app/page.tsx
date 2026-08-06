"use client";

import { useState } from "react";
import ChatPane from "@/components/ChatPane";
import DocsPane from "@/components/DocsPane";
import PulsePane from "@/components/PulsePane";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const [tab, setTab] = useState<"chat" | "docs" | "pulse">("chat");
  return (
    <div className="flex h-screen flex-col">
      <header className="border-border flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[1.35rem] leading-none tracking-tight">vchat</span>
          <span className="eyebrow hidden sm:inline">your second brain</span>
        </div>
        <div className="flex items-center gap-3">
          <nav className="border-border flex gap-1 rounded-full border p-1 text-sm">
            {(["chat", "docs", "pulse"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1 capitalize transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-ink-soft hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <ThemeToggle />
          <button
            onClick={async () => {
              await fetch("/logout", { method: "POST" });
              location.href = "/login";
            }}
            className="text-ink-soft hover:text-foreground text-sm"
            title="Sign out"
          >
            sign out
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        {tab === "chat" ? <ChatPane /> : tab === "docs" ? <DocsPane /> : <PulsePane />}
      </main>
    </div>
  );
}
