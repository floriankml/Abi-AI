import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { addNoteAction, deleteMaterialAction } from "@/app/actions";
import { chunkCounts, listMaterials } from "@/server/services/materials";
import { subjectOptions } from "@/server/services/options";
import { listSubjects, topicPath } from "@/server/services/subjects";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { SubjectTopicSelect } from "@/components/subject-topic-select";
import { Badge, Card, CardTitle, EmptyState, Field, PageHeader, SubjectDot, buttonClass, cx, inputClass } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/format";
import { CATEGORY_LABELS } from "./categories";
import { UploadForm } from "./upload-form";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Materialien" };

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  ok: { label: "Text erkannt", tone: "success" },
  empty: { label: "kein Text", tone: "warning" },
  unsupported: { label: "nur gespeichert", tone: "neutral" },
  failed: { label: "Fehler", tone: "danger" },
};

export default async function MaterialsPage({ searchParams }: PageProps<"/materialien">) {
  await requireAuth();
  const sp = await searchParams;
  const subjectFilter = typeof sp.subject === "string" ? sp.subject : undefined;
  const subjects = listSubjects();
  const options = subjectOptions();
  const materials = listMaterials({ subjectId: subjectFilter });
  const chunks = chunkCounts();
  const bySubject = new Map(subjects.map((s) => [s.id, s]));

  return (
    <>
      <PageHeader
        title="Materialien"
        description="Deine Notizen und alte Abituraufgaben sind die Grundlage für alle Aufgaben. Originaldateien bleiben unverändert erhalten."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Dateien hochladen</CardTitle>
          <UploadForm subjects={options} defaultSubjectId={subjectFilter} />
        </Card>
        <Card>
          <CardTitle>Notiz schreiben</CardTitle>
          <ActionForm action={addNoteAction} submitLabel="Notiz speichern">
            <div className="grid gap-4 sm:grid-cols-2">
              <SubjectTopicSelect subjects={options} defaultSubjectId={subjectFilter} />
            </div>
            <input type="hidden" name="category" value="notes" />
            <Field label="Titel">
              <input name="title" required maxLength={200} className={inputClass} />
            </Field>
            <Field label="Inhalt" hint="Markdown und LaTeX ($…$) möglich.">
              <textarea name="text" required rows={6} className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <FilterLink href="/materialien" active={!subjectFilter}>
          Alle
        </FilterLink>
        {subjects.map((s) => (
          <FilterLink key={s.id} href={`/materialien?subject=${s.id}`} active={subjectFilter === s.id}>
            {s.name}
          </FilterLink>
        ))}
      </div>

      {materials.length === 0 ? (
        <EmptyState title="Noch keine Materialien">
          Tipp: Alte Abituraufgaben als „Alte Abituraufgabe“ hochladen – sie dienen als Vorbild für Niveau und Stil.
        </EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {materials.map((m) => {
              const s = bySubject.get(m.subjectId);
              const status = STATUS[m.extractionStatus];
              const path = topicPath(m.topicId);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <SubjectDot color={s?.color ?? "#999"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="truncate text-xs text-muted">
                      {s?.name ?? "archiviertes Fach"}
                      {path.length > 0 && ` · ${path.join(" → ")}`} · {m.kind.toUpperCase()} · {formatBytes(m.size)} ·{" "}
                      {formatDate(m.createdAt)}
                      {m.extractionStatus === "ok" && ` · ${chunks.get(m.id) ?? 0} Abschnitte`}
                    </p>
                  </div>
                  <Badge tone={m.category === "past_exam" ? "accent" : "neutral"}>{CATEGORY_LABELS[m.category]}</Badge>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <a href={`/api/materials/${m.id}/file`} target="_blank" rel="noopener" className={buttonClass("ghost", "sm")} aria-label="Öffnen">
                    <Download className="size-4" />
                  </a>
                  <form action={deleteMaterialAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmButton message={`„${m.title}“ löschen?`} className={buttonClass("ghost", "sm")}>
                      <Trash2 className="size-4" />
                    </ConfirmButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        "rounded-full border px-3 py-1 text-xs",
        active ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-text",
      )}
    >
      {children}
    </Link>
  );
}

