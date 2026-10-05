import type { z } from "zod";
import { env } from "../env";
import { getDb } from "../db/client";
import { aiUsage } from "../db/schema";
import { getSetting } from "../settings";
import { AiError, type AiProvider, type ModelTier } from "./provider";
import { createOpenAiCompatibleProvider } from "./providers/openai-compatible";
import { createAnthropicProvider } from "./providers/anthropic";
import { createMockProvider } from "./providers/mock";

/** KI-Konfiguration – aus Umgebungsvariablen oder (im Browser eingerichtet) aus der Datenbank. */
export type AiConfig = {
  provider: "openai-compatible" | "anthropic" | "mock" | "none";
  baseUrl: string;
  apiKey: string;
  modelFast: string;
  modelStrong: string;
  modelFallbacks: string[];
  jsonMode: "json_object" | "json_schema";
};

/** Voreinstellung für den kostenlosen Betrieb mit Google Gemini. */
export const GEMINI_PRESET: Omit<AiConfig, "apiKey"> = {
  provider: "openai-compatible",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
  modelFast: "gemini-3.8-flash",
  modelStrong: "gemini-3.8-flash",
  modelFallbacks: ["gemini-3.5-flash", "gemini-flash-lite-latest"],
  jsonMode: "json_object",
};

export const aiConfigFromEnv = () => env.ai.provider !== "none";

export async function getAiConfig(): Promise<AiConfig & { source: "env" | "app" }> {
  if (aiConfigFromEnv()) return { ...env.ai, source: "env" };
  const stored = await getSetting<Partial<AiConfig>>("ai.config");
  return {
    provider: "none",
    baseUrl: "",
    apiKey: "",
    modelFast: "",
    modelStrong: "",
    modelFallbacks: [],
    jsonMode: "json_object",
    ...stored,
    source: "app",
  };
}

let cached: { key: string; provider: AiProvider | null } | undefined;

/** Wählt den Anbieter anhand der Konfiguration. Einzige Stelle, die Anbieter kennt. */
export function createProvider(c: AiConfig): AiProvider | null {
  const cfg = { ...c, modelStrong: c.modelStrong || c.modelFast };
  switch (cfg.provider) {
    case "openai-compatible":
      return cfg.modelFast ? createOpenAiCompatibleProvider(cfg) : null;
    case "anthropic":
      return cfg.apiKey && cfg.modelFast ? createAnthropicProvider(cfg) : null;
    case "mock":
      return createMockProvider();
    default:
      return null;
  }
}

async function getProvider(): Promise<AiProvider | null> {
  const config = await getAiConfig();
  const key = JSON.stringify(config);
  if (cached?.key !== key) cached = { key, provider: createProvider(config) };
  return cached.provider;
}

export async function aiStatus() {
  const [config, provider] = await Promise.all([getAiConfig(), getProvider()]);
  return {
    configured: provider !== null,
    source: config.source,
    provider: config.provider,
    modelFast: config.modelFast,
    modelStrong: config.modelStrong || config.modelFast,
    baseUrl: config.baseUrl,
    keyHint: config.apiKey ? `…${config.apiKey.slice(-4)}` : "",
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
  const provider = await getProvider();
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
      await logUsage(req.task, provider.name, model, usage, ok);
    }
  }
  throw new AiError("invalid_output", "Ausgabe nach Wiederholung ungültig");
}

async function logUsage(
  task: string,
  provider: string,
  model: string,
  usage: { input: number; output: number },
  ok: boolean,
) {
  try {
    const db = await getDb();
    await db
      .insert(aiUsage)
      .values({ task, provider, model, inputTokens: usage.input, outputTokens: usage.output, ok });
  } catch {
    // Protokollierung darf nie eine Lernaktion scheitern lassen.
  }
}
