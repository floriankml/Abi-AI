"use client";

import { useActionState, useState, useTransition } from "react";
import { saveAiSettingsAction, testAiAction, type ActionState } from "@/app/actions";
import { Alert, Button, Field, inputClass } from "@/components/ui";

type Current = {
  preset: "gemini" | "custom" | "anthropic" | "none";
  keyHint: string;
  baseUrl: string;
  modelFast: string;
  modelStrong: string;
  modelFallbacks: string;
};

export function AiSettingsForm({ current }: { current: Current }) {
  const [state, action, pending] = useActionState(saveAiSettingsAction, undefined);
  const [preset, setPreset] = useState<Current["preset"]>(current.preset === "none" ? "gemini" : current.preset);
  const [test, setTest] = useState<ActionState>(undefined);
  const [testing, startTest] = useTransition();

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <Field label="Anbieter">
          <select
            name="preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value as Current["preset"])}
            className={inputClass}
          >
            <option value="gemini">Google Gemini (kostenlos)</option>
            <option value="custom">Anderer Anbieter (OpenAI-kompatibel, z. B. Mistral, Ollama)</option>
            <option value="anthropic">Claude (Anthropic, kostenpflichtig)</option>
            <option value="none">Keine KI</option>
          </select>
        </Field>
        {preset !== "none" && (
          <Field
            label="API-Schlüssel"
            hint={
              preset === "gemini"
                ? "Kostenlos unter aistudio.google.com/apikey. Leer lassen = gespeicherten Schlüssel behalten."
                : "Leer lassen = gespeicherten Schlüssel behalten."
            }
          >
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={current.keyHint ? `gespeichert (${current.keyHint})` : ""}
              className={inputClass}
            />
          </Field>
        )}
        {preset !== "none" && (
          <details className="rounded-lg border border-border px-3 py-2 text-sm" open={preset !== "gemini"}>
            <summary className="cursor-pointer text-muted">Erweitert: Modelle</summary>
            <div className="mt-3 space-y-3">
              {preset === "custom" && (
                <Field label="Endpunkt (Base-URL)">
                  <input name="baseUrl" defaultValue={current.baseUrl} placeholder="https://api.mistral.ai/v1" className={inputClass} />
                </Field>
              )}
              <Field label="Modell (schnell)" hint={preset === "gemini" ? "Leer = Standard (gemini-3.8-flash)" : undefined}>
                <input name="modelFast" defaultValue={preset === current.preset ? current.modelFast : ""} className={inputClass} />
              </Field>
              <Field label="Modell (stark, optional)">
                <input name="modelStrong" defaultValue={preset === current.preset ? current.modelStrong : ""} className={inputClass} />
              </Field>
              {preset !== "anthropic" && (
                <Field label="Ausweichmodelle bei Überlastung (kommagetrennt)">
                  <input name="modelFallbacks" defaultValue={preset === current.preset ? current.modelFallbacks : ""} className={inputClass} />
                </Field>
              )}
            </div>
          </details>
        )}
        {state?.error && <Alert>{state.error}</Alert>}
        {state?.ok && <Alert tone="success">Gespeichert.</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Speichere…" : "Speichern"}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="secondary" disabled={testing} onClick={() => startTest(async () => setTest(await testAiAction()))}>
          {testing ? "Teste…" : "Verbindung testen"}
        </Button>
        {test?.error && <span className="text-sm text-danger">{test.error}</span>}
        {test?.ok && <span className="text-sm text-success">{test.message}</span>}
      </div>
    </div>
  );
}
