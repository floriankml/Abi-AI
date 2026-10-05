"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import { Alert, Button, Card, Field, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <Field label="Passwort">
          <input name="password" type="password" required autoFocus autoComplete="current-password" className={inputClass} />
        </Field>
        {state?.error && <Alert>{state.error}</Alert>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Prüfe…" : "Anmelden"}
        </Button>
      </form>
    </Card>
  );
}
