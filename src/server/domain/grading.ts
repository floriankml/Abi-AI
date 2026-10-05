/**
 * Umrechnung Prozent → Notenpunkte (0–15) nach der in der Oberstufe üblichen
 * Tabelle. Ab Phase 3 in den Einstellungen anpassbar.
 */
export const DEFAULT_GRADE_SCALE: { points: number; minPercent: number }[] = [
  { points: 15, minPercent: 95 },
  { points: 14, minPercent: 90 },
  { points: 13, minPercent: 85 },
  { points: 12, minPercent: 80 },
  { points: 11, minPercent: 75 },
  { points: 10, minPercent: 70 },
  { points: 9, minPercent: 65 },
  { points: 8, minPercent: 60 },
  { points: 7, minPercent: 55 },
  { points: 6, minPercent: 50 },
  { points: 5, minPercent: 45 },
  { points: 4, minPercent: 40 },
  { points: 3, minPercent: 33 },
  { points: 2, minPercent: 27 },
  { points: 1, minPercent: 20 },
];

export function percentToNotenpunkte(percent: number, scale = DEFAULT_GRADE_SCALE): number {
  for (const row of scale) if (percent >= row.minPercent) return row.points;
  return 0;
}
