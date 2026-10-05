"use client";

import { useState } from "react";
import { Field, inputClass } from "./ui";

export type SubjectOption = {
  id: string;
  name: string;
  topics: { id: string; title: string; depth: number }[];
};

/** Fach- und abhängige Themenauswahl (Feldnamen: subjectId, topicId). */
export function SubjectTopicSelect({
  subjects,
  defaultSubjectId,
  defaultTopicId,
  topicLabel = "Thema (optional)",
  allTopicsLabel = "– ganzes Fach –",
}: {
  subjects: SubjectOption[];
  defaultSubjectId?: string;
  defaultTopicId?: string;
  topicLabel?: string;
  allTopicsLabel?: string;
}) {
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? subjects[0]?.id ?? "");
  const topics = subjects.find((s) => s.id === subjectId)?.topics ?? [];
  return (
    <>
      <Field label="Fach">
        <select
          name="subjectId"
          required
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className={inputClass}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={topicLabel}>
        <select
          key={subjectId}
          name="topicId"
          defaultValue={subjectId === defaultSubjectId ? defaultTopicId : ""}
          className={inputClass}
        >
          <option value="">{allTopicsLabel}</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {"  ".repeat(t.depth)}
              {t.title}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
