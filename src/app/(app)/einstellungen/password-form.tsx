"use client";

import { changePasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} submitLabel="Passwort ändern" successMessage="Passwort geändert. Andere Geräte sind abgemeldet.">
      <Field label="Aktuelles Passwort">
        <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Neues Passwort">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </Field>
        <Field label="Wiederholen">
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </Field>
      </div>
    </ActionForm>
  );
}
