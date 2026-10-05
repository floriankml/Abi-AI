import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cloudSetupProblems } from "@/server/deployment";
import { CloudSetupHelp } from "@/components/cloud-setup-help";
import { isSetUp } from "@/server/auth";
import { aiConfigFromEnv } from "@/server/ai";
import { env } from "@/server/env";
import { AuthShell } from "@/components/auth-shell";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Einrichten" };

export default async function SetupPage() {
  await connection();
  if (cloudSetupProblems().length) return <CloudSetupHelp />;
  if (await isSetUp()) redirect("/login");
  return (
    <AuthShell subtitle="Willkommen! Einmal kurz einrichten, dann kann es losgehen.">
      <SetupForm needsCode={!!env.setupCode} askForKey={!aiConfigFromEnv()} />
    </AuthShell>
  );
}
