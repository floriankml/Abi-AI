"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { SubjectTopicSelect, type SubjectOption } from "@/components/subject-topic-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { CATEGORY_OPTIONS } from "./categories";

type Result = { name: string; ok: boolean; message: string };

export function UploadForm({ subjects, defaultSubjectId }: { subjects: SubjectOption[]; defaultSubjectId?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch("/api/materials", { method: "POST", body: new FormData(e.currentTarget) });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Upload fehlgeschlagen");
      else {
        setResults(json.results);
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      setError("Upload fehlgeschlagen – Verbindung prüfen.");
    } finally {
      setPending(false);
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
        {pending ? "Lade hoch und lese Text aus…" : "Hochladen"}
      </Button>
    </form>
  );
}
