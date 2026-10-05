import Link from "next/link";
import { progressOverview, studyMinutes } from "@/server/services/progress";
import { Card, EmptyState, PageHeader, ProgressBar, SubjectDot } from "@/components/ui";
import { formatDate, formatMinutes, pct } from "@/lib/format";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Fortschritt" };

export default async function ProgressPage() {
  await requireAuth();
  const overview = progressOverview();
  const anything = overview.some((o) => o.tasksDone > 0);
  return (
    <>
      <PageHeader
        title="Fortschritt"
        description={`Lernzeit: ${formatMinutes(studyMinutes(7))} in 7 Tagen · ${formatMinutes(studyMinutes(30))} in 30 Tagen`}
      />
      {!anything && (
        <div className="mb-4">
          <EmptyState title="Noch keine Ergebnisse">
            Sobald du lernst oder übst, siehst du hier, wie sicher du in jedem Thema bist.
          </EmptyState>
        </div>
      )}
      <p className="mb-4 text-xs text-muted">
        Beherrschung = gewichtetes Ergebnis deiner letzten Antworten (neuere zählen mehr, Hinweise mindern etwas,
        lange nicht geübt sinkt). Blasse Werte beruhen auf wenigen Antworten.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {overview.map(({ subject, mastery, tasksDone, topics }) => (
          <Card key={subject.id}>
            <div className="mb-3 flex items-center gap-2">
              <SubjectDot color={subject.color} />
              <Link href={`/faecher/${subject.id}`} className="font-semibold hover:text-accent">
                {subject.name}
              </Link>
              <span className="ml-auto text-sm text-muted">{tasksDone > 0 ? pct(mastery?.mastery) : "–"}</span>
            </div>
            <ProgressBar value={mastery?.mastery ?? null} color={subject.color} />
            <p className="mt-2 text-xs text-muted">
              {tasksDone} Aufgaben{mastery && ` · zuletzt ${formatDate(mastery.lastAt)}`}
            </p>
            {topics.length > 0 && (
              <ul className="mt-4 space-y-2">
                {topics.map(({ topic, mastery: m }) => (
                  <li key={topic.id} className="text-sm" style={{ opacity: m ? 0.45 + 0.55 * m.confidence : 0.6 }}>
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="truncate">{topic.title}</span>
                      <span className="shrink-0 text-xs text-muted">{m ? pct(m.mastery) : "nicht geübt"}</span>
                    </div>
                    <ProgressBar value={m?.mastery ?? null} color={subject.color} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
