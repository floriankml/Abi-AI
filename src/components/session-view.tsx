import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionView } from "@/server/services/sessions";
import type { PracticeState } from "@/server/db/schema";
import { percentToNotenpunkte } from "@/server/domain/grading";
import { TaskRunner } from "./task-runner";
import { EndSessionButton, NextQuestionButton, SessionTimer } from "./session-controls";
import { Badge, Card, PageHeader, SubjectDot, buttonClass } from "./ui";

/** Gemeinsame Ansicht für Lern- und Übungssitzungen. */
export async function SessionView({ sessionId, mode }: { sessionId: string; mode: "learn" | "practice" }) {
  const view = await getSessionView(sessionId);
  if (!view || view.session.mode !== mode) notFound();
  const { session, subject, topicPath, items, current } = view;
  const ended = !!session.endedAt;
  const done = items.filter((i) => i.status === "done");
  const totalPoints = items.reduce((s, i) => s + i.maxPoints, 0);
  const earned = items.reduce((s, i) => s + (i.attempts.at(-1)?.score ?? 0), 0);
  const practiceState = mode === "practice" ? (session.state as PracticeState) : null;
  const allDone = items.length > 0 && done.length === items.length;
  const base = mode === "learn" ? "/lernen" : "/ueben";
  // Immer nur eine Aufgabe gleichzeitig: erledigte + aktuelle zeigen.
  const visible = ended ? items : items.filter((i) => i.status === "done" || i.id === current?.id);
  const upcoming = items.length - visible.length;
  // Die zuletzt erledigte Aufgabe offen lassen (frisches Feedback), ältere einklappen.
  const lastDone = done.at(-1);
  const lastDoneId = lastDone?.id;
  // Nach einer nicht gelösten Aufgabe erst zur Erklärung scrollen, sonst zur neuen Frage.
  const lastDoneMissed = !!lastDone && lastDone.attempts.at(-1)?.evaluation.verdict !== "correct";
  const focusId = lastDoneMissed ? lastDoneId : (current?.id ?? lastDoneId);

  return (
    <>
      <PageHeader
        title={mode === "learn" ? "Lernen" : "Üben"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <SubjectDot color={subject.color} /> {subject.name}
            {topicPath.length > 0 && <span>· {topicPath.join(" → ")}</span>}
            {ended && <Badge>beendet</Badge>}
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {mode === "practice" && !ended && !allDone && (
              <SessionTimer startedAt={session.startedAt} limitMin={practiceState?.timeLimitMin ?? null} />
            )}
            {!ended && <EndSessionButton sessionId={session.id} mode={mode} />}
          </div>
        }
      />

      <div className="space-y-4">
        {visible.map((item) => (
          <TaskRunner
            key={item.id}
            item={item}
            index={item.position}
            total={mode === "practice" ? items.length : undefined}
            sessionId={session.id}
            mode={mode}
            readOnly={ended}
            collapsed={item.status === "done" && item.id !== lastDoneId && !ended}
            autoFocus={!ended && item.id === focusId}
          />
        ))}
      </div>
      {upcoming > 0 && (
        <p className="mt-3 text-center text-xs text-muted">
          noch {upcoming} {upcoming === 1 ? "Aufgabe" : "Aufgaben"} danach
        </p>
      )}

      {!ended && mode === "learn" && !current && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {done.length} {done.length === 1 ? "Frage" : "Fragen"} bearbeitet. Weiter mit der nächsten?
          </p>
          <NextQuestionButton sessionId={session.id} />
        </Card>
      )}

      {(allDone || ended) && items.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-2 font-semibold">Zusammenfassung</h2>
          <p className="text-sm">
            {done.length} von {items.length} Aufgaben abgeschlossen ·{" "}
            <span className="font-medium">
              {Math.round(earned * 10) / 10} / {totalPoints} Punkte
            </span>
            {mode === "practice" && totalPoints > 0 && (
              <span className="text-muted">
                {" "}
                · entspricht ca. {percentToNotenpunkte((earned / totalPoints) * 100)} Notenpunkten (grobe Orientierung)
              </span>
            )}
          </p>
          <div className="mt-4 flex gap-2">
            <Link href={base} className={buttonClass("secondary")}>
              Neue Sitzung
            </Link>
            <Link href="/fortschritt" className={buttonClass("ghost")}>
              Fortschritt ansehen
            </Link>
          </div>
        </Card>
      )}
    </>
  );
}
