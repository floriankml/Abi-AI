"use client";

import { useActionState } from "react";
import { startLearnAction, startPracticeAction } from "@/app/actions";
import { SubjectTopicSelect, type SubjectOption } from "@/components/subject-topic-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export function LearnStartForm(props: { subjects: SubjectOption[]; subjectId?: string; topicId?: string }) {
  const [state, action, pending] = useActionState(startLearnAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SubjectTopicSelect subjects={props.subjects} defaultSubjectId={props.subjectId} defaultTopicId={props.topicId} />
      </div>
      <Field label="Was möchtest du lernen? (optional)" hint="z. B. „Erklär mir Newtons Gesetze“ oder „Lagebeziehungen von Geraden“">
        <input name="focus" maxLength={300} className={inputClass} />
      </Field>
      {state?.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Bereite Fragen vor…" : "Lernen starten"}
      </Button>
    </form>
  );
}

export function PracticeStartForm(props: { subjects: SubjectOption[]; subjectId?: string; topicId?: string }) {
  const [state, action, pending] = useActionState(startPracticeAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SubjectTopicSelect subjects={props.subjects} defaultSubjectId={props.subjectId} defaultTopicId={props.topicId} />
        <Field label="Schwierigkeit">
          <select name="difficulty" defaultValue="3" className={inputClass}>
            <option value="1">1 – sehr leicht</option>
            <option value="2">2 – leicht (AFB I)</option>
            <option value="3">3 – mittel (AFB II)</option>
            <option value="4">4 – schwer (AFB II–III)</option>
            <option value="5">5 – sehr schwer (AFB III)</option>
          </select>
        </Field>
        <Field label="Aufgabentyp">
          <select name="type" defaultValue="mixed" className={inputClass}>
            <option value="mixed">gemischt</option>
            <option value="short">Kurzantwort</option>
            <option value="calc">Rechnen / Herleiten</option>
            <option value="open">offene Aufgabe</option>
            <option value="essay">längerer Text</option>
          </select>
        </Field>
        <Field label="Anzahl">
          <input name="count" type="number" min={1} max={10} defaultValue={3} className={inputClass} />
        </Field>
        <Field label="Bearbeitungszeit in Minuten (optional)">
          <input name="timeLimitMin" type="number" min={1} max={300} className={inputClass} />
        </Field>
      </div>
      <Field label="Wunsch (optional)" hint="z. B. „wie im Thüringer Abitur, mit Anwendungsbezug“">
        <input name="focus" maxLength={300} className={inputClass} />
      </Field>
      {state?.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Erstelle Aufgaben… (kann etwas dauern)" : "Aufgaben erstellen"}
      </Button>
    </form>
  );
}
