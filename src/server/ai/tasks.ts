import { runAi } from ".";
import {
  DIFFICULTY_LABELS,
  TUTOR_SYSTEM,
  TYPE_LABELS,
  materialsBlock,
  subjectBlock,
  type Snippet,
  type SubjectContext,
} from "./prompts";
import {
  evaluationSchema,
  explanationSchema,
  generateTasksSchema,
  type EvaluationOutput,
  type ExplanationOutput,
  type GeneratedTask,
} from "./schemas";

/**
 * Die klar umrissenen KI-Aufgaben von AbiOS. Jede Funktion bekommt nur die
 * Daten, die sie wirklich braucht (Datensparsamkeit).
 */

export type TaskPurpose = "diagnose" | "learn" | "check" | "practice";

const PURPOSE_TEXT: Record<TaskPurpose, string> = {
  diagnose:
    "Diagnose: Kurze Fragen, die zeigen, was bereits gewusst wird. Steigende Schwierigkeit. Eher kurz beantwortbar.",
  learn: "Lernen: Kurze Verständnisfrage (Active Recall), in 1–5 Minuten beantwortbar.",
  check:
    "Kontrollfrage: Prüfe, ob das zuvor missverstandene Konzept jetzt verstanden ist – mit einer NEUEN Fragestellung, nicht derselben Aufgabe.",
  practice: "Übung: Prüfungsnahe Aufgaben im Stil des Thüringer Abiturs.",
};

export async function generateTasks(input: {
  subject: SubjectContext;
  topicPath: string[];
  purpose: TaskPurpose;
  count: number;
  difficulty: number | number[];
  type: string;
  focus: string | null;
  misconception: string | null;
  avoidPrompts: string[];
  snippets: Snippet[];
}): Promise<GeneratedTask[]> {
  const difficulties = Array.isArray(input.difficulty)
    ? input.difficulty.map((d) => `${d} – ${DIFFICULTY_LABELS[d]}`).join("; ")
    : `${input.difficulty} – ${DIFFICULTY_LABELS[input.difficulty]}`;

  const prompt = [
    subjectBlock(input.subject, input.topicPath),
    PURPOSE_TEXT[input.purpose],
    `Anzahl: ${input.count}`,
    `Schwierigkeit: ${difficulties}`,
    `Aufgabentyp: ${TYPE_LABELS[input.type] ?? input.type}`,
    input.focus ? `Wunsch/Fokus der Schülerin/des Schülers: ${input.focus}` : "",
    input.misconception ? `Zuvor erkanntes Missverständnis: ${input.misconception}` : "",
    input.avoidPrompts.length
      ? `Wiederhole diese bereits gestellten Aufgaben NICHT:\n- ${input.avoidPrompts.map((p) => p.slice(0, 200)).join("\n- ")}`
      : "",
    materialsBlock(input.snippets),
    `Erstelle die Aufgaben. Leite sie wenn möglich aus den Materialien ab (alte Abituraufgaben als Vorbild für Stil, Operatoren und Niveau).
Jede Aufgabe braucht: eine vollständige Musterlösung mit Lösungsweg, ein Bewertungsraster, genau 2 gestufte Hinweise, die die Lösung nicht verraten.
Gib in source_refs die genutzten Material-IDs an.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const out = await runAi({
    task: "generateTasks",
    tier: input.purpose === "practice" ? "strong" : "fast",
    system: TUTOR_SYSTEM,
    prompt,
    schema: generateTasksSchema,
  });
  return out.tasks.slice(0, input.count);
}

export async function evaluateAnswer(input: {
  subject: SubjectContext;
  topicPath: string[];
  taskPrompt: string;
  solution: string;
  rubric: { criterion: string; points: number }[];
  maxPoints: number;
  answer: string;
  hintsUsed: number;
  strong: boolean;
}): Promise<EvaluationOutput> {
  const prompt = [
    subjectBlock(input.subject, input.topicPath),
    `AUFGABE:\n${input.taskPrompt}`,
    `MUSTERLÖSUNG (nur für dich, nicht verraten):\n${input.solution}`,
    `BEWERTUNGSRASTER (max. ${input.maxPoints} Punkte):\n${input.rubric.map((r) => `- ${r.criterion}: ${r.points} P.`).join("\n")}`,
    `Genutzte Hinweise: ${input.hintsUsed}`,
    `ANTWORT:\n${input.answer}`,
    `Bewerte die Antwort streng nach Raster. Andere richtige Lösungswege sind gleichwertig.
- verdict: correct (volle oder fast volle Punktzahl), partial, incorrect, unclear (Antwort mehrdeutig/unvollständig formuliert – dann clarifying_question stellen).
- feedback_md: 1–4 Sätze, konkret, was gut ist und wo der Fehler liegt – OHNE die Lösung oder das Ergebnis zu verraten.
- errors: jedes relevante Fehlerbild mit kurzem, wiederverwendbarem label.
- confidence: wie sicher du dir bei der Bewertung bist.`,
  ].join("\n\n");

  return runAi({
    task: "evaluateAnswer",
    tier: input.strong ? "strong" : "fast",
    system: TUTOR_SYSTEM,
    prompt,
    schema: evaluationSchema,
  });
}

export async function explainMisconception(input: {
  subject: SubjectContext;
  topicPath: string[];
  taskPrompt: string;
  solution: string;
  answer: string;
  errors: string[];
  snippets: Snippet[];
}): Promise<ExplanationOutput> {
  const prompt = [
    subjectBlock(input.subject, input.topicPath),
    `AUFGABE:\n${input.taskPrompt}`,
    `MUSTERLÖSUNG:\n${input.solution}`,
    `ANTWORT DER SCHÜLERIN/DES SCHÜLERS:\n${input.answer || "(keine Antwort – 'weiß ich nicht')"}`,
    input.errors.length ? `ERKANNTE FEHLER:\n- ${input.errors.join("\n- ")}` : "",
    materialsBlock(input.snippets),
    `Erkläre kurz und gezielt das zugrunde liegende Missverständnis – nicht die ganze Theorie.
Knüpfe an die Antwort an. Nutze bevorzugt die Materialien und gib die Basis an.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runAi({
    task: "explain",
    tier: "fast",
    system: TUTOR_SYSTEM,
    prompt,
    schema: explanationSchema,
  });
}
