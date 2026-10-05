import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/server/auth";
import { MATERIAL_CATEGORIES } from "@/server/db/schema";
import { MaterialError, addMaterial } from "@/server/services/materials";
import { getSubject } from "@/server/services/subjects";

/** Datei-Upload (Route Handler statt Server Action: keine 1-MB-Grenze). */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const form = await request.formData();
  const meta = z
    .object({
      subjectId: z.string().min(1),
      topicId: z.string().optional().transform((v) => v || null),
      category: z.enum(MATERIAL_CATEGORIES),
      title: z.string().max(200).optional().default(""),
    })
    .safeParse({
      subjectId: form.get("subjectId"),
      topicId: form.get("topicId") ?? undefined,
      category: form.get("category"),
      title: form.get("title") ?? undefined,
    });
  if (!meta.success || !getSubject(meta.data.subjectId)) {
    return NextResponse.json({ error: "Bitte Fach und Kategorie wählen." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "Keine Datei ausgewählt." }, { status: 400 });

  const results: { name: string; ok: boolean; message: string }[] = [];
  for (const file of files) {
    try {
      const { material, chunkCount } = await addMaterial({
        data: Buffer.from(await file.arrayBuffer()),
        originalName: file.name,
        mime: file.type,
        subjectId: meta.data.subjectId,
        topicId: meta.data.topicId,
        category: meta.data.category,
        // Titel nur bei Einzeldatei übernehmen.
        title: files.length === 1 && meta.data.title ? meta.data.title : file.name.replace(/\.[^.]+$/, ""),
      });
      const message =
        material.extractionStatus === "ok"
          ? `${chunkCount} Abschnitte erkannt`
          : material.extractionStatus === "unsupported"
            ? "gespeichert (Texterkennung für Bilder folgt)"
            : material.extractionStatus === "empty"
              ? "gespeichert, aber kein Text gefunden (gescannt?)"
              : "gespeichert, Textauslesen fehlgeschlagen";
      results.push({ name: file.name, ok: true, message });
    } catch (err) {
      results.push({
        name: file.name,
        ok: false,
        message: err instanceof MaterialError ? err.message : "Fehler beim Speichern",
      });
      if (!(err instanceof MaterialError)) console.error(err);
    }
  }
  return NextResponse.json({ results });
}
