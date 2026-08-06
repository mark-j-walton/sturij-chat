"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  ArrowUp,
  Plus,
  History,
  Square,
  Copy,
  RotateCcw,
  Pencil,
  Flag,
  Download,
  X,
  Sparkles,
} from "lucide-react";

// V1b prompt suggestions — shown on the empty state; click to send.
const SUGGESTIONS = [
  "What did we decide about the product?",
  "Summarise the most recent meetings",
  "What's in the Document Library?",
  "Write up today's progress as a short report",
];

type Msg = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  interrupted?: boolean; // V1 stop & amend: reply was stopped mid-stream, kept and marked
};
type Session = { id: string; title: string; updated_at: string };
type Checkpoint = { index: number; at: Date };

export default function ChatPane() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [railOpen, setRailOpen] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [artifactBusy, setArtifactBusy] = useState(false);

  // Refs mirror state that streaming callbacks and queue-drain need fresh,
  // because those run inside closures captured before the state settled.
  const messagesRef = useRef<Msg[]>([]);
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

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
        setCheckpoint(null);
      }
    } catch {
      /* leave current thread untouched */
    }
  }

  function newChat() {
    setMessages([]);
    setSessionId(null);
    setRailOpen(false);
    setQueue([]);
    setCheckpoint(null);
  }

  // Core streaming turn: `next` already ends with the user message to answer.
  async function run(next: Msg[]) {
    busyRef.current = true;
    setMessages([...next, { role: "assistant", content: "", reasoning: "" }]);
    setLoading(true);

    const patchLast = (fn: (m: Msg) => Msg) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, session_id: sessionId }),
        signal: ac.signal,
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
      if (ac.signal.aborted) {
        // V1 stop & amend: keep the partial, mark it; the next send carries both.
        patchLast((m) => ({ ...m, interrupted: true }));
      } else {
        patchLast((m) => ({ ...m, content: `⚠️ ${String(e)}` }));
      }
    } finally {
      abortRef.current = null;
      busyRef.current = false;
      setLoading(false);
      refreshSessions();
      // V1 message queuing: drain in order once the stream ends.
      const nxt = queueRef.current[0];
      if (nxt !== undefined) {
        setQueue((q) => q.slice(1));
        setTimeout(() => send(nxt), 0);
      }
    }
  }

  function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text) return;
    if (busyRef.current) {
      // V1 message queuing: type while it answers; queued turns send in order.
      setQueue((q) => [...q, text]);
      setInput("");
      return;
    }
    setInput("");
    run([...messagesRef.current, { role: "user", content: text }]);
  }

  function stop() {
    abortRef.current?.abort();
  }

  // V1b artifacts: fire a standalone page from the conversation, styled by the
  // design contract. The tab opens synchronously (popup-blocker safe), then the
  // generated document is written into it.
  async function fireArtifact() {
    if (artifactBusy || busyRef.current || !messagesRef.current.length) return;
    const instruction = input.trim() || undefined;
    const tab = window.open("", "_blank");
    if (tab) tab.document.write("<title>Making your artifact…</title><p style='font-family:sans-serif;padding:2rem'>Making your artifact…</p>");
    setArtifactBusy(true);
    if (instruction) setInput("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "artifact", messages: messagesRef.current, instruction, session_id: sessionId }),
      });
      const j = await r.json();
      if (j && j.ok && j.html) {
        if (tab) { tab.document.open(); tab.document.write(j.html); tab.document.close(); }
        setMessages((m) => [...m, { role: "assistant", content: `✨ Artifact created: **${j.title}** — it opened in a new tab.` }]);
      } else {
        tab?.close();
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ Artifact failed: ${j?.error ?? r.statusText}` }]);
      }
    } catch (e) {
      tab?.close();
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ Artifact failed: ${String(e)}` }]);
    } finally {
      setArtifactBusy(false);
    }
  }

  // V1 message actions -------------------------------------------------------
  function copyMsg(i: number) {
    try {
      navigator.clipboard.writeText(messagesRef.current[i]?.content ?? "");
    } catch {
      /* clipboard is best-effort */
    }
  }
  function retry(i: number) {
    // Re-run the turn that produced assistant message i: history up to (and
    // including) the user message just before it.
    if (busyRef.current) return;
    const base = messagesRef.current.slice(0, i);
    if (!base.length || base[base.length - 1].role !== "user") return;
    setCheckpoint((c) => (c && c.index > i ? null : c));
    run(base);
  }
  function editResend(i: number) {
    // Load the user message into the input and rewind history to before it.
    if (busyRef.current) return;
    const m = messagesRef.current[i];
    if (!m || m.role !== "user") return;
    setInput(m.content);
    setMessages(messagesRef.current.slice(0, i));
    setCheckpoint((c) => (c && c.index > i ? null : c));
  }

  // V1 checkpoint → download -------------------------------------------------
  function stamp(d: Date) {
    return d.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function downloadCheckpoint() {
    if (!checkpoint) return;
    const now = new Date();
    const since = messagesRef.current.slice(checkpoint.index);
    const lines = [
      "# vchat — checkpoint download",
      "",
      `Checkpointed ${stamp(checkpoint.at)} · downloaded ${stamp(now)} · ${since.length} message${since.length === 1 ? "" : "s"}`,
      "",
      "---",
      "",
      ...since.flatMap((m) => [
        m.role === "user" ? "**You:**" : `**vchat:**${m.interrupted ? " *(stopped early)*" : ""}`,
        "",
        m.content,
        "",
      ]),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const p = (n: number) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `vchat-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const actionBtn =
    "hover:bg-secondary text-ink-soft hover:text-foreground flex h-6 w-6 items-center justify-center rounded";

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
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 pt-2">
          <button
            onClick={() => setRailOpen((v) => !v)}
            className="hover:bg-secondary flex h-8 w-8 items-center justify-center rounded-md md:hidden"
            aria-label="Conversation history"
          >
            <History className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          {/* V1 checkpoint → download: stamped marker, then Download + Cancel */}
          {checkpoint ? (
            <div className="border-border bg-card flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
              <Flag className="h-3 w-3 text-[var(--gold)]" />
              <span className="text-ink-soft">{stamp(checkpoint.at)}</span>
              <button
                onClick={downloadCheckpoint}
                className="hover:bg-secondary ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                title="Download the chat from this checkpoint as Markdown"
              >
                <Download className="h-3 w-3" /> Download
              </button>
              <button
                onClick={() => setCheckpoint(null)}
                className="hover:bg-secondary flex h-5 w-5 items-center justify-center rounded-full"
                aria-label="Cancel checkpoint"
                title="Cancel checkpoint"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCheckpoint({ index: messages.length, at: new Date() })}
              className="text-ink-soft hover:bg-secondary hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-xs"
              title="Mark this point — download everything after it as Markdown"
            >
              <Flag className="h-3 w-3" /> Checkpoint
            </button>
          )}
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
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="border-border bg-card text-ink-soft hover:bg-secondary hover:text-foreground rounded-full border px-3 py-1.5 text-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              if (m.role === "user") {
                return (
                  <Message key={i} className="group flex-col items-end gap-1">
                    <MessageContent className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl">
                      {m.content}
                    </MessageContent>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => copyMsg(i)} className={actionBtn} title="Copy">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => editResend(i)}
                        className={actionBtn}
                        title="Edit and resend — rewinds the chat to this point"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Message>
                );
              }
              const thinking = loading && isLast && m.content === "";
              return (
                <Message key={i} className="group w-full max-w-[85%] flex-col items-start gap-2">
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
                  {m.interrupted && (
                    <p className="text-ink-soft text-xs italic">
                      Stopped here — add what you missed and send; both stay in context.
                    </p>
                  )}
                  {!loading && (
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => copyMsg(i)} className={actionBtn} title="Copy">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => retry(i)}
                        className={actionBtn}
                        title="Retry — regenerate this answer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </Message>
              );
            })}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>
        </ChatContainerRoot>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          {/* V1 message queuing: what's waiting its turn */}
          {queue.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {queue.map((q, i) => (
                <span
                  key={i}
                  className="border-border bg-card text-ink-soft flex max-w-[16rem] items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                  title={q}
                >
                  <span className="truncate">{q}</span>
                  <button
                    onClick={() => setQueue((qs) => qs.filter((_, j) => j !== i))}
                    className="hover:text-foreground"
                    aria-label="Remove from queue"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <PromptInput value={input} onValueChange={setInput} onSubmit={() => send()} isLoading={loading}>
            <PromptInputTextarea
              placeholder={loading ? "Type the next message — it sends when this one finishes…" : "Message your brain…"}
            />
            <PromptInputActions className="justify-end pt-2">
              {loading ? (
                <>
                  {input.trim() && (
                    <PromptInputAction tooltip="Queue — sends when the current answer finishes">
                      <button
                        onClick={() => send()}
                        className="bg-secondary text-foreground flex h-9 w-9 items-center justify-center rounded-full"
                        aria-label="Queue message"
                      >
                        <ArrowUp className="h-5 w-5" />
                      </button>
                    </PromptInputAction>
                  )}
                  <PromptInputAction tooltip="Stop — keeps what's written; you can add to it and continue">
                    <button
                      onClick={stop}
                      className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-full"
                      aria-label="Stop"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  </PromptInputAction>
                </>
              ) : (
                <>
                  {messages.length > 0 && (
                    <PromptInputAction tooltip={artifactBusy ? "Making your artifact…" : "Artifact — turn this conversation into a finished page (type an instruction first to steer it)"}>
                      <button
                        onClick={fireArtifact}
                        disabled={artifactBusy}
                        className="bg-secondary text-foreground flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
                        aria-label="Create artifact"
                      >
                        <Sparkles className={`h-5 w-5 ${artifactBusy ? "animate-pulse" : ""}`} />
                      </button>
                    </PromptInputAction>
                  )}
                  <PromptInputAction tooltip="Send">
                    <button
                      onClick={() => send()}
                      disabled={!input.trim()}
                      className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
                      aria-label="Send"
                    >
                      <ArrowUp className="h-5 w-5" />
                    </button>
                  </PromptInputAction>
                </>
              )}
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
