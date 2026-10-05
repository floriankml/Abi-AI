import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authEnabled, isAuthenticated } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage() {
  await connection();
  if (!authEnabled() || (await isAuthenticated())) redirect("/");
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Abi<span className="text-accent">OS</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Deine persönliche Lernplattform</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
