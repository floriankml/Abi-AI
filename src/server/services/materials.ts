import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb, queryAll } from "../db/client";
import { env } from "../env";
import { materialChunks, materials, type MaterialCategory } from "../db/schema";
import { chunkPages } from "../ingest/chunk";
import { detectKind, extractText, type MaterialKind } from "../ingest/extract";
import { deleteFile, readFile, saveFile } from "../storage";

const EXT_BY_KIND: Record<MaterialKind, string> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  image: "",
  text: "txt",
  note: "md",
};

export class MaterialError extends Error {}

/**
 * Speichert eine Datei unverändert (Name = SHA-256), extrahiert Text und
 * legt Abschnitte für die Volltextsuche an.
 *
 * `storedAt`: Datei liegt bereits im Speicher (Direkt-Upload in die Cloud).
 */
export async function addMaterial(input: {
  data: Buffer;
  originalName: string;
  mime: string;
  subjectId: string;
  topicId: string | null;
  category: MaterialCategory;
  title: string;
  kind?: MaterialKind;
  storedAt?: string;
}) {
  if (input.data.length > env.maxUploadMb * 1024 * 1024) {
    throw new MaterialError(`Datei ist größer als ${env.maxUploadMb} MB.`);
  }
  const kind = input.kind ?? detectKind(input.originalName, input.mime);
  if (!kind) {
    throw new MaterialError("Dateityp wird nicht unterstützt (PDF, DOCX, PPTX, Bilder, TXT, MD).");
  }

  const sha256 = createHash("sha256").update(input.data).digest("hex");
  const origExt = input.originalName.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1];
  const ext = EXT_BY_KIND[kind] || origExt || "bin";
  const mime = input.mime || "application/octet-stream";
  const filePath = input.storedAt ?? (await saveFile(`${sha256}.${ext}`, input.data, mime));

  const extracted = await extractText(kind, input.data);
  const chunks = extracted.status === "ok" ? chunkPages(extracted.pages) : [];

  const db = await getDb();
  return db.transaction(async (tx) => {
    const material = await tx
      .insert(materials)
      .values({
        subjectId: input.subjectId,
        topicId: input.topicId,
        title: input.title.trim() || input.originalName,
        kind,
        category: input.category,
        originalName: input.originalName,
        filePath,
        mime,
        size: input.data.length,
        sha256,
        extractionStatus: extracted.status,
        extractionError: extracted.status === "failed" ? extracted.error.slice(0, 500) : null,
      })
      .returning()
      .get();
    if (chunks.length) {
      await tx.insert(materialChunks).values(
        chunks.map((c, i) => ({ materialId: material.id, position: i, page: c.page, text: c.text })),
      );
    }
    return { material, chunkCount: chunks.length };
  });
}

/** Notizen werden als Markdown-Datei gespeichert – ein Weg für alle Inhalte. */
export function addNote(input: {
  subjectId: string;
  topicId: string | null;
  title: string;
  text: string;
  category: MaterialCategory;
}) {
  const safe = input.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "Notiz";
  return addMaterial({
    data: Buffer.from(input.text, "utf8"),
    originalName: `${safe}.md`,
    mime: "text/markdown",
    subjectId: input.subjectId,
    topicId: input.topicId,
    category: input.category,
    title: input.title,
    kind: "note",
  });
}

export async function listMaterials(filter: { subjectId?: string } = {}) {
  const db = await getDb();
  const q = db.select().from(materials).orderBy(desc(materials.createdAt));
  return filter.subjectId ? q.where(eq(materials.subjectId, filter.subjectId)) : q;
}

export async function getMaterial(id: string) {
  const db = await getDb();
  return db.select().from(materials).where(eq(materials.id, id)).get();
}

export function readMaterialFile(filePath: string) {
  return readFile(filePath);
}

export async function deleteMaterial(id: string) {
  const db = await getDb();
  const m = await getMaterial(id);
  if (!m) return;
  await db.delete(materials).where(eq(materials.id, id));
  // Datei nur löschen, wenn kein anderes Material dieselbe Datei nutzt.
  const stillUsed = await db.select().from(materials).where(eq(materials.filePath, m.filePath)).get();
  if (!stillUsed) await deleteFile(m.filePath);
}

export async function chunkCounts(): Promise<Map<string, number>> {
  const rows = await queryAll<{ id: string; n: number }>(
    "SELECT material_id AS id, COUNT(*) AS n FROM material_chunks GROUP BY material_id",
  );
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
}
