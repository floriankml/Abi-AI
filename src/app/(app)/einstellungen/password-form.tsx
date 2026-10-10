"use client";

import { changePasswordAction, removePasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  return (
    <div className="space-y-6">
      <ActionForm
        action={changePasswordAction}
        submitLabel={hasPassword ? "Passwort ändern" : "Passwort festlegen"}
        successMessage="Passwort gespeichert. Andere Geräte müssen sich neu anmelden."
      >
        {hasPassword && (
          <Field label="Aktuelles Passwort">
            <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Neues Passwort">
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          </Field>
          <Field label="Wiederholen">
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          </Field>
        </div>
      </ActionForm>
      {hasPassword && (
        <details className="border-t border-border pt-4 text-sm">
          <summary className="cursor-pointer text-muted">Passwortschutz ausschalten</summary>
          <div className="mt-3">
            <ActionForm action={removePasswordAction} submitLabel="Passwort entfernen" variant="secondary" successMessage="Passwortschutz ist aus.">
              <Field label="Aktuelles Passwort zur Bestätigung">
                <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
              </Field>
            </ActionForm>
          </div>
        </details>
      )}
    </div>
  );
}
