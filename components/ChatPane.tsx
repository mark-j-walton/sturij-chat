"use client";

import { useState } from "react";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { Message, MessageContent } from "@/components/ui/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { TypingLoader } from "@/components/ui/loader";
import { ArrowUp } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPane() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

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
            if (j.delta) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: copy[copy.length - 1].content + j.delta,
                };
                return copy;
              });
            } else if (j.error) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${j.error}` };
                return copy;
              });
            }
          } catch {
            /* keepalive */
          }
        }
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${String(e)}` };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ChatContainerRoot className="relative flex-1 overflow-y-auto px-4 py-6">
        <ChatContainerContent className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {messages.length === 0 && (
            <div className="text-muted-foreground mx-auto mt-24 max-w-md text-center text-sm">
              Ask your brain anything. Answers stream in, grounded on what you&apos;ve stored.
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <Message key={i} className="justify-end">
                <MessageContent className="bg-primary text-primary-foreground max-w-[80%]">
                  {m.content}
                </MessageContent>
              </Message>
            ) : (
              <Message key={i} className="justify-start">
                <MessageContent
                  markdown
                  className="bg-secondary text-foreground max-w-[80%]"
                >
                  {m.content || (loading && i === messages.length - 1 ? "…" : "")}
                </MessageContent>
              </Message>
            )
          )}
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
