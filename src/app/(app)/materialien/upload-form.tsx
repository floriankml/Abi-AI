"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Upload } from "lucide-react";
import { SubjectTopicSelect, type SubjectOption } from "@/components/subject-topic-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { CATEGORY_OPTIONS } from "./categories";

type Result = { name: string; ok: boolean; message: string };

export function UploadForm({
  subjects,
  defaultSubjectId,
  directUpload,
}: {
  subjects: SubjectOption[];
  defaultSubjectId?: string;
  /** Cloud-Betrieb: Dateien direkt in den Blob-Speicher laden (keine Größengrenze der Anfrage). */
  directUpload: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  async function send(form: FormData): Promise<Response> {
    if (!directUpload) return fetch("/api/materials", { method: "POST", body: form });
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const uploads = [];
    for (const [i, file] of files.entries()) {
      setProgress(`Lade ${i + 1}/${files.length} hoch: ${file.name}`);
      const blob = await upload(`uploads/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/materials/upload-token",
        multipart: file.size > 8 * 1024 * 1024,
        contentType: file.type || undefined,
      });
      uploads.push({ pathname: blob.pathname, name: file.name, type: file.type });
    }
    setProgress("Lese Text aus…");
    return fetch("/api/materials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uploads,
        subjectId: form.get("subjectId"),
        topicId: form.get("topicId"),
        category: form.get("category"),
        title: form.get("title"),
      }),
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResults([]);
    try {
      const res = await send(new FormData(e.currentTarget));
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Upload fehlgeschlagen");
      else {
        setResults(json.results);
        formRef.current?.reset();
        router.refresh();
      }
    } catch (err) {
      setError(`Upload fehlgeschlagen – ${err instanceof Error ? err.message : "Verbindung prüfen."}`);
    } finally {
      setPending(false);
      setProgress(null);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SubjectTopicSelect subjects={subjects} defaultSubjectId={defaultSubjectId} />
        <Field label="Art">
          <select name="category" className={inputClass} defaultValue="notes">
            {CATEGORY_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titel (optional, bei einer Datei)">
          <input name="title" maxLength={200} className={inputClass} />
        </Field>
      </div>
      <Field label="Dateien" hint="PDF, Word (.docx), PowerPoint (.pptx), Bilder, Text/Markdown. Mehrere möglich.">
        <input
          name="files"
          type="file"
          multiple
          required
          accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,image/*"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      {results.length > 0 && (
        <ul className="space-y-1 text-sm">
          {results.map((r) => (
            <li key={r.name} className={r.ok ? "text-success" : "text-danger"}>
              {r.name}: {r.message}
            </li>
          ))}
        </ul>
      )}
      <Button type="submit" disabled={pending}>
        <Upload className="size-4" />
        {pending ? (progress ?? "Lade hoch und lese Text aus…") : "Hochladen"}
      </Button>
    </form>
  );
}
