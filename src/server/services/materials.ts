import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { env } from "../env";
import { materialChunks, materials, type MaterialCategory } from "../db/schema";
import { chunkPages } from "../ingest/chunk";
import { detectKind, extractText, type MaterialKind } from "../ingest/extract";

const filesDir = () => path.join(env.dataDir, "files");

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
  const relPath = `${sha256}.${ext}`;
  fs.mkdirSync(filesDir(), { recursive: true });
  const abs = path.join(filesDir(), relPath);
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, input.data);

  const extracted = await extractText(kind, input.data);
  const chunks = extracted.status === "ok" ? chunkPages(extracted.pages) : [];

  const db = getDb();
  return db.transaction((tx) => {
    const material = tx
      .insert(materials)
      .values({
        subjectId: input.subjectId,
        topicId: input.topicId,
        title: input.title.trim() || input.originalName,
        kind,
        category: input.category,
        originalName: input.originalName,
        filePath: relPath,
        mime: input.mime || "application/octet-stream",
        size: input.data.length,
        sha256,
        extractionStatus: extracted.status,
        extractionError: extracted.status === "failed" ? extracted.error.slice(0, 500) : null,
      })
      .returning()
      .get();
    chunks.forEach((c, i) =>
      tx
        .insert(materialChunks)
        .values({ materialId: material.id, position: i, page: c.page, text: c.text })
        .run(),
    );
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

export function listMaterials(filter: { subjectId?: string } = {}) {
  const db = getDb();
  const q = db.select().from(materials).orderBy(desc(materials.createdAt));
  return filter.subjectId ? q.where(eq(materials.subjectId, filter.subjectId)).all() : q.all();
}

export function getMaterial(id: string) {
  return getDb().select().from(materials).where(eq(materials.id, id)).get();
}

export function materialFilePath(relPath: string): string {
  const abs = path.resolve(filesDir(), relPath);
  // Schutz vor Pfad-Tricks: nur innerhalb des Dateiordners.
  if (!abs.startsWith(path.resolve(filesDir()) + path.sep)) throw new Error("Ungültiger Pfad");
  return abs;
}

export function deleteMaterial(id: string) {
  const db = getDb();
  const m = getMaterial(id);
  if (!m) return;
  db.delete(materials).where(eq(materials.id, id)).run();
  // Datei nur löschen, wenn kein anderes Material dieselbe Datei nutzt.
  const stillUsed = db.select().from(materials).where(eq(materials.sha256, m.sha256)).get();
  if (!stillUsed) fs.rmSync(materialFilePath(m.filePath), { force: true });
}

export function chunkCounts(): Map<string, number> {
  const rows = getDb()
    .$client.prepare("SELECT material_id AS id, COUNT(*) AS n FROM material_chunks GROUP BY material_id")
    .all() as { id: string; n: number }[];
  return new Map(rows.map((r) => [r.id, r.n]));
}
