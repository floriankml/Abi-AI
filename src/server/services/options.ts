import type { SubjectOption } from "@/components/subject-topic-select";
import { buildTopicTree, flattenTree, listAllTopics, listSubjects } from "./subjects";

/** Fächer mit Themenbaum für Auswahlfelder. */
export async function subjectOptions(): Promise<SubjectOption[]> {
  const [subjects, topics] = await Promise.all([listSubjects(), listAllTopics()]);
  return subjects.map((s) => ({
    id: s.id,
    name: s.name,
    topics: flattenTree(buildTopicTree(topics.filter((t) => t.subjectId === s.id))).map((t) => ({
      id: t.id,
      title: t.title,
      depth: t.depth,
    })),
  }));
}
