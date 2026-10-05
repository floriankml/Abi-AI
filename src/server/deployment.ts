import { env } from "./env";

/**
 * Prüft, ob der Cloud-Betrieb (Vercel) vollständig eingerichtet ist. Ohne
 * Datenbank bzw. Dateispeicher kann AbiOS dort nicht laufen – statt eines
 * Absturzes zeigt die App dann eine Anleitung.
 */
export function cloudSetupProblems(): { title: string; how: string }[] {
  if (process.env.VERCEL !== "1") return [];
  const problems: { title: string; how: string }[] = [];
  if (!env.databaseUrl) {
    problems.push({
      title: "Datenbank fehlt",
      how: "Im Vercel-Projekt: Storage → Create Database → Turso → kostenlosen Plan wählen → mit diesem Projekt verbinden.",
    });
  }
  if (!env.blobToken) {
    problems.push({
      title: "Dateispeicher fehlt",
      how: "Im Vercel-Projekt: Storage → Create → Blob → Zugriff „Private“ → mit diesem Projekt verbinden.",
    });
  }
  if (!env.setupCode && !env.appPassword) {
    problems.push({
      title: "Einrichtungscode fehlt",
      how: "Im Vercel-Projekt: Settings → Environment Variables → SETUP_CODE mit deinem Code anlegen.",
    });
  }
  return problems;
}
