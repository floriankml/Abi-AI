"use client";

import { useActionState } from "react";
import { setupAction } from "@/app/actions";
import { Alert, Button, Card, Field, inputClass } from "@/components/ui";

export function SetupForm({ needsCode, askForKey }: { needsCode: boolean; askForKey: boolean }) {
  const [state, action, pending] = useActionState(setupAction, undefined);
  return (
    <Card>
      <form action={action} className="space-y-4">
        {needsCode && (
          <Field label="Einrichtungscode" hint="Steht in der Nachricht, mit der du AbiOS bekommen hast.">
            <input name="setupCode" required autoComplete="off" className={inputClass} />
          </Field>
        )}
        <Field label="Neues Passwort" hint="Mindestens 8 Zeichen. Damit meldest du dich auf allen Geräten an.">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </Field>
        <Field label="Passwort wiederholen">
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </Field>
        {askForKey && (
          <Field
            label="Gemini-Schlüssel (optional, später änderbar)"
            hint="Kostenlos unter aistudio.google.com/apikey → „API-Schlüssel erstellen“."
          >
            <input name="geminiKey" type="password" autoComplete="off" className={inputClass} />
          </Field>
        )}
        {state?.error && <Alert>{state.error}</Alert>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Richte ein…" : "Einrichten & loslegen"}
        </Button>
      </form>
    </Card>
  );
}
