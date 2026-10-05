import type { z } from "zod";
import { env } from "../env";
import { getDb } from "../db/client";
import { aiUsage } from "../db/schema";
import { AiError, type AiProvider, type ModelTier } from "./provider";
import { createOpenAiCompatibleProvider } from "./providers/openai-compatible";
import { createAnthropicProvider } from "./providers/anthropic";
import { createMockProvider } from "./providers/mock";

let cached: AiProvider | null | undefined;

/** Wählt den Anbieter anhand von AI_PROVIDER. Einzige Stelle, die Anbieter kennt. */
function getProvider(): AiProvider | null {
  if (cached !== undefined) return cached;
  const c = env.ai;
  switch (c.provider) {
    case "openai-compatible":
      cached = c.modelFast ? createOpenAiCompatibleProvider(c) : null;
      break;
    case "anthropic":
      cached = c.apiKey && c.modelFast ? createAnthropicProvider(c) : null;
      break;
    case "mock":
      cached = createMockProvider();
      break;
    default:
      cached = null;
  }
  return cached;
}

export function aiStatus() {
  const p = getProvider();
  return {
    configured: p !== null,
    provider: env.ai.provider,
    modelFast: env.ai.modelFast,
    modelStrong: env.ai.modelStrong,
    baseUrl: env.ai.baseUrl,
  };
}

/**
 * Führt eine KI-Aufgabe aus und gibt garantiert schema-konforme Daten zurück
 * (plus das tatsächlich genutzte Modell, z. B. nach Ausweichen).
 * Bei ungültiger Ausgabe wird genau einmal mit Fehlerhinweis wiederholt.
 * Protokolliert nur Token-Verbrauch, keine Inhalte.
 */
export async function runAi<S extends z.ZodType>(req: {
  task: string;
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: S;
}): Promise<{ data: z.infer<S>; model: string }> {
  const provider = getProvider();
  if (!provider) throw new AiError("not_configured", "Kein KI-Anbieter konfiguriert");

  let prompt = req.prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    let ok = false;
    let model = "?";
    let usage = { input: 0, output: 0 };
    try {
      const res = await provider.generateJson({ ...req, prompt });
      model = res.model;
      usage = res.usage;
      const parsed = req.schema.safeParse(res.data);
      if (parsed.success) {
        ok = true;
        return { data: parsed.data, model: res.model };
      }
      console.warn(
        `[ai] ${req.task}: Schema verletzt (${res.model}) bei`,
        parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.code}`),
      );
      prompt =
        req.prompt +
        "\n\nDeine letzte Antwort entsprach nicht dem Schema. Fehler: " +
        parsed.error.message.slice(0, 800);
    } catch (err) {
      // Nur Fehlerart protokollieren, keine Inhalte (Datenschutz).
      console.error(`[ai] ${req.task} fehlgeschlagen:`, err instanceof AiError ? `${err.code} – ${err.message.slice(0, 300)}` : err);
      if (!(err instanceof AiError && err.code === "invalid_output")) throw err;
    } finally {
      logUsage(req.task, provider.name, model, usage, ok);
    }
  }
  throw new AiError("invalid_output", "Ausgabe nach Wiederholung ungültig");
}

function logUsage(
  task: string,
  provider: string,
  model: string,
  usage: { input: number; output: number },
  ok: boolean,
) {
  try {
    getDb()
      .insert(aiUsage)
      .values({ task, provider, model, inputTokens: usage.input, outputTokens: usage.output, ok })
      .run();
  } catch {
    // Protokollierung darf nie eine Lernaktion scheitern lassen.
  }
}
