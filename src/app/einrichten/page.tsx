import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSetUp } from "@/server/auth";
import { aiConfigFromEnv } from "@/server/ai";
import { env } from "@/server/env";
import { AuthShell } from "@/components/auth-shell";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Einrichten" };

export default async function SetupPage() {
  await connection();
  if (await isSetUp()) redirect("/login");
  return (
    <AuthShell subtitle="Willkommen! Einmal kurz einrichten, dann kann es losgehen.">
      <SetupForm needsCode={!!env.setupCode} askForKey={!aiConfigFromEnv()} />
    </AuthShell>
  );
}
