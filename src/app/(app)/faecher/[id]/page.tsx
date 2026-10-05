import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Trash2 } from "lucide-react";
import {
  archiveSubjectAction,
  createTopicAction,
  deleteTopicAction,
  updateSubjectAction,
  updateTopicAction,
} from "@/app/actions";
import { buildTopicTree, flattenTree, getSubject, listTopics, type TopicNode } from "@/server/services/subjects";
import { listMaterials } from "@/server/services/materials";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { SubjectFields } from "@/components/subject-fields";
import { Card, CardTitle, EmptyState, Field, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { requireAuth } from "@/server/auth";

const WEIGHT_LABELS = ["kaum relevant", "normal", "wichtig", "sehr wichtig"];

export default async function SubjectPage({ params }: PageProps<"/faecher/[id]">) {
  await requireAuth();
  const { id } = await params;
  const subject = getSubject(id);
  if (!subject || subject.archivedAt) notFound();
  const tree = buildTopicTree(listTopics(id));
  const flat = flattenTree(tree);
  const materials = listMaterials({ subjectId: id });

  return (
    <>
      <PageHeader
        title={subject.name}
        description={
          <>
            {flat.length} Themen · {materials.length} Materialien ·{" "}
            <Link href={`/materialien?subject=${id}`} className="text-accent">
              Materialien verwalten
            </Link>
          </>
        }
        action={
          <Link href={`/lernen?subject=${id}`} className={buttonClass()}>
            <BookOpen className="size-4" /> Lernen
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>Themen</CardTitle>
          {tree.length === 0 ? (
            <EmptyState title="Noch keine Themen">
              Beispiel: „Analytische Geometrie“ → „Geraden“ → „Lagebeziehungen“.
            </EmptyState>
          ) : (
            <ul className="space-y-1">
              {flat.map((t) => (
                <TopicRow key={t.id} topic={t} />
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle>Thema hinzufügen</CardTitle>
            <ActionForm action={createTopicAction} submitLabel="Hinzufügen">
              <input type="hidden" name="subjectId" value={id} />
              <Field label="Titel">
                <input name="title" required maxLength={120} className={inputClass} placeholder="z. B. Lagebeziehungen" />
              </Field>
              <Field label="Übergeordnetes Thema">
                <select name="parentId" className={inputClass} defaultValue="">
                  <option value="">– keins (Hauptthema) –</option>
                  {flat.map((t) => (
                    <option key={t.id} value={t.id}>
                      {"  ".repeat(t.depth)}
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prüfungsrelevanz">
                <select name="examWeight" className={inputClass} defaultValue="1">
                  {WEIGHT_LABELS.map((l, i) => (
                    <option key={i} value={i}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </ActionForm>
          </Card>

          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer text-sm font-semibold">Fach bearbeiten</summary>
            <div className="mt-4 space-y-4">
              <ActionForm action={updateSubjectAction} submitLabel="Speichern" resetOnSuccess={false}>
                <SubjectFields subject={subject} />
              </ActionForm>
              <form action={archiveSubjectAction} className="border-t border-border pt-4">
                <input type="hidden" name="id" value={id} />
                <ConfirmButton
                  message="Fach archivieren? Es verschwindet aus den Listen, die Lernhistorie bleibt erhalten."
                  className={buttonClass("danger", "sm")}
                >
                  Fach archivieren
                </ConfirmButton>
              </form>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}

function TopicRow({ topic }: { topic: TopicNode }) {
  return (
    <li style={{ paddingLeft: `${topic.depth * 1.25}rem` }}>
      <details className="group rounded-lg hover:bg-surface-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 text-sm">
          <span className={topic.depth === 0 ? "font-medium" : ""}>{topic.title}</span>
          {topic.examWeight >= 2 && <span className="text-xs text-warning">★</span>}
          <Link
            href={`/lernen?subject=${topic.subjectId}&topic=${topic.id}`}
            className="ml-auto hidden text-xs text-accent group-hover:inline"
          >
            Lernen
          </Link>
        </summary>
        <div className="flex flex-wrap items-end gap-2 px-2 pb-3">
          <ActionForm
            action={updateTopicAction}
            submitLabel="Speichern"
            resetOnSuccess={false}
            variant="secondary"
            className="flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="id" value={topic.id} />
            <input name="title" defaultValue={topic.title} required className={`${inputClass} w-56`} />
            <select name="examWeight" defaultValue={topic.examWeight} className={`${inputClass} w-36`}>
              {WEIGHT_LABELS.map((l, i) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </ActionForm>
          <form action={deleteTopicAction}>
            <input type="hidden" name="id" value={topic.id} />
            <ConfirmButton
              message={`„${topic.title}“ und alle Unterthemen löschen? Materialien bleiben erhalten.`}
              className={buttonClass("ghost", "md")}
            >
              <Trash2 className="size-4" />
            </ConfirmButton>
          </form>
        </div>
      </details>
    </li>
  );
}
