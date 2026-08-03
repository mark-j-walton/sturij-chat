"use client";

import { useState } from "react";
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
import { ArrowUp } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; reasoning?: string };

export default function ChatPane() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ messages: next }),
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
            if (j.reasoning) {
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
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ChatContainerRoot className="relative flex-1 overflow-y-auto px-4 py-6">
        <ChatContainerContent className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {messages.length === 0 && (
            <div className="mx-auto mt-24 max-w-md text-center">
              <p className="eyebrow mb-3">ask your brain</p>
              <p className="text-ink-soft text-lg leading-relaxed">
                Answers stream in, grounded on what you&apos;ve stored — with the
                thinking shown as it works.
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
            // assistant
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
  );
}
