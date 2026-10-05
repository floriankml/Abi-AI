import path from "node:path";

/** Zentrale, typisierte Konfiguration aus Umgebungsvariablen. */
export const env = {
  /** Leer = lokale Datei im Datenordner. Sonst z. B. libsql://….turso.io */
  databaseUrl: process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "",
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN ?? "",
  dataDir: path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "./data"),
  appPassword: process.env.APP_PASSWORD ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  /** Schützt die Ersteinrichtung in der Cloud: nur wer den Code kennt, legt das Passwort fest. */
  setupCode: process.env.SETUP_CODE ?? "",
  ai: {
    provider: (process.env.AI_PROVIDER ?? "none") as "openai-compatible" | "anthropic" | "mock" | "none",
    baseUrl: process.env.AI_BASE_URL ?? "",
    apiKey: process.env.AI_API_KEY ?? "",
    modelFast: process.env.AI_MODEL_FAST ?? "",
    modelStrong: process.env.AI_MODEL_STRONG ?? process.env.AI_MODEL_FAST ?? "",
    /** Ausweichmodelle bei Überlastung/Limit, kommagetrennt (z. B. für Free Tiers). */
    modelFallbacks: (process.env.AI_MODEL_FALLBACKS ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    /** json_object: breite Kompatibilität; json_schema: strenger, nicht überall unterstützt. */
    jsonMode: (process.env.AI_JSON_MODE ?? "json_object") as "json_object" | "json_schema",
  },
  /** Gesetzt = Dateien in Vercel Blob statt im lokalen Ordner. */
  blobToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 50),
};
