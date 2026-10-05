import { logoutAction } from "@/app/actions";
import { aiStatus } from "@/server/ai";
import { authEnabled } from "@/server/auth";
import { env } from "@/server/env";
import { aiUsageSummary } from "@/server/services/usage";
import { Alert, Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  await requireAuth();
  const ai = aiStatus();
  const usage = aiUsageSummary(30);
  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="space-y-4">
        <Card>
          <CardTitle action={<Badge tone={ai.configured ? "success" : "warning"}>{ai.configured ? "aktiv" : "nicht eingerichtet"}</Badge>}>
            KI-Anbieter
          </CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Anbieter</dt>
            <dd>{ai.provider}</dd>
            <dt className="text-muted">Modell (schnell)</dt>
            <dd>{ai.modelFast || "–"}</dd>
            <dt className="text-muted">Modell (stark)</dt>
            <dd>{ai.modelStrong || "–"}</dd>
            {ai.baseUrl && (
              <>
                <dt className="text-muted">Endpunkt</dt>
                <dd className="break-all">{ai.baseUrl}</dd>
              </>
            )}
          </dl>
          <p className="mt-4 text-sm text-muted">
            Der Anbieter wird in der Datei <code>.env</code> festgelegt (<code>AI_PROVIDER</code>, <code>AI_BASE_URL</code>,{" "}
            <code>AI_API_KEY</code>, <code>AI_MODEL_FAST</code>, <code>AI_MODEL_STRONG</code>) und ist jederzeit austauschbar.
            Vorlagen für Google Gemini (kostenlos), Ollama (lokal), Mistral, OpenAI und Claude stehen in{" "}
            <code>.env.example</code>.
          </p>
          {usage.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Verbrauch (30 Tage)</p>
              <ul className="text-sm">
                {usage.map((u) => (
                  <li key={u.model}>
                    {u.model}: {u.calls} Anfragen · {(u.input / 1000).toFixed(0)}k Eingabe- / {(u.output / 1000).toFixed(0)}k
                    Ausgabe-Tokens{u.failed > 0 && ` · ${u.failed} fehlgeschlagen`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Datenschutz & Daten</CardTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Alle Daten liegen in deinem Datenordner: <code className="break-all">{env.dataDir}</code> (SQLite-Datenbank
              <code> abios.db</code> + Originaldateien in <code>files/</code>).
            </li>
            <li>An die KI gehen nur Aufgabe, deine Antwort und wenige passende Textausschnitte – keine Namen, keine Historie.</li>
            <li>Inhalte von KI-Anfragen werden nicht protokolliert, nur der Token-Verbrauch.</li>
            <li>Export, Import und automatische Backups folgen in Phase 4. Bis dahin: Datenordner kopieren.</li>
          </ul>
        </Card>

        <Card>
          <CardTitle>Anmeldung</CardTitle>
          {authEnabled() ? (
            <form action={logoutAction}>
              <Button variant="secondary" type="submit">
                Abmelden
              </Button>
            </form>
          ) : (
            <Alert tone="warning">
              Kein Passwort gesetzt (<code>APP_PASSWORD</code>). Das ist nur für die Nutzung allein auf dem eigenen Rechner
              in Ordnung.
            </Alert>
          )}
        </Card>
      </div>
    </>
  );
}
