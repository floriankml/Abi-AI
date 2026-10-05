import Link from "next/link";
import { aiStatus } from "@/server/ai";
import { Alert } from "./ui";

export async function AiNotice() {
  if ((await aiStatus()).configured) return null;
  return (
    <div className="mb-4">
      <Alert tone="warning">
        Noch kein KI-Anbieter eingerichtet – Lernen und Üben brauchen eine KI.{" "}
        <Link href="/einstellungen" className="underline">
          Jetzt einrichten (kostenlos möglich)
        </Link>
      </Alert>
    </div>
  );
}
