/**
 * Beherrschung eines Themas (0–1), deterministisch aus Versuchsergebnissen.
 *
 * - Neuere Versuche zählen stärker (Gewicht 0.7^k, k = Abstand zum neuesten).
 * - Lange nicht geübt senkt den Wert (Vergessen), höchstens auf die Hälfte.
 * - confidence wächst mit der Zahl der Versuche.
 */
export type ScoredAttempt = { ratio: number; at: Date };
export type Mastery = { mastery: number; confidence: number; attempts: number; lastAt: Date };

const RECENCY = 0.7;
const FORGET_DAYS = 30;

export function computeMastery(attempts: ScoredAttempt[], now: Date): Mastery | null {
  if (attempts.length === 0) return null;
  const sorted = [...attempts].sort((a, b) => a.at.getTime() - b.at.getTime());
  let weighted = 0;
  let weights = 0;
  sorted.forEach((a, i) => {
    const w = Math.pow(RECENCY, sorted.length - 1 - i);
    weighted += w * clamp01(a.ratio);
    weights += w;
  });
  const lastAt = sorted[sorted.length - 1].at;
  const days = Math.max(0, (now.getTime() - lastAt.getTime()) / 86_400_000);
  const retention = 0.5 + 0.5 * Math.exp(-days / FORGET_DAYS);
  return {
    mastery: (weighted / weights) * retention,
    confidence: 1 - Math.pow(RECENCY, sorted.length),
    attempts: sorted.length,
    lastAt,
  };
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
}
