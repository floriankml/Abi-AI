"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Square, Timer } from "lucide-react";
import { endSessionAction, nextLearnTaskAction } from "@/app/actions";
import { Alert, Button, cx } from "./ui";

export function NextQuestionButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await nextLearnTaskAction(sessionId);
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? "Erzeuge nächste Frage…" : "Nächste Frage"} <ArrowRight className="size-4" />
      </Button>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

export function EndSessionButton({ sessionId, mode }: { sessionId: string; mode: "learn" | "practice" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => start(() => endSessionAction(sessionId, mode))}
    >
      <Square className="size-3.5" /> Beenden
    </Button>
  );
}

/** Anzeige der Bearbeitungszeit (im Übungsmodus weich, ohne Sperre). */
export function SessionTimer({ startedAt, limitMin }: { startedAt: string; limitMin: number | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Erst nach dem Mounten ticken (vermeidet Hydration-Unterschiede).
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const remaining = limitMin ? limitMin * 60 - elapsed : null;
  const shown = remaining ?? elapsed;
  const abs = Math.abs(shown);
  const mm = String(Math.floor(abs / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  const over = remaining !== null && remaining < 0;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-sm tabular-nums",
        over ? "bg-danger-soft text-danger" : remaining !== null && remaining < 300 ? "bg-warning-soft text-warning" : "bg-surface-2",
      )}
    >
      <Timer className="size-4" />
      {over ? "+" : ""}
      {mm}:{ss}
      {over && <span className="font-sans text-xs">Zeit abgelaufen</span>}
    </span>
  );
}
