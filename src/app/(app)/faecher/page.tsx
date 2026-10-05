import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createSubjectAction } from "@/app/actions";
import { listSubjects, listTopics } from "@/server/services/subjects";
import { listMaterials } from "@/server/services/materials";
import { ActionForm } from "@/components/action-form";
import { SubjectFields } from "@/components/subject-fields";
import { Badge, Card, CardTitle, PageHeader, SubjectDot } from "@/components/ui";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Fächer & Themen" };

export default async function SubjectsPage() {
  await requireAuth();
  const subjects = listSubjects();
  return (
    <>
      <PageHeader
        title="Fächer & Themen"
        description="Lege für jedes Fach deine Themen an – sie sind die Grundlage für Lernen, Üben und Fortschritt."
      />
      <Card className="mb-6 p-0">
        <ul className="divide-y divide-border">
          {subjects.map((s) => {
            const topicCount = listTopics(s.id).length;
            const materialCount = listMaterials({ subjectId: s.id }).length;
            return (
              <li key={s.id}>
                <Link href={`/faecher/${s.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2">
                  <SubjectDot color={s.color} />
                  <span className="flex-1 font-medium">{s.name}</span>
                  {s.level && <Badge tone={s.level === "eA" ? "accent" : "neutral"}>{s.level}</Badge>}
                  <span className="hidden w-40 text-right text-xs text-muted sm:block">
                    {topicCount} Themen · {materialCount} Materialien
                  </span>
                  <ChevronRight className="size-4 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardTitle>Fach hinzufügen</CardTitle>
        <ActionForm action={createSubjectAction} submitLabel="Fach anlegen">
          <SubjectFields />
        </ActionForm>
      </Card>
    </>
  );
}
