import type { Subject } from "@/server/db/schema";
import { Field, inputClass } from "./ui";

export const PROFILE_LABELS: Record<Subject["profile"], string> = {
  stem: "MINT – Lösungsweg zählt",
  language: "Sprache – Inhalt, Struktur, Ausdruck, Grammatik",
  humanities: "Gesellschaft – Fachwissen, Argumentation, Operatoren",
  arts: "Musik/Kunst – Analyse und Fachbegriffe",
};

export function SubjectFields({ subject }: { subject?: Subject }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {subject && <input type="hidden" name="id" value={subject.id} />}
      <Field label="Name">
        <input name="name" required maxLength={60} defaultValue={subject?.name} className={inputClass} />
      </Field>
      <Field label="Niveau">
        <select name="level" defaultValue={subject?.level ?? "gA"} className={inputClass}>
          <option value="eA">erhöht (eA)</option>
          <option value="gA">grundlegend (gA)</option>
          <option value="">keine Angabe</option>
        </select>
      </Field>
      <Field label="Bewertungsprofil" hint="Steuert, worauf die KI bei der Bewertung achtet.">
        <select name="profile" defaultValue={subject?.profile ?? "stem"} className={inputClass}>
          {Object.entries(PROFILE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Farbe">
        <input
          name="color"
          type="color"
          defaultValue={subject?.color ?? "#4f46e5"}
          className="h-10 w-20 cursor-pointer rounded-lg border border-border bg-surface"
        />
      </Field>
    </div>
  );
}
