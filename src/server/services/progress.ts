import { queryAll } from "../db/client";
import { computeMastery, type Mastery } from "../domain/mastery";
import { listAllTopics, listSubjects, subtreeIdsFrom, topicSubtreeIds } from "./subjects";

/** Hinweise mindern das Ergebnis etwas – geholfen ist nicht ganz selbst gewusst. */
const HINT_PENALTY = 0.15;

type Result = { subjectId: string; topicId: string | null; ratio: number; at: Date };

/**
 * Endergebnis je bearbeiteter Aufgabe (letzter Versuch zählt). So zählen
 * mehrere Fehlversuche einer Aufgabe nicht mehrfach.
 */
async function finalResults(subjectId?: string): Promise<Result[]> {
  const rows = await queryAll<{
    subject_id: string;
    topic_id: string | null;
    score: number;
    max_score: number;
    hints_used: number;
    created_at: string;
  }>(
    `SELECT t.subject_id, t.topic_id, a.score, a.max_score, a.hints_used, a.created_at
     FROM attempts a
     JOIN tasks t ON t.id = a.task_id
     WHERE a.id IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(session_task_id, id) ORDER BY created_at DESC) AS rn
         FROM attempts
       ) WHERE rn = 1
     ) ${subjectId ? "AND t.subject_id = ?" : ""}`,
    subjectId ? [subjectId] : [],
  );
  return rows.map((r) => ({
    subjectId: r.subject_id,
    topicId: r.topic_id,
    ratio:
      (r.max_score > 0 ? r.score / r.max_score : 0) *
      Math.max(0.4, 1 - HINT_PENALTY * r.hints_used),
    at: new Date(r.created_at),
  }));
}

export async function topicMastery(subjectId: string, topicId: string | null): Promise<Mastery | null> {
  const ids = topicId ? new Set(await topicSubtreeIds(subjectId, topicId)) : null;
  const relevant = (await finalResults(subjectId)).filter(
    (r) => !ids || (r.topicId !== null && ids.has(r.topicId)),
  );
  return computeMastery(relevant, new Date());
}

export type ProgressOverview = Awaited<ReturnType<typeof progressOverview>>;

export async function progressOverview() {
  const now = new Date();
  const [results, subjects, allTopics] = await Promise.all([finalResults(), listSubjects(), listAllTopics()]);
  return subjects.map((subject) => {
    const own = results.filter((r) => r.subjectId === subject.id);
    const subjectTopics = allTopics.filter((t) => t.subjectId === subject.id);
    const topics = subjectTopics.map((t) => {
      const ids = new Set(subtreeIdsFrom(subjectTopics, t.id));
      return {
        topic: t,
        mastery: computeMastery(
          own.filter((r) => r.topicId !== null && ids.has(r.topicId)),
          now,
        ),
      };
    });
    return { subject, mastery: computeMastery(own, now), tasksDone: own.length, topics };
  });
}

export async function studyMinutes(days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await queryAll<{ s: number | null }>(
    "SELECT COALESCE(SUM(duration_s), 0) AS s FROM attempts WHERE created_at >= ?",
    [since],
  );
  return Math.round(Number(rows[0]?.s ?? 0) / 60);
}

/**
 * Einfache Vorschläge fürs Dashboard (Vorstufe der Tagesplanung aus Phase 3):
 * schwach beherrschte oder noch nie geübte, prüfungsrelevante Themen.
 */
export function suggestions(overview: ProgressOverview, limit = 3) {
  const out: {
    subjectId: string;
    subjectName: string;
    color: string;
    topicId: string;
    topicTitle: string;
    reason: string;
    priority: number;
  }[] = [];
  const now = Date.now();
  for (const { subject, topics } of overview) {
    for (const { topic, mastery } of topics) {
      const weight = 1 + topic.examWeight;
      let priority: number;
      let reason: string;
      if (!mastery) {
        priority = 0.5 * weight;
        reason = "noch nicht geübt";
      } else {
        const staleDays = (now - mastery.lastAt.getTime()) / 86_400_000;
        priority = (1 - mastery.mastery) * weight + Math.min(1, staleDays / 14) * 0.3;
        reason =
          mastery.mastery < 0.5
            ? `Beherrschung ${Math.round(mastery.mastery * 100)} %`
            : staleDays > 7
              ? `seit ${Math.round(staleDays)} Tagen nicht geübt`
              : "festigen";
      }
      out.push({
        subjectId: subject.id,
        subjectName: subject.name,
        color: subject.color,
        topicId: topic.id,
        topicTitle: topic.title,
        reason,
        priority,
      });
    }
  }
  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

/** Häufigste Fehlerbilder der letzten Tage (Vorstufe der Fehlerdatenbank). */
export async function frequentErrors(days = 30, limit = 5) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return queryAll<{ label: string; subject: string; color: string; n: number; last_at: string }>(
    `SELECT json_extract(e.value, '$.label') AS label, s.name AS subject, s.color AS color,
            COUNT(*) AS n, MAX(a.created_at) AS last_at
     FROM attempts a, json_each(a.evaluation, '$.errors') e
     JOIN tasks t ON t.id = a.task_id
     JOIN subjects s ON s.id = t.subject_id
     WHERE a.created_at >= ?
     GROUP BY lower(label), s.id
     ORDER BY n DESC, last_at DESC
     LIMIT ?`,
    [since, limit],
  );
}

export async function counts() {
  const rows = await queryAll<{ topics: number; materials: number; attempts: number }>(
    `SELECT (SELECT COUNT(*) FROM topics) AS topics,
            (SELECT COUNT(*) FROM materials) AS materials,
            (SELECT COUNT(*) FROM attempts) AS attempts`,
  );
  return rows[0];
}
