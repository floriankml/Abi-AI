import type { SubjectProfile } from "../db/schema";

/**
 * Prompt-Vorlagen. Version erhöhen, wenn sich das Verhalten ändert – sie wird
 * an jeder generierten Aufgabe gespeichert (Nachvollziehbarkeit).
 */
export const PROMPT_VERSION = "v1";

export type SubjectContext = {
  name: string;
  profile: SubjectProfile;
  level: "eA" | "gA" | null;
};

export type Snippet = {
  ref: string;
  title: string;
  page: number | null;
  category: string;
  text: string;
};

export const TUTOR_SYSTEM = `Du bist ein erfahrener, ruhiger Tutor für das Abitur in Thüringen.
Grundsätze:
- Fördere eigenes Denken: aktive Abrufe statt fertiger Antworten.
- Erkläre knapp und konkret; keine Romane.
- Verrate niemals Lösungen, wenn das nicht ausdrücklich verlangt ist.
- Behaupte nicht vorschnell, eine Antwort sei richtig. Wenn du unsicher bist, sag es und stelle eine Rückfrage.
- Bevorzuge die bereitgestellten Materialien der Schülerin/des Schülers (markiert als [M1], [M2], …).
  Kennzeichne, ob eine Aussage aus den Materialien oder aus Allgemeinwissen stammt.
- Weise auf Widersprüche zwischen Materialien und Fachwissen hin.
- Schreibe auf Deutsch (außer bei Englisch-Aufgaben: Aufgaben und Feedback zur Sprache auf Englisch, Erklärungen dürfen deutsch sein).
- Formeln in LaTeX mit $…$ bzw. $$…$$.`;

const PROFILE_GUIDANCE: Record<SubjectProfile, string> = {
  stem: `Fachprofil MINT: Bewerte den Lösungsweg, nicht nur das Ergebnis.
Vergib Teilpunkte für richtigen Ansatz und korrekte Zwischenschritte. Prüfe Einheiten und Notation.
Typische Fehlerkategorien: Konzept, Ansatz, Rechenfehler, Notation, Einheit, Fachbegriff.
Dimensionen: Ansatz, Rechnung, Ergebnis, Darstellung.`,
  language: `Fachprofil Sprache: Betrachte getrennt: Inhalt/Argumentation, Struktur, Ausdruck, Sprachrichtigkeit (Grammatik/Rechtschreibung).
Typische Fehlerkategorien: Argumentation, Struktur, Ausdruck, Grammatik, Rechtschreibung, Textverständnis, Operator verfehlt.
Dimensionen: Inhalt, Struktur, Ausdruck, Sprachrichtigkeit.`,
  humanities: `Fachprofil Gesellschaftswissenschaften: Achte auf Fachbegriffe, korrekte Fakten, Multiperspektivität,
begründete Urteile und die Erfüllung der Operatoren (nennen, erläutern, beurteilen …).
Typische Fehlerkategorien: Fachwissen, Fachbegriff, Argumentation, Operator verfehlt, Struktur.
Dimensionen: Fachwissen, Argumentation, Operator, Darstellung.`,
  arts: `Fachprofil Musik/Kunst: Achte auf Fachterminologie, korrekte Analyse und Begründung.
Typische Fehlerkategorien: Fachwissen, Fachbegriff, Analyse, Begründung.
Dimensionen: Fachwissen, Analyse, Begründung, Darstellung.`,
};

export function subjectBlock(s: SubjectContext, topicPath: string[]): string {
  const level =
    s.level === "eA"
      ? "erhöhtes Anforderungsniveau (eA, Leistungsfach)"
      : s.level === "gA"
        ? "grundlegendes Anforderungsniveau (gA)"
        : "Abiturniveau";
  return [
    `Fach: ${s.name} – ${level}, Thüringer Abitur.`,
    topicPath.length ? `Thema: ${topicPath.join(" → ")}` : "Thema: gesamtes Fach",
    PROFILE_GUIDANCE[s.profile],
  ].join("\n");
}

export function materialsBlock(snippets: Snippet[]): string {
  if (snippets.length === 0) {
    return "MATERIALIEN: keine passenden Materialien vorhanden – nutze Allgemeinwissen auf Thüringer Abiturniveau und setze basis = general.";
  }
  const parts = snippets.map((s) => {
    const kind =
      s.category === "past_exam"
        ? "alte Abituraufgabe (Stil- und Niveauvorbild)"
        : s.category === "curriculum"
          ? "Lehrplan"
          : "Notizen/Material";
    return `[${s.ref}] ${s.title}${s.page ? `, S. ${s.page}` : ""} (${kind}):\n${s.text}`;
  });
  return `MATERIALIEN DER SCHÜLERIN/DES SCHÜLERS:\n${parts.join("\n\n")}`;
}

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "sehr leicht (Grundwissen abrufen)",
  2: "leicht (Anforderungsbereich I)",
  3: "mittel (Anforderungsbereich II)",
  4: "schwer (Anforderungsbereich II–III)",
  5: "sehr schwer (Anforderungsbereich III, Abiturniveau oben)",
};

export const TYPE_LABELS: Record<string, string> = {
  short: "Kurzantwort / Verständnisfrage",
  calc: "Rechen- oder Herleitungsaufgabe",
  open: "offene Aufgabe (erläutern, analysieren)",
  essay: "längerer Text (Erörterung, Analyse, Stellungnahme)",
  mixed: "gemischt, passend zum Fach",
};
