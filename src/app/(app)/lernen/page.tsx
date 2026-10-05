import { subjectOptions } from "@/server/services/options";
import { listSessions } from "@/server/services/sessions";
import { AiNotice } from "@/components/ai-notice";
import { SessionList } from "@/components/session-list";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { LearnStartForm } from "./start-form";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Lernen" };

export default async function LearnPage({ searchParams }: PageProps<"/lernen">) {
  await requireAuth();
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Lernen"
        description="Erst ein paar kurze Fragen zu deinem Stand, dann gezielte Hinweise und Erklärungen – und eine Kontrollfrage, ob es sitzt."
      />
      <AiNotice />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>Neue Lerneinheit</CardTitle>
          <LearnStartForm
            subjects={subjectOptions()}
            subjectId={typeof sp.subject === "string" ? sp.subject : undefined}
            topicId={typeof sp.topic === "string" ? sp.topic : undefined}
          />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>Letzte Lerneinheiten</CardTitle>
          <SessionList sessions={listSessions("learn", 8)} base="/lernen" />
        </Card>
      </div>
    </>
  );
}
