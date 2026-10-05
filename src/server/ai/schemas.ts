import { z } from "zod";

/**
 * Ausgabeschemas der KI-Aufgaben. Bewusst ohne min/max-Constraints, damit sie
 * mit möglichst vielen Anbietern (strukturierte Ausgaben) funktionieren –
 * Wertebereiche werden nach dem Parsen im Code begrenzt.
 */

export const basisSchema = z
  .enum(["material", "general", "mixed"])
  .describe(
    "material = nur aus den bereitgestellten Materialien, general = Allgemeinwissen, mixed = beides",
  );

export const generatedTaskSchema = z.object({
  prompt_md: z.string().describe("Aufgabenstellung in Markdown, Formeln in LaTeX mit $…$"),
  type: z.enum(["short", "calc", "open", "essay"]),
  difficulty: z.number().describe("1 (leicht) bis 5 (sehr schwer)"),
  max_points: z.number().describe("Erreichbare Punkte, ganzzahlig"),
  solution_md: z.string().describe("Vollständige Musterlösung mit Lösungsweg"),
  rubric: z
    .array(z.object({ criterion: z.string(), points: z.number() }))
    .describe("Bewertungsraster; Summe der Punkte = max_points"),
  hints: z
    .array(z.string())
    .describe("Genau 2 gestufte Hinweise: erst Denkanstoß, dann konkreter. Keiner verrät die Lösung."),
  concept: z.string().describe("Das geprüfte Konzept in wenigen Worten"),
  basis: basisSchema,
  source_refs: z.array(z.string()).describe("Verwendete Material-IDs wie M1, M3"),
});
export type GeneratedTask = z.infer<typeof generatedTaskSchema>;

export const generateTasksSchema = z.object({ tasks: z.array(generatedTaskSchema) });

export const evaluationSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect", "unclear"]),
  score: z.number().describe("Vergebene Punkte gemäß Raster"),
  feedback_md: z
    .string()
    .describe("Kurzes, konkretes Feedback an die Schülerin/den Schüler. Verrät NICHT die Lösung."),
  errors: z
    .array(
      z.object({
        label: z.string().describe("Kurzes Fehlerbild, z. B. 'Richtungsvektoren falsch interpretiert'"),
        category: z.string(),
        description: z.string(),
      }),
    )
    .describe("Erkannte Fehler; leer wenn korrekt"),
  confidence: z.number().describe("Sicherheit der Bewertung von 0 bis 1"),
  clarifying_question: z
    .string()
    .nullable()
    .describe("Rückfrage, falls die Antwort mehrdeutig ist; sonst null"),
  dimensions: z
    .array(z.object({ name: z.string(), score: z.number(), comment: z.string() }))
    .describe("Teilbewertungen je Dimension (score 0 bis 1)"),
});
export type EvaluationOutput = z.infer<typeof evaluationSchema>;

export const explanationSchema = z.object({
  explanation_md: z
    .string()
    .describe("Kurze, gezielte Erklärung (max. ~150 Wörter) genau zum erkannten Missverständnis"),
  basis: basisSchema,
  source_refs: z.array(z.string()),
  conflicts: z
    .array(z.string())
    .describe("Widersprüche zwischen Materialien und Allgemeinwissen; sonst leer"),
});
export type ExplanationOutput = z.infer<typeof explanationSchema>;
