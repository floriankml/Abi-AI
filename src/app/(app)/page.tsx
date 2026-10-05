import Link from "next/link";
import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { aiStatus } from "@/server/ai";
import { counts, frequentErrors, progressOverview, studyMinutes, suggestions } from "@/server/services/progress";
import { recentSessions } from "@/server/services/sessions";
import { getSubject } from "@/server/services/subjects";
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, SubjectDot, buttonClass } from "@/components/ui";
import { formatDateTime, formatMinutes, pct } from "@/lib/format";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
}

export default async function DashboardPage() {
  await requireAuth();
  const ai = aiStatus();
  const c = counts();
  const overview = progressOverview();
  const todo = suggestions(3);
  const errors = frequentErrors(30, 5);
  const sessions = recentSessions(5);
  const week = studyMinutes(7);
  const needsSetup = !ai.configured || c.topics === 0 || c.materials === 0;

  return (
    <>
      <PageHeader title={greeting()} description="Was steht heute an?" />

      {needsSetup && (
        <Card className="mb-6 border-accent/30 bg-accent-soft/40">
          <CardTitle>Erste Schritte</CardTitle>
          <ol className="space-y-2 text-sm">
            <Step done={ai.configured} href="/einstellungen">
              KI-Anbieter einrichten (kostenlos möglich)
            </Step>
            <Step done={c.topics > 0} href="/faecher">
              Themen für deine Fächer anlegen
            </Step>
            <Step done={c.materials > 0} href="/materialien">
              Notizen und alte Abituraufgaben hochladen
            </Step>
            <Step done={c.attempts > 0} href="/lernen">
              Erste Lerneinheit starten
            </Step>
          </ol>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardTitle>
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" /> Vorschläge für heute
            </span>
          </CardTitle>
          {todo.length === 0 ? (
            <EmptyState title="Noch keine Themen">
              Lege unter <Link className="text-accent" href="/faecher">Fächer & Themen</Link> deine Themen an.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {todo.map((t) => (
                <li key={t.topicId} className="flex items-center gap-3 py-2.5">
                  <SubjectDot color={t.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.topicTitle}</p>
                    <p className="text-xs text-muted">
                      {t.subjectName} · {t.reason}
                    </p>
                  </div>
                  <Link
                    href={`/lernen?subject=${t.subjectId}&topic=${t.topicId}`}
                    className={buttonClass("secondary", "sm")}
                  >
                    Lernen <ArrowRight className="size-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-accent" /> Lernzeit
            </span>
          </CardTitle>
          <p className="text-3xl font-semibold tracking-tight">{formatMinutes(week)}</p>
          <p className="mt-1 text-sm text-muted">in den letzten 7 Tagen</p>
          <p className="mt-4 text-sm text-muted">Heute: {formatMinutes(studyMinutes(1))}</p>
        </Card>

        <Card className="md:col-span-2">
          <CardTitle action={<Link href="/fortschritt" className="text-xs text-accent">Details</Link>}>
            Fortschritt pro Fach
          </CardTitle>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {overview.map(({ subject, mastery, tasksDone }) => (
              <li key={subject.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <SubjectDot color={subject.color} />
                    {subject.name}
                    {subject.level && <span className="text-xs text-muted">{subject.level}</span>}
                  </span>
                  <span className="text-xs text-muted">
                    {tasksDone > 0 ? pct(mastery?.mastery) : "–"}
                  </span>
                </div>
                <ProgressBar value={mastery?.mastery ?? null} color={subject.color} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Häufige Fehler</CardTitle>
          {errors.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Fehler erfasst.</p>
          ) : (
            <ul className="space-y-2.5">
              {errors.map((e) => (
                <li key={`${e.subject}-${e.label}`} className="flex items-start gap-2 text-sm">
                  <SubjectDot color={e.color} />
                  <span className="-mt-1 min-w-0 flex-1">
                    {e.label}
                    <span className="block text-xs text-muted">{e.subject}</span>
                  </span>
                  <Badge tone={e.n > 1 ? "warning" : "neutral"}>{e.n}×</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="md:col-span-3">
          <CardTitle>Letzte Sitzungen</CardTitle>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Sitzungen.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((s) => {
                const subj = getSubject(s.subjectId);
                return (
                  <li key={s.id}>
                    <Link
                      href={s.mode === "learn" ? `/lernen/${s.id}` : `/ueben/${s.id}`}
                      className="flex items-center gap-3 py-2.5 text-sm hover:text-accent"
                    >
                      <SubjectDot color={subj?.color ?? "#999"} />
                      <span className="flex-1">
                        {subj?.name} · {s.mode === "learn" ? "Lernen" : "Üben"}
                      </span>
                      <span className="text-xs text-muted">{formatDateTime(s.startedAt)}</span>
                      {!s.endedAt && <Badge tone="accent">offen</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Step({ done, href, children }: { done: boolean; href: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex size-5 items-center justify-center rounded-full text-xs ${done ? "bg-success text-white" : "border border-border bg-surface"}`}
      >
        {done ? "✓" : ""}
      </span>
      <Link href={href} className={done ? "text-muted line-through" : "hover:text-accent"}>
        {children}
      </Link>
    </li>
  );
}
