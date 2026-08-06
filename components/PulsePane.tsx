"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// S12 the Fold: the platform's pulse, inside the one door. Everything shown is
// MEASURED live by the steward — never asserted. The old status/agent-audit
// pages fold into this pane.

type Pulse = {
  metrics: Record<string, number>;
  audit: { consumer: string; tool: string; allowed: boolean; created_at: string }[];
  latest_programme: { id: string; title: string; created_at: string } | null;
};

const TILE_LABELS: [string, string][] = [
  ["intake_backlog", "Intake backlog"],
  ["curated_7d", "Curated · 7d"],
  ["misfits_open", "Misfits open"],
  ["issues_open", "Issues open"],
  ["godkey_calls_7d", "God-key calls · 7d"],
  ["audit_denied_7d", "Denied calls · 7d"],
  ["sessions_7d", "Active sessions · 7d"],
  ["skills_active", "Skills active"],
  ["skills_proposed", "Skills proposed"],
  ["thoughts_active", "Thoughts active"],
  ["nodes_total", "Graph nodes"],
];

export default function PulsePane() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/pulse");
      const j = await r.json();
      if (j && j.metrics) setPulse(j);
      else setErr(j?.error ?? "no data");
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  const m = pulse?.metrics ?? {};
  const grounded =
    (m.assistant_7d ?? 0) > 0 ? Math.round(((m.grounded_7d ?? 0) / m.assistant_7d) * 100) : null;

  return (
    <div className="h-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">the pulse</p>
            <p className="text-ink-soft text-sm">
              Measured live by the Steward — never asserted. God-key at zero is the healthy state.
            </p>
          </div>
          <button
            onClick={refresh}
            className="hover:bg-secondary text-ink-soft hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {err && <p className="text-sm text-red-500">⚠️ {err}</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {grounded !== null && (
            <div className="border-border bg-card rounded-xl border p-3">
              <div className="text-2xl font-semibold tabular-nums">{grounded}%</div>
              <div className="text-ink-soft text-xs">Grounded answers · 7d</div>
            </div>
          )}
          {TILE_LABELS.map(([k, label]) => {
            const v = m[k];
            if (v === undefined) return null;
            const bad =
              (k === "godkey_calls_7d" && v > 0) || (k === "audit_denied_7d" && v > 0) || v === -1;
            return (
              <div key={k} className="border-border bg-card rounded-xl border p-3">
                <div className={`text-2xl font-semibold tabular-nums ${bad ? "text-amber-600" : ""}`}>
                  {v === -1 ? "?" : v}
                </div>
                <div className="text-ink-soft text-xs">
                  {label}
                  {v === -1 ? " · probe failed" : ""}
                </div>
              </div>
            );
          })}
        </div>

        {pulse?.latest_programme && (
          <div className="border-border bg-card rounded-xl border p-4 text-sm">
            <p className="eyebrow mb-1">latest programme of opportunity</p>
            <p>{pulse.latest_programme.title}</p>
            <p className="text-ink-soft mt-1 text-xs">
              {new Date(pulse.latest_programme.created_at).toLocaleString()} · full text in the intake
              inbox
            </p>
          </div>
        )}

        <div>
          <p className="eyebrow mb-2">audit trail — who did what, most recent first</p>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-border text-ink-soft border-b text-left text-xs">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Consumer</th>
                  <th className="px-3 py-2 font-medium">Tool</th>
                  <th className="px-3 py-2 font-medium">Allowed</th>
                </tr>
              </thead>
              <tbody>
                {(pulse?.audit ?? []).map((a, i) => (
                  <tr key={i} className="border-border border-b last:border-0">
                    <td className="text-ink-soft whitespace-nowrap px-3 py-1.5 text-xs">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-1.5">{a.consumer}</td>
                    <td className="px-3 py-1.5">{a.tool}</td>
                    <td className="px-3 py-1.5">{a.allowed ? "✓" : "✗ denied"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
