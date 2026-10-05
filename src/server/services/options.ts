import type { SubjectOption } from "@/components/subject-topic-select";
import { buildTopicTree, flattenTree, listSubjects, listTopics } from "./subjects";

/** Fächer mit Themenbaum für Auswahlfelder. */
export function subjectOptions(): SubjectOption[] {
  return listSubjects().map((s) => ({
    id: s.id,
    name: s.name,
    topics: flattenTree(buildTopicTree(listTopics(s.id))).map((t) => ({
      id: t.id,
      title: t.title,
      depth: t.depth,
    })),
  }));
}
