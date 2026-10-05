import { describe, expect, it } from "vitest";
import { computeMastery } from "@/server/domain/mastery";
import { nextLevel } from "@/server/domain/adaptive";
import { percentToNotenpunkte } from "@/server/domain/grading";
import { chunkPages } from "@/server/ingest/chunk";

const day = (n: number) => new Date(Date.UTC(2026, 9, n));

describe("computeMastery", () => {
  it("ist null ohne Versuche", () => {
    expect(computeMastery([], day(1))).toBeNull();
  });

  it("gewichtet neuere Versuche stärker", () => {
    const improving = computeMastery(
      [
        { ratio: 0, at: day(1) },
        { ratio: 1, at: day(2) },
      ],
      day(2),
    )!;
    const declining = computeMastery(
      [
        { ratio: 1, at: day(1) },
        { ratio: 0, at: day(2) },
      ],
      day(2),
    )!;
    expect(improving.mastery).toBeGreaterThan(declining.mastery);
  });

  it("sinkt durch Vergessen, aber höchstens auf die Hälfte", () => {
    const fresh = computeMastery([{ ratio: 1, at: day(1) }], day(1))!;
    const old = computeMastery([{ ratio: 1, at: day(1) }], new Date(Date.UTC(2027, 9, 1)))!;
    expect(fresh.mastery).toBeCloseTo(1);
    expect(old.mastery).toBeLessThan(0.6);
    expect(old.mastery).toBeGreaterThanOrEqual(0.5);
  });

  it("Konfidenz wächst mit der Zahl der Versuche", () => {
    const one = computeMastery([{ ratio: 1, at: day(1) }], day(1))!;
    const three = computeMastery(
      [1, 2, 3].map((d) => ({ ratio: 1, at: day(d) })),
      day(3),
    )!;
    expect(three.confidence).toBeGreaterThan(one.confidence);
  });
});

describe("nextLevel", () => {
  it("steigt nur bei richtiger Antwort ohne Hinweise", () => {
    expect(nextLevel(3, "correct", 0)).toBe(4);
    expect(nextLevel(3, "correct", 1)).toBe(3);
    expect(nextLevel(3, "partial", 0)).toBe(3);
    expect(nextLevel(3, "incorrect", 0)).toBe(2);
  });
  it("bleibt im Bereich 1–5", () => {
    expect(nextLevel(5, "correct", 0)).toBe(5);
    expect(nextLevel(1, "incorrect", 0)).toBe(1);
  });
});

describe("percentToNotenpunkte", () => {
  it.each([
    [100, 15],
    [95, 15],
    [94.9, 14],
    [50, 6],
    [33, 3],
    [19.9, 0],
  ])("%d %% → %d NP", (p, np) => {
    expect(percentToNotenpunkte(p)).toBe(np);
  });
});

describe("chunkPages", () => {
  it("behält Seitenzahlen und teilt lange Texte", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Absatz ${i} mit etwas Text darin.`).join(
      "\n\n",
    );
    const chunks = chunkPages([
      { page: 1, text: "Kurz." },
      { page: 2, text: long },
    ]);
    expect(chunks[0]).toEqual({ page: 1, text: "Kurz." });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 1800)).toBe(true);
    expect(chunks.slice(1).every((c) => c.page === 2)).toBe(true);
  });

  it("teilt einen einzelnen riesigen Absatz", () => {
    const chunks = chunkPages([{ page: null, text: "x".repeat(5000) }]);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map((c) => c.text).join("")).toHaveLength(5000);
  });
});
