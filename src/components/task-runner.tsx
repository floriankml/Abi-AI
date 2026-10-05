"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookMarked, Eye, Lightbulb, Send, SkipForward } from "lucide-react";
import {
  finishTaskAction,
  hintAction,
  revealSolutionAction,
  submitAnswerAction,
  type ActionState,
} from "@/app/actions";
import type { AttemptView, SessionTaskView } from "@/server/services/sessions";
import { Markdown } from "./markdown";
import { Alert, Badge, Button, cx, inputClass } from "./ui";

type Ref = { sessionId: string; sessionTaskId: string; mode: "learn" | "practice" };

const PURPOSE_LABEL: Record<SessionTaskView["purpose"], string> = {
  diagnose: "Einstieg",
  learn: "Verständnisfrage",
  check: "Kontrollfrage",
  practice: "Aufgabe",
};

const VERDICT: Record<string, { label: string; tone: "success" | "warning" | "danger" | "accent" }> = {
  correct: { label: "Richtig", tone: "success" },
  partial: { label: "Teilweise richtig", tone: "warning" },
  incorrect: { label: "Noch nicht richtig", tone: "danger" },
  unclear: { label: "Rückfrage", tone: "accent" },
};

export function TaskRunner({
  item,
  index,
  total,
  sessionId,
  mode,
  readOnly = false,
  collapsed = false,
  autoFocus = false,
}: {
  item: SessionTaskView;
  index: number;
  total?: number;
  sessionId: string;
  mode: "learn" | "practice";
  readOnly?: boolean;
  /** Erledigte Aufgaben eingeklappt zeigen, damit die aktive im Fokus bleibt. */
  collapsed?: boolean;
  autoFocus?: boolean;
}) {
  const ref: Ref = { sessionId, sessionTaskId: item.id, mode };
  const [answer, setAnswer] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingLabel, setPendingLabel] = useState("");
  const shownAt = useRef(0);
  const articleRef = useRef<HTMLElement>(null);
  const open = item.status === "open" && !readOnly;
  const lastVerdict = item.attempts.at(-1)?.evaluation.verdict;

  useEffect(() => {
    if (autoFocus) articleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [autoFocus]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [item.id, item.attempts.length]);

  function run(label: string, fn: () => Promise<ActionState>, after?: () => void) {
    setError(null);
    setPendingLabel(label);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else after?.();
    });
  }

  function submit(giveUp: boolean) {
    const durationS = (Date.now() - shownAt.current) / 1000;
    run(giveUp ? "Speichere…" : "Bewerte deine Antwort…", () =>
      submitAnswerAction(ref, { answer: giveUp ? "" : answer, durationS, giveUp }),
      () => setAnswer(""),
    );
  }

  return (
    <article
      ref={articleRef}
      className={cx("scroll-mt-4 rounded-xl border bg-surface", open ? "border-accent/40 shadow-sm" : "border-border")}
    >
      <details open={!collapsed} className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 border-border px-5 py-3 text-xs text-muted group-open:border-b">
        <span className="font-medium text-text">
          {total ? `Aufgabe ${index + 1} von ${total}` : `#${index + 1}`}
        </span>
        <Badge>{PURPOSE_LABEL[item.purpose]}</Badge>
        <span>Stufe {item.difficulty}/5</span>
        <span>· {item.maxPoints} P.</span>
        {item.status === "done" && lastVerdict && (
          <Badge tone={VERDICT[lastVerdict].tone}>{VERDICT[lastVerdict].label}</Badge>
        )}
        {collapsed && (
          <span className="min-w-0 flex-1 truncate text-text group-open:hidden">{firstLine(item.prompt)}</span>
        )}
        <span className="ml-auto">
          <SourceBadge item={item} />
        </span>
      </summary>

      <div className="space-y-4 px-5 py-4">
        <Markdown>{item.prompt}</Markdown>

        {item.attempts.map((a, i) => (
          <AttemptBlock key={i} attempt={a} />
        ))}

        {item.hints.map((h, i) => (
          <div key={i} className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <span className="font-medium text-warning">Hinweis {i + 1}: </span>
              <Markdown className="inline">{h}</Markdown>
            </div>
          </div>
        ))}

        {item.explanation && (
          <div className="rounded-lg bg-accent-soft px-4 py-3 text-sm">
            <p className="mb-1 font-medium text-accent">Erklärung</p>
            <Markdown>{item.explanation}</Markdown>
          </div>
        )}

        {item.solution && (
          <details className="rounded-lg border border-border px-4 py-3 text-sm" open={!readOnly}>
            <summary className="cursor-pointer font-medium">
              <BookMarked className="mr-1 inline size-4" /> Musterlösung
            </summary>
            <div className="mt-2">
              <Markdown>{item.solution}</Markdown>
            </div>
          </details>
        )}

        {open && (
          <div className="space-y-3">
            {preview ? (
              <div className="min-h-28 rounded-lg border border-border px-3 py-2 text-sm">
                <Markdown>{answer || "_(leer)_"}</Markdown>
              </div>
            ) : (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={item.type === "essay" ? 12 : item.type === "short" ? 4 : 7}
                placeholder={
                  item.attempts.length
                    ? "Neuer Versuch …"
                    : "Deine Antwort – mit Lösungsweg. Formeln z. B. $\\vec{a} \\cdot \\vec{b} = 0$"
                }
                className={inputClass}
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && answer.trim()) submit(false);
                }}
              />
            )}
            {error && <Alert>{error}</Alert>}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => submit(false)} disabled={pending || !answer.trim()}>
                <Send className="size-4" /> Antwort abgeben
              </Button>
              {item.attempts.length === 0 && (
                <Button variant="ghost" onClick={() => submit(true)} disabled={pending}>
                  Weiß ich nicht
                </Button>
              )}
              {item.canHint && (
                <Button variant="secondary" onClick={() => run("Lade Hinweis…", () => hintAction(ref))} disabled={pending}>
                  <Lightbulb className="size-4" /> Hinweis {item.hints.length + 1}/{item.hintsTotal}
                </Button>
              )}
              {item.canRevealSolution && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    run(mode === "learn" ? "Erstelle Erklärung…" : "Lade Lösung…", () => revealSolutionAction(ref))
                  }
                  disabled={pending}
                >
                  <Eye className="size-4" /> Lösung {mode === "learn" ? "& Erklärung" : ""} zeigen
                </Button>
              )}
              {item.canFinish && (
                <Button variant="ghost" onClick={() => run("Speichere…", () => finishTaskAction(ref))} disabled={pending}>
                  <SkipForward className="size-4" /> Abschließen
                </Button>
              )}
              <button type="button" onClick={() => setPreview((p) => !p)} className="ml-auto text-xs text-muted hover:text-text">
                {preview ? "Bearbeiten" : "Vorschau"}
              </button>
            </div>
            {pending && <p className="animate-pulse text-sm text-muted">{pendingLabel}</p>}
            {item.attempts.length > 0 && !item.canHint && !item.canRevealSolution && !item.canFinish && (
              <p className="text-xs text-muted">Versuch es noch einmal – danach wird die Lösung freigeschaltet.</p>
            )}
          </div>
        )}
      </div>
      </details>
    </article>
  );
}

