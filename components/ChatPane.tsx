"use client";

import { useEffect, useState } from "react";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { Message, MessageContent } from "@/components/ui/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ui/reasoning";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { TypingLoader } from "@/components/ui/loader";
import { ArrowUp, Plus, History } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; reasoning?: string };
type Session = { id: string; title: string; updated_at: string };

export default function ChatPane() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [railOpen, setRailOpen] = useState(false);

  async function refreshSessions() {
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "sessions" }),
      });
      const j = await r.json();
      if (Array.isArray(j.sessions)) setSessions(j.sessions);
    } catch {
      /* rail is best-effort */
    }
  }
  useEffect(() => {
    refreshSessions();
  }, []);

  async function openSession(id: string) {
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "history", session_id: id }),
      });
      const j = await r.json();
      if (Array.isArray(j.messages)) {
        setMessages(
          j.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            reasoning: m.meta?.reasoning || undefined,
          }))
        );
        setSessionId(id);
        setRailOpen(false);
      }
    } catch {
      /* leave current thread untouched */
    }
  }

  function newChat() {
    setMessages([]);
    setSessionId(null);
    setRailOpen(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "", reasoning: "" }]);
    setInput("");
    setLoading(true);

    const patchLast = (fn: (m: Msg) => Msg) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, session_id: sessionId }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const line = ev.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            if (j.session_id) {
              setSessionId(j.session_id);
            } else if (j.reasoning) {
              patchLast((m) => ({ ...m, reasoning: (m.reasoning ?? "") + j.reasoning }));
            } else if (j.delta) {
              patchLast((m) => ({ ...m, content: m.content + j.delta }));
            } else if (j.error) {
              patchLast((m) => ({ ...m, content: `⚠️ ${j.error}` }));
            }
          } catch {
            /* keepalive */
          }
        }
      }
    } catch (e) {
      patchLast((m) => ({ ...m, content: `⚠️ ${String(e)}` }));
    } finally {
      setLoading(false);
      refreshSessions();
    }
  }

  const rail = (
    <div className="border-border flex h-full w-64 flex-col border-r">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="eyebrow">Conversations</span>
        <button
          onClick={newChat}
          className="hover:bg-secondary flex h-7 w-7 items-center justify-center rounded-md"
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 && (
          <div className="text-ink-soft px-2 py-4 text-xs">
            Nothing yet — every chat you have here is kept, and picks up where it left off.
          </div>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => openSession(s.id)}
            className={`hover:bg-secondary block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
              s.id === sessionId ? "bg-secondary" : ""
            }`}
            title={s.title}
          >
            {s.title || "Chat"}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <div className="hidden md:block">{rail}</div>
      {railOpen && (
        <div className="bg-background absolute inset-0 z-20 md:hidden">{rail}</div>
      )}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-4 pt-2 md:hidden">
          <button
            onClick={() => setRailOpen((v) => !v)}
            className="hover:bg-secondary flex h-8 w-8 items-center justify-center rounded-md"
            aria-label="Conversation history"
          >
            <History className="h-4 w-4" />
          </button>
        </div>
        <ChatContainerRoot className="relative flex-1 overflow-y-auto px-4 py-6">
          <ChatContainerContent className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {messages.length === 0 && (
              <div className="mx-auto mt-24 max-w-md text-center">
                <p className="eyebrow mb-3">ask your brain</p>
                <p className="text-ink-soft text-lg leading-relaxed">
                  Answers stream in, grounded on what you&apos;ve stored — with the
                  thinking shown as it works, and every conversation kept.
                </p>
              </div>
            )}
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              if (m.role === "user") {
                return (
                  <Message key={i} className="justify-end">
                    <MessageContent className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl">
                      {m.content}
                    </MessageContent>
                  </Message>
                );
              }
              const thinking = loading && isLast && m.content === "";
              return (
                <Message key={i} className="w-full max-w-[85%] flex-col items-start gap-2">
                  {m.reasoning ? (
                    <Reasoning
                      isStreaming={thinking}
                      className="border-border bg-card w-full rounded-xl border border-l-2 border-l-[var(--gold)] px-3 py-2"
                    >
                      <ReasoningTrigger className="eyebrow !text-[var(--gold)]">
                        {thinking ? "Thinking…" : "Thought process"}
                      </ReasoningTrigger>
                      <ReasoningContent
                        markdown
                        className="mt-2"
                        contentClassName="text-ink-soft text-sm leading-relaxed"
                      >
                        {m.reasoning}
                      </ReasoningContent>
                    </Reasoning>
                  ) : null}
                  <MessageContent
                    markdown
                    className="bg-secondary text-foreground w-full rounded-2xl rounded-tl-sm border-l-2 border-l-[var(--claret)]"
                  >
                    {m.content || (thinking ? "…" : "")}
                  </MessageContent>
                </Message>
              );
            })}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>
        </ChatContainerRoot>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <PromptInput value={input} onValueChange={setInput} onSubmit={send} isLoading={loading}>
            <PromptInputTextarea placeholder="Message your brain…" />
            <PromptInputActions className="justify-end pt-2">
              {loading ? (
                <TypingLoader />
              ) : (
                <PromptInputAction tooltip="Send">
                  <button
                    onClick={send}
                    disabled={!input.trim()}
                    className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
                    aria-label="Send"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                </PromptInputAction>
              )}
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
