"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setState("sending");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-[1.6rem] tracking-tight">vchat</p>
        <p className="eyebrow mb-8 mt-1">your second brain</p>

        {state === "sent" ? (
          <div className="border-border bg-card rounded-xl border px-5 py-6 text-left">
            <p className="font-medium">Check your email</p>
            <p className="text-ink-soft mt-2 text-sm leading-relaxed">
              A sign-in link is on its way to <span className="font-medium">{email}</span>.
              Open it on this device and you&apos;ll land straight in the chat.
            </p>
          </div>
        ) : (
          <form onSubmit={sendLink} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border-border bg-card focus:border-primary w-full rounded-xl border px-4 py-3 text-center outline-none"
            />
            <button
              type="submit"
              disabled={state === "sending" || !email.trim()}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-3 font-medium disabled:opacity-40"
            >
              {state === "sending" ? "Sending link…" : "Email me a sign-in link"}
            </button>
            {state === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
            )}
            <p className="text-ink-soft mt-2 text-xs leading-relaxed">
              Invite-only. If your address isn&apos;t on the list, the link will sign you in
              but the brain will stay closed.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
