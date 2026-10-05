import { subjectOptions } from "@/server/services/options";
import { listSessions } from "@/server/services/sessions";
import { AiNotice } from "@/components/ai-notice";
import { SessionList } from "@/components/session-list";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { PracticeStartForm } from "../lernen/start-form";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Üben" };

export default async function PracticePage({ searchParams }: PageProps<"/ueben">) {
  await requireAuth();
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Üben"
        description="Prüfungsnahe Aufgaben aus deinen Materialien – im Stil des Thüringer Abiturs."
      />
      <AiNotice />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>Aufgaben erstellen</CardTitle>
          <PracticeStartForm
            subjects={subjectOptions()}
            subjectId={typeof sp.subject === "string" ? sp.subject : undefined}
            topicId={typeof sp.topic === "string" ? sp.topic : undefined}
          />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>Letzte Übungen</CardTitle>
          <SessionList sessions={listSessions("practice", 8)} base="/ueben" />
        </Card>
      </div>
    </>
  );
}
