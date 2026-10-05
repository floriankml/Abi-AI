import type { AiProvider, JsonRequest } from "../provider";

/**
 * Deterministischer Test-Anbieter (AI_PROVIDER=mock). Ermöglicht Tests und das
 * Ausprobieren der Oberfläche ohne API-Schlüssel. Inhalte sind Platzhalter.
 */
export function createMockProvider(): AiProvider {
  let counter = 0;
  return {
    name: "mock",
    async generateJson(req: JsonRequest) {
      counter++;
      const countMatch = req.prompt.match(/Anzahl:\s*(\d+)/);
      const count = countMatch ? Number(countMatch[1]) : 1;
      let data: unknown;
      switch (req.task) {
        case "generateTasks":
          data = {
            tasks: Array.from({ length: count }, (_, i) => ({
              prompt_md: `Testaufgabe ${counter}.${i + 1}: Berechne $2 + 2$ und begründe kurz.`,
              type: "calc",
              difficulty: 2,
              max_points: 2,
              solution_md: "$2 + 2 = 4$, da die Addition zweier Zweien vier ergibt.",
              rubric: [
                { criterion: "Ergebnis 4", points: 1 },
                { criterion: "Begründung", points: 1 },
              ],
              hints: ["Zähle zwei Mal zwei Finger.", "Zwei plus zwei ist das Doppelte von zwei."],
              concept: "Addition",
              basis: "general",
              source_refs: [],
            })),
          };
          break;
        case "evaluateAnswer": {
          const answer = (req.prompt.split("ANTWORT:\n")[1] ?? "").split("\n\n")[0];
          const correct = /\b4\b|vier/i.test(answer);
          data = {
            verdict: correct ? "correct" : "incorrect",
            score: correct ? 2 : 0,
            feedback_md: correct ? "Richtig – sauber begründet." : "Das Ergebnis stimmt noch nicht.",
            errors: correct
              ? []
              : [{ label: "Additionsfehler", category: "Rechenfehler", description: "Falsche Summe." }],
            confidence: 0.9,
            clarifying_question: null,
            dimensions: [],
          };
          break;
        }
        case "explain":
          data = {
            explanation_md: "Bei der Addition werden Mengen zusammengefasst: 2 und 2 ergeben 4.",
            basis: "general",
            source_refs: [],
            conflicts: [],
          };
          break;
        default:
          data = {};
      }
      return { data, model: "mock", usage: { input: 0, output: 0 } };
    },
  };
}
