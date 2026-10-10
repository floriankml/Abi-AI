import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cloudSetupProblems } from "@/server/deployment";
import { CloudSetupHelp } from "@/components/cloud-setup-help";
import { isAuthenticated } from "@/server/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage() {
  await connection();
  if (cloudSetupProblems().length) return <CloudSetupHelp />;
  if (await isAuthenticated()) redirect("/");
  return (
    <AuthShell subtitle="Deine persönliche Lernplattform">
      <LoginForm />
    </AuthShell>
  );
}
