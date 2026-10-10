import { logoutAction } from "@/app/actions";
import { aiStatus, getAiConfig } from "@/server/ai";
import { passwordFromEnv, passwordRequired, requireAuth } from "@/server/auth";
import { env } from "@/server/env";
import { storageMode } from "@/server/storage";
import { aiUsageSummary } from "@/server/services/usage";
import { Alert, Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { AiSettingsForm } from "./ai-form";
import { PasswordForm } from "./password-form";

// KI-Anfragen (Server Actions dieser Seite) dürfen länger dauern.
export const maxDuration = 120;

export const metadata = { title: "Einstellungen" };

const GEMINI_URL = "generativelanguage.googleapis.com";

export default async function SettingsPage() {
  await requireAuth();
  const [ai, config, usage, hasPassword] = await Promise.all([
    aiStatus(),
    getAiConfig(),
    aiUsageSummary(30),
    passwordRequired(),
  ]);
  const preset =
    config.provider === "anthropic"
      ? "anthropic"
      : config.provider === "openai-compatible"
        ? config.baseUrl.includes(GEMINI_URL)
          ? "gemini"
          : "custom"
        : "none";
  const cloudDb = env.databaseUrl.startsWith("libsql://") || env.databaseUrl.startsWith("https://");

  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="space-y-4">
        <Card>
          <CardTitle
            action={<Badge tone={ai.configured ? "success" : "warning"}>{ai.configured ? "aktiv" : "nicht eingerichtet"}</Badge>}
          >
            KI-Anbieter
          </CardTitle>
          {ai.source === "env" ? (
            <p className="text-sm text-muted">
              Festgelegt über Umgebungsvariablen: {ai.provider}, {ai.modelFast}
              {ai.modelStrong !== ai.modelFast && ` / ${ai.modelStrong}`}.
            </p>
          ) : (
            <AiSettingsForm
              current={{
                preset,
                keyHint: ai.keyHint,
                baseUrl: config.baseUrl,
                modelFast: config.modelFast,
                modelStrong: config.modelStrong,
                modelFallbacks: config.modelFallbacks.join(", "),
              }}
            />
          )}
          {usage.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Verbrauch (30 Tage)</p>
              <ul className="text-sm">
                {usage.map((u) => (
                  <li key={u.model}>
                    {u.model}: {u.calls} Anfragen · {(Number(u.input) / 1000).toFixed(0)}k Eingabe- /{" "}
                    {(Number(u.output) / 1000).toFixed(0)}k Ausgabe-Tokens
                    {Number(u.failed) > 0 && ` · ${u.failed} fehlgeschlagen`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle action={<Badge tone={hasPassword ? "success" : "warning"}>{hasPassword ? "an" : "aus"}</Badge>}>
            Passwortschutz
          </CardTitle>
          {passwordFromEnv() ? (
            <p className="text-sm text-muted">Das Passwort ist über APP_PASSWORD festgelegt.</p>
          ) : (
            <div className="space-y-4">
              {!hasPassword && (
                <Alert tone="warning">
                  Ohne Passwort kann jeder, der die Adresse kennt, AbiOS öffnen – samt deiner Materialien und deines
                  KI-Schlüssels. Du kannst hier jederzeit ein Passwort festlegen.
                </Alert>
              )}
              <PasswordForm hasPassword={hasPassword} />
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Datenschutz & Daten</CardTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Datenbank:{" "}
              {cloudDb ? (
                <>Turso (SQLite in der Cloud, jederzeit als Datei exportierbar)</>
              ) : (
                <>
                  SQLite-Datei <code className="break-all">{env.dataDir}/abios.db</code>
                </>
              )}
            </li>
            <li>
              Dateien:{" "}
              {storageMode() === "blob" ? (
                "Vercel Blob (privat, nur nach Anmeldung abrufbar)"
              ) : (
                <>
                  Ordner <code className="break-all">{env.dataDir}/files</code> (Originale, unverändert)
                </>
              )}
            </li>
            <li>An die KI gehen nur Aufgabe, deine Antwort und wenige passende Textausschnitte – keine Namen, keine Historie.</li>
            <li>Inhalte von KI-Anfragen werden nicht protokolliert, nur der Token-Verbrauch.</li>
            <li>Export, Import und automatische Backups folgen in Phase 4.</li>
          </ul>
        </Card>

        {hasPassword && (
        <Card>
          <CardTitle>Abmelden</CardTitle>
          <form action={logoutAction}>
            <Button variant="secondary" type="submit">
              Auf diesem Gerät abmelden
            </Button>
          </form>
        </Card>
        )}
      </div>
    </>
  );
}
