"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";
import { Alert, Button } from "./ui";

/** Formular für Server Actions mit Fehleranzeige und Ladezustand. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  children,
  className,
  resetOnSuccess = true,
  variant = "primary",
  successMessage,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  variant?: "primary" | "secondary";
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className ?? "space-y-4"}>
      {children}
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.ok && successMessage && <Alert tone="success">{successMessage}</Alert>}
      <Button type="submit" disabled={pending} variant={variant}>
        {pending ? (pendingLabel ?? "Speichere…") : submitLabel}
      </Button>
    </form>
  );
}

/** Button für einfache Formular-Aktionen mit Sicherheitsabfrage. */
export function ConfirmButton({
  message,
  children,
  className,
}: {
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