function AttemptBlock({ attempt }: { attempt: AttemptView }) {
  const v = VERDICT[attempt.evaluation.verdict];
  return (
    <div className="space-y-2 rounded-lg border border-border bg-bg/50 px-4 py-3 text-sm">
      <div className="text-muted">
        <span className="text-xs uppercase tracking-wide">Deine Antwort</span>
        <div className="mt-1 text-text">
          {attempt.answer ? <Markdown>{attempt.answer}</Markdown> : <em>(weiß ich nicht)</em>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <Badge tone={v.tone}>{v.label}</Badge>
        {attempt.answer && (
          <span className="text-xs text-muted">
            {formatPoints(attempt.score)} / {attempt.maxScore} P.
          </span>
        )}
        {attempt.answer && attempt.confidence < 0.6 && (
          <span className="text-xs text-warning">Bewertung unsicher – prüfe selbst kritisch.</span>
        )}
      </div>
      <Markdown>{attempt.evaluation.feedbackMd}</Markdown>
      {attempt.evaluation.clarifyingQuestion && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-accent">
          <span className="font-medium">Rückfrage: </span>
          {attempt.evaluation.clarifyingQuestion}
        </p>
      )}
      {attempt.evaluation.errors.length > 0 && (
        <ul className="space-y-1">
          {attempt.evaluation.errors.map((e, i) => (
            <li key={i} className="text-xs">
              <Badge tone="danger">{e.category}</Badge> <span className="font-medium">{e.label}</span>
              {e.description && <span className="text-muted"> – {e.description}</span>}
            </li>
          ))}
        </ul>
      )}
      {attempt.evaluation.dimensions.length > 0 && (
        <div className="grid gap-2 pt-1 sm:grid-cols-2">
          {attempt.evaluation.dimensions.map((d) => (
            <div key={d.name} className="text-xs">
              <div className="flex justify-between">
                <span className="font-medium">{d.name}</span>
                <span className="text-muted">{Math.round(d.score * 100)} %</span>
              </div>
              {d.comment && <p className="text-muted">{d.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ item }: { item: SessionTaskView }) {
  if (item.basis === "general" || item.sources.length === 0) {
    return <Badge>Allgemeinwissen</Badge>;
  }
  const titles = [...new Set(item.sources.map((s) => (s.page ? `${s.title}, S. ${s.page}` : s.title)))];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone="accent">{item.basis === "mixed" ? "Materialien + Allgemeinwissen" : "aus deinen Materialien"}</Badge>
      <span className="hidden text-muted sm:inline" title={titles.join("; ")}>
        {titles.slice(0, 2).join("; ")}
        {titles.length > 2 && " …"}
      </span>
    </span>
  );
}

function firstLine(md: string) {
  return md.replace(/[#*_$`>]/g, "").split("\n").find((l) => l.trim())?.slice(0, 120) ?? "";
}

function formatPoints(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
