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
  | "model_not_found"
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
      case "model_not_found":
        return "Das eingestellte KI-Modell gibt es beim Anbieter nicht (mehr). Bitte AI_MODEL_FAST/AI_MODEL_STRONG in der .env anpassen.";
      case "invalid_output":
        return "Die KI hat keine verwertbare Antwort geliefert. Bitte erneut versuchen.";
      case "refused":
        return "Der KI-Anbieter hat die Anfrage abgelehnt.";
      case "unavailable":
        return "Der KI-Anbieter ist gerade nicht erreichbar oder überlastet. Bitte gleich noch einmal versuchen.";
    }
  }
  return "Unerwarteter Fehler bei der KI-Anfrage.";
}

/**
 * LaTeX-Befehle, die mit einem gültigen JSON-Escape-Buchstaben beginnen
 * (\b, \f, \n, \r, \t). Schreibt ein Modell sie mit nur einem Backslash,
 * würde JSON.parse sie stillschweigend in Steuerzeichen verwandeln.
 */
const LATEX_ESCAPE_LOOKALIKES =
  /^(?:b(?:ar|eta|inom|matrix|egin|ig{1,2}l?r?|oldsymbol|ot|ullet|ox)|f(?:rac|orall|lat)|n(?:eq?|abla|u|ot(?:in)?|eg|mid|ewline|leq|geq|subset|exists|parallel)|r(?:ight(?:arrow)?|ho|angle|ceil|floor|m)|t(?:imes|heta|au|ext(?:bf|it)?|ilde|riangle|frac|op|o(?![a-z])|an(?![a-z])))(?![a-zA-Z])/;

/**
 * Repariert typische Backslash-Fehler in KI-Antworten mit LaTeX:
 * ungültige Escapes (\vec, \cdot) und LaTeX-Befehle, die wie Escapes
 * aussehen (\frac, \neq), werden verdoppelt. Korrekt escapte Texte bleiben gleich.
 */
export function repairLatexEscapes(json: string): string {
  return json.replace(/\\([\s\S])/g, (match, next: string, offset: number) => {
    if (next === "\\" || next === '"' || next === "/") return match;
    const rest = json.slice(offset + 1);
    if (next === "u") return /^u[0-9a-fA-F]{4}/.test(rest) ? match : "\\\\u";
    if ("bfnrt".includes(next)) return LATEX_ESCAPE_LOOKALIKES.test(rest) ? "\\\\" + next : match;
    return "\\\\" + next;
  });
}

/** Entfernt ```json-Zäune und parst JSON tolerant (inkl. LaTeX-Reparatur). */
export function parseJsonText(text: string): unknown {
  const trimmed = repairLatexEscapes(text)
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
  if (status === 404) return new AiError("model_not_found", message);
  if (status === 429) return new AiError("rate_limited", message);
  return new AiError("unavailable", message);
}
