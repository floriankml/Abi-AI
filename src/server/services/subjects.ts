import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { slugify } from "../db/seed";
import { subjects, topics, type SubjectProfile, type Topic } from "../db/schema";

export async function listSubjects() {
  const db = await getDb();
  return db
    .select()
    .from(subjects)
    .where(isNull(subjects.archivedAt))
    .orderBy(asc(subjects.position), asc(subjects.name));
}

/** Alle Fächer inkl. archivierter (für Anzeigen alter Daten). */
export async function allSubjectsById() {
  const db = await getDb();
  return new Map((await db.select().from(subjects)).map((s) => [s.id, s]));
}

export async function getSubject(id: string) {
  const db = await getDb();
  return db.select().from(subjects).where(eq(subjects.id, id)).get();
}

export async function createSubject(input: {
  name: string;
  profile: SubjectProfile;
  level: "eA" | "gA" | null;
  color: string;
}) {
  const db = await getDb();
  let slug = slugify(input.name) || "fach";
  if (await db.select().from(subjects).where(eq(subjects.slug, slug)).get()) {
    slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
  }
  const position = (await db.select({ id: subjects.id }).from(subjects)).length;
  return db
    .insert(subjects)
    .values({ ...input, slug, position })
    .returning()
    .get();
}

export async function updateSubject(
  id: string,
  input: { name: string; profile: SubjectProfile; level: "eA" | "gA" | null; color: string },
) {
  const db = await getDb();
  await db.update(subjects).set(input).where(eq(subjects.id, id));
}

/** Archivieren statt löschen: Lernhistorie bleibt erhalten. */
export async function archiveSubject(id: string) {
  const db = await getDb();
  await db.update(subjects).set({ archivedAt: new Date().toISOString() }).where(eq(subjects.id, id));
}

export async function listTopics(subjectId: string): Promise<Topic[]> {
  const db = await getDb();
  return db
    .select()
    .from(topics)
    .where(eq(topics.subjectId, subjectId))
    .orderBy(asc(topics.position), asc(topics.title));
}

/** Alle Themen aller Fächer – eine Abfrage statt vieler (wichtig bei Cloud-Datenbank). */
export async function listAllTopics(): Promise<Topic[]> {
  const db = await getDb();
  return db.select().from(topics).orderBy(asc(topics.position), asc(topics.title));
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

/** Pfad aus einer bereits geladenen Themenliste (ohne Datenbankzugriff). */
export function topicPathFrom(list: Topic[], topicId: string | null): string[] {
  if (!topicId) return [];
  const byId = new Map(list.map((t) => [t.id, t]));
  const path: string[] = [];
  let current = byId.get(topicId);
  while (current && path.length < 20) {
    path.unshift(current.title);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** Pfad vom Wurzelthema bis zum Thema, z. B. ["Analytische Geometrie", "Geraden"]. */
export async function topicPath(topicId: string | null): Promise<string[]> {
  if (!topicId) return [];
  return topicPathFrom(await listAllTopics(), topicId);
}

/** Das Thema und alle Unterthemen (aus geladener Liste). */
export function subtreeIdsFrom(list: Topic[], topicId: string): string[] {
  const ids = [topicId];
  for (let i = 0; i < ids.length; i++) {
    for (const t of list) if (t.parentId === ids[i]) ids.push(t.id);
  }
  return ids;
}

export async function topicSubtreeIds(subjectId: string, topicId: string): Promise<string[]> {
  return subtreeIdsFrom(await listTopics(subjectId), topicId);
}

export async function createTopic(input: {
  subjectId: string;
  parentId: string | null;
  title: string;
  examWeight: number;
}) {
  const db = await getDb();
  if (input.parentId) {
    const parent = await db
      .select()
      .from(topics)
      .where(and(eq(topics.id, input.parentId), eq(topics.subjectId, input.subjectId)))
      .get();
    if (!parent) throw new Error("Oberthema nicht gefunden");
  }
  const siblings = (await listTopics(input.subjectId)).filter(
    (t) => (t.parentId ?? null) === input.parentId,
  );
  return db
    .insert(topics)
    .values({ ...input, position: siblings.length })
    .returning()
    .get();
}

export async function updateTopic(id: string, input: { title: string; examWeight: number }) {
  const db = await getDb();
  await db.update(topics).set(input).where(eq(topics.id, id));
}

export async function deleteTopic(id: string) {
  const db = await getDb();
  await db.delete(topics).where(eq(topics.id, id));
}
