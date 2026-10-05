import { subjects, type SubjectProfile } from "./schema";
import type { Db } from "./client";

type SeedSubject = { name: string; profile: SubjectProfile; level: "eA" | "gA"; color: string };

/** Fächer zum Start. Danach frei änderbar – es sind nur Daten. */
const DEFAULT_SUBJECTS: SeedSubject[] = [
  { name: "Mathematik", profile: "stem", level: "eA", color: "#2563eb" },
  { name: "Biologie", profile: "stem", level: "eA", color: "#16a34a" },
  { name: "Sozialkunde", profile: "humanities", level: "eA", color: "#db2777" },
  { name: "Physik", profile: "stem", level: "gA", color: "#7c3aed" },
  { name: "Deutsch", profile: "language", level: "gA", color: "#dc2626" },
  { name: "Englisch", profile: "language", level: "gA", color: "#0891b2" },
  { name: "Geschichte", profile: "humanities", level: "gA", color: "#b45309" },
  { name: "Ethik", profile: "humanities", level: "gA", color: "#4f46e5" },
  { name: "Musik", profile: "arts", level: "gA", color: "#c026d3" },
  { name: "Sport", profile: "humanities", level: "gA", color: "#ea580c" },
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function seedIfEmpty(db: Db) {
  const existing = await db.select({ id: subjects.id }).from(subjects).limit(1);
  if (existing.length > 0) return;
  await db
    .insert(subjects)
    .values(DEFAULT_SUBJECTS.map((s, i) => ({ ...s, slug: slugify(s.name), position: i })))
    .onConflictDoNothing();
}
