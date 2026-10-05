import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/server/auth";
import { MATERIAL_CATEGORIES } from "@/server/db/schema";
import { MaterialError, addMaterial } from "@/server/services/materials";
import { getSubject } from "@/server/services/subjects";
import { blobStored, deleteFile, readFile, storageMode } from "@/server/storage";

// Textauslesen großer PDFs kann dauern.
export const maxDuration = 120;

const metaSchema = z.object({
  subjectId: z.string().min(1),
  topicId: z
    .string()
    .nullish()
    .transform((v) => v || null),
  category: z.enum(MATERIAL_CATEGORIES),
  title: z.string().max(200).nullish().transform((v) => v ?? ""),
});

type Item = { name: string; mime: string; load: () => Promise<Buffer | null>; storedAt?: string };

/**
 * Material hochladen.
 * - lokal: multipart/form-data mit den Dateien
 * - Cloud: JSON mit Pfaden der bereits direkt in den Blob-Speicher geladenen Dateien
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  let rawMeta: Record<string, unknown>;
  let items: Item[];
  if (request.headers.get("content-type")?.includes("application/json")) {
    if (storageMode() !== "blob") return NextResponse.json({ error: "Nicht aktiv" }, { status: 400 });
    const body = z
      .object({
        uploads: z
          .array(z.object({ pathname: z.string().startsWith("uploads/"), name: z.string(), type: z.string() }))
          .min(1)
          .max(20),
      })
      .passthrough()
      .safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    rawMeta = body.data;
    items = body.data.uploads.map((u) => ({
      name: u.name,
      mime: u.type,
      storedAt: blobStored(u.pathname),
      load: () => readFile(blobStored(u.pathname)),
    }));
  } else {
    const form = await request.formData();
    rawMeta = Object.fromEntries(["subjectId", "topicId", "category", "title"].map((k) => [k, form.get(k)]));
    items = form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .map((f) => ({ name: f.name, mime: f.type, load: async () => Buffer.from(await f.arrayBuffer()) }));
  }

  const meta = metaSchema.safeParse(rawMeta);
  if (!meta.success || !(await getSubject(meta.data.subjectId))) {
    return NextResponse.json({ error: "Bitte Fach und Kategorie wählen." }, { status: 400 });
  }
  if (items.length === 0) return NextResponse.json({ error: "Keine Datei ausgewählt." }, { status: 400 });

  const results: { name: string; ok: boolean; message: string }[] = [];
  for (const item of items) {
    try {
      const data = await item.load();
      if (!data) throw new MaterialError("Datei nicht gefunden – bitte erneut hochladen.");
      const { material, chunkCount } = await addMaterial({
        data,
        originalName: item.name,
        mime: item.mime,
        subjectId: meta.data.subjectId,
        topicId: meta.data.topicId,
        category: meta.data.category,
        storedAt: item.storedAt,
        // Titel nur bei Einzeldatei übernehmen.
        title: items.length === 1 && meta.data.title ? meta.data.title : item.name.replace(/\.[^.]+$/, ""),
      });
      const message =
        material.extractionStatus === "ok"
          ? `${chunkCount} Abschnitte erkannt`
          : material.extractionStatus === "unsupported"
            ? "gespeichert (Texterkennung für Bilder folgt)"
            : material.extractionStatus === "empty"
              ? "gespeichert, aber kein Text gefunden (gescannt?)"
              : "gespeichert, Textauslesen fehlgeschlagen";
      results.push({ name: item.name, ok: true, message });
    } catch (err) {
      // Direkt hochgeladene Datei wieder entfernen, wenn sie nicht übernommen wurde.
      if (item.storedAt) await deleteFile(item.storedAt).catch(() => undefined);
      results.push({
        name: item.name,
        ok: false,
        message: err instanceof MaterialError ? err.message : "Fehler beim Speichern",
      });
      if (!(err instanceof MaterialError)) console.error(err);
    }
  }
  return NextResponse.json({ results });
}
