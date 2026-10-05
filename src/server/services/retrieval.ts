import { getDb } from "../db/client";
import type { Snippet } from "../ai/prompts";
import type { SourceRef } from "../db/schema";

type Row = {
  chunk_id: string;
  material_id: string;
  text: string;
  page: number | null;
  title: string;
  category: string;
  topic_id: string | null;
};

export type RetrievedSnippet = Snippet & { source: SourceRef };

const STOPWORDS = new Set(
  "und oder der die das ein eine einer eines dem den des mit von zu zur zum im in ist sind auf für bei wie was wer aus nicht auch als an am es sich the and of to".split(
    " ",
  ),
);

/** Baut aus freiem Text eine robuste FTS5-Abfrage (Wörter mit OR, Präfixsuche). */
export function buildFtsQuery(text: string): string | null {
  const words = [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ].slice(0, 16);
  if (words.length === 0) return null;
  return words.map((w) => `"${w.replace(/"/g, "")}"*`).join(" OR ");
}

/**
 * Sucht passende Materialausschnitte. Bevorzugt Material des Themas (inkl.
 * Unterthemen), ergänzt durch fachweite Treffer. Alte Abituraufgaben werden
 * gesondert berücksichtigt, damit sie als Stilvorbild dienen.
 */
export function findSnippets(opts: {
  subjectId: string;
  topicIds: string[] | null;
  query: string;
  limit?: number;
}): RetrievedSnippet[] {
  const limit = opts.limit ?? 6;
  const fts = buildFtsQuery(opts.query);
  const db = getDb().$client;

  let rows: (Row & { rank: number })[] = [];
  if (fts) {
    rows = db
      .prepare(
        `SELECT f.chunk_id, f.material_id, c.text, c.page, m.title, m.category, m.topic_id, bm25(material_chunks_fts) AS rank
         FROM material_chunks_fts f
         JOIN material_chunks c ON c.id = f.chunk_id
         JOIN materials m ON m.id = f.material_id
         WHERE material_chunks_fts MATCH ? AND f.subject_id = ?
         ORDER BY rank LIMIT 40`,
      )
      .all(fts, opts.subjectId) as (Row & { rank: number })[];
  }

  // Material, das direkt dem Thema zugeordnet ist, auch ohne Worttreffer einbeziehen.
  if (opts.topicIds?.length) {
    const placeholders = opts.topicIds.map(() => "?").join(",");
    const direct = db
      .prepare(
        `SELECT c.id AS chunk_id, c.material_id, c.text, c.page, m.title, m.category, m.topic_id, 0 AS rank
         FROM material_chunks c JOIN materials m ON m.id = c.material_id
         WHERE m.topic_id IN (${placeholders}) ORDER BY c.position LIMIT 20`,
      )
      .all(...opts.topicIds) as (Row & { rank: number })[];
    const seen = new Set(rows.map((r) => r.chunk_id));
    rows.push(...direct.filter((r) => !seen.has(r.chunk_id)));
  }

  const inTopic = (r: Row) => !!opts.topicIds && !!r.topic_id && opts.topicIds.includes(r.topic_id);
  // Sortierung: Themenmaterial zuerst, dann Relevanz.
  rows.sort((a, b) => Number(inTopic(b)) - Number(inTopic(a)) || a.rank - b.rank);

  const pastExams = rows.filter((r) => r.category === "past_exam").slice(0, 2);
  const others = rows.filter((r) => r.category !== "past_exam").slice(0, limit - pastExams.length);
  const picked = [...others, ...pastExams];

  return picked.map((r, i) => ({
    ref: `M${i + 1}`,
    title: r.title,
    page: r.page,
    category: r.category,
    text: r.text.slice(0, 1800),
    source: { materialId: r.material_id, chunkId: r.chunk_id, title: r.title, page: r.page },
  }));
}

/** Übersetzt die von der KI genannten Referenzen (M1, M2) in gespeicherte Quellen. */
export function resolveRefs(refs: string[], snippets: RetrievedSnippet[]): SourceRef[] {
  const byRef = new Map(snippets.map((s) => [s.ref, s.source]));
  const out: SourceRef[] = [];
  for (const ref of refs) {
    const src = byRef.get(ref.replace(/[[\]\s]/g, "").toUpperCase());
    if (src && !out.some((o) => o.chunkId === src.chunkId)) out.push(src);
  }
  return out;
}
