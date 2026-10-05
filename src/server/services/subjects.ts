import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { slugify } from "../db/seed";
import { subjects, topics, type SubjectProfile, type Topic } from "../db/schema";

export function listSubjects() {
  return getDb()
    .select()
    .from(subjects)
    .where(isNull(subjects.archivedAt))
    .orderBy(asc(subjects.position), asc(subjects.name))
    .all();
}

export function getSubject(id: string) {
  return getDb().select().from(subjects).where(eq(subjects.id, id)).get();
}

export function createSubject(input: {
  name: string;
  profile: SubjectProfile;
  level: "eA" | "gA" | null;
  color: string;
}) {
  const db = getDb();
  let slug = slugify(input.name) || "fach";
  if (db.select().from(subjects).where(eq(subjects.slug, slug)).get()) {
    slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
  }
  const position = db.select().from(subjects).all().length;
  return db
    .insert(subjects)
    .values({ ...input, slug, position })
    .returning()
    .get();
}

export function updateSubject(
  id: string,
  input: { name: string; profile: SubjectProfile; level: "eA" | "gA" | null; color: string },
) {
  getDb().update(subjects).set(input).where(eq(subjects.id, id)).run();
}

/** Archivieren statt löschen: Lernhistorie bleibt erhalten. */
export function archiveSubject(id: string) {
  getDb()
    .update(subjects)
    .set({ archivedAt: new Date().toISOString() })
    .where(eq(subjects.id, id))
    .run();
}

export function listTopics(subjectId: string): Topic[] {
  return getDb()
    .select()
    .from(topics)
    .where(eq(topics.subjectId, subjectId))
    .orderBy(asc(topics.position), asc(topics.title))
    .all();
}

export type TopicNode = Topic & { children: TopicNode[]; depth: number };

/** Baut aus der flachen Liste einen Baum. */
export function buildTopicTree(list: Topic[]): TopicNode[] {
  const byParent = new Map<string | null, Topic[]>();
  for (const t of list) {
    const key = t.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), t]);
  }
  const build = (parent: string | null, depth: number): TopicNode[] =>
    (byParent.get(parent) ?? []).map((t) => ({ ...t, depth, children: build(t.id, depth + 1) }));
  return build(null, 0);
}

/** Baum in Anzeige-Reihenfolge abflachen (für Auswahllisten). */
export function flattenTree(nodes: TopicNode[]): TopicNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/** Pfad vom Wurzelthema bis zum Thema, z. B. ["Analytische Geometrie", "Geraden"]. */
export function topicPath(topicId: string | null): string[] {
  if (!topicId) return [];
  const db = getDb();
  const path: string[] = [];
  let current = db.select().from(topics).where(eq(topics.id, topicId)).get();
  while (current && path.length < 20) {
    path.unshift(current.title);
    current = current.parentId
      ? db.select().from(topics).where(eq(topics.id, current.parentId)).get()
      : undefined;
  }
  return path;
}

/** Das Thema und alle Unterthemen. */
export function topicSubtreeIds(subjectId: string, topicId: string): string[] {
  const all = listTopics(subjectId);
  const ids = [topicId];
  for (let i = 0; i < ids.length; i++) {
    for (const t of all) if (t.parentId === ids[i]) ids.push(t.id);
  }
  return ids;
}

export function createTopic(input: {
  subjectId: string;
  parentId: string | null;
  title: string;
  examWeight: number;
}) {
  const db = getDb();
  if (input.parentId) {
    const parent = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, input.parentId), eq(topics.subjectId, input.subjectId)))
      .get();
    if (!parent) throw new Error("Oberthema nicht gefunden");
  }
  const siblings = listTopics(input.subjectId).filter(
    (t) => (t.parentId ?? null) === input.parentId,
  );
  return db
    .insert(topics)
    .values({ ...input, position: siblings.length })
    .returning()
    .get();
}

export function updateTopic(id: string, input: { title: string; examWeight: number }) {
  getDb().update(topics).set(input).where(eq(topics.id, id)).run();
}

export function deleteTopic(id: string) {
  getDb().delete(topics).where(eq(topics.id, id)).run();
}
