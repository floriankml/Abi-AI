import type { z } from "zod";

/**
 * Anbieterunabhängige KI-Schnittstelle.
 *
 * Die App kennt nur dieses Interface. Ein neuer Anbieter ist eine neue Datei in
 * ./providers – sonst ändert sich nichts.
 */

export type ModelTier = "fast" | "strong";

export interface JsonRequest {
  /** Name der KI-Aufgabe (für Protokoll und Mock), z. B. "generateTasks". */
  task: string;
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: z.ZodType;
}

export interface JsonResponse {
  /** Roh geparstes JSON – wird zentral mit dem Zod-Schema validiert. */
  data: unknown;
  model: string;
  usage: { input: number; output: number };
}

export interface AiProvider {
  readonly name: string;
  generateJson(req: JsonRequest): Promise<JsonResponse>;
}

export type AiErrorCode =
  | "not_configured"
  | "rate_limited"
  | "auth"
  | "invalid_output"
  | "refused"
  | "unavailable";

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Verständliche Meldung für die Oberfläche. */
export function aiErrorMessage(err: unknown): string {
  if (err instanceof AiError) {
    switch (err.code) {
      case "not_configured":
        return "Es ist noch kein KI-Anbieter eingerichtet. Siehe Einstellungen.";
      case "rate_limited":
        return "Der KI-Anbieter meldet zu viele Anfragen. Bitte kurz warten und erneut versuchen.";
      case "auth":
        return "Der API-Schlüssel wurde vom KI-Anbieter abgelehnt.";
      case "invalid_output":
        return "Die KI hat keine verwertbare Antwort geliefert. Bitte erneut versuchen.";
      case "refused":
        return "Der KI-Anbieter hat die Anfrage abgelehnt.";
      case "unavailable":
        return "Der KI-Anbieter ist gerade nicht erreichbar.";
    }
  }
  return "Unerwarteter Fehler bei der KI-Anfrage.";
}

/** Entfernt ```json-Zäune und parst JSON tolerant. */
export function parseJsonText(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fällt durch */
      }
    }
    throw new AiError("invalid_output", "Antwort ist kein gültiges JSON");
  }
}

/** Ordnet HTTP-Statuscodes der Anbieter einheitlichen Fehlern zu. */
export function mapHttpError(status: number | undefined, message: string): AiError {
  if (status === 401 || status === 403) return new AiError("auth", message);
  if (status === 429) return new AiError("rate_limited", message);
  return new AiError("unavailable", message);
}
