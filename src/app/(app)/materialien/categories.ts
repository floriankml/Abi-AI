import type { MaterialCategory } from "@/server/db/schema";

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  notes: "Notizen / Unterricht",
  past_exam: "Alte Abituraufgabe",
  curriculum: "Lehrplan",
  other: "Sonstiges",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [MaterialCategory, string][];
