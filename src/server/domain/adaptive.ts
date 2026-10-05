export type Verdict = "correct" | "partial" | "incorrect" | "unclear";

/** Schwierigkeit der nächsten Frage im Lernmodus (1–5). */
export function nextLevel(level: number, verdict: Verdict, hintsUsed: number): number {
  let next = level;
  if (verdict === "correct" && hintsUsed === 0) next = level + 1;
  else if (verdict === "incorrect") next = level - 1;
  return Math.min(5, Math.max(1, next));
}

/** Diagnosefragen in steigender Schwierigkeit. */
export const DIAGNOSE_LEVELS = [2, 3, 4] as const;
