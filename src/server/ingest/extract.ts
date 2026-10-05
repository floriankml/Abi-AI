import JSZip from "jszip";
import type { PageText } from "./chunk";

export type MaterialKind = "pdf" | "docx" | "pptx" | "image" | "text" | "note";

export function detectKind(fileName: string, mime: string): MaterialKind | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext) || mime.startsWith("image/"))
    return "image";
  if (["txt", "md", "markdown"].includes(ext) || mime.startsWith("text/")) return "text";
  return null;
}

export type ExtractResult =
  | { status: "ok"; pages: PageText[] }
  | { status: "empty" | "unsupported"; pages: [] }
  | { status: "failed"; pages: []; error: string };

/** Extrahiert Text lokal – keine externen Dienste. */
export async function extractText(kind: MaterialKind, data: Buffer): Promise<ExtractResult> {
  try {
    let pages: PageText[];
    switch (kind) {
      case "pdf":
        pages = await extractPdf(data);
        break;
      case "docx":
        pages = await extractDocx(data);
        break;
      case "pptx":
        pages = await extractPptx(data);
        break;
      case "text":
      case "note":
        pages = [{ page: null, text: data.toString("utf8") }];
        break;
      case "image":
        // OCR folgt in Phase 4. Das Bild wird trotzdem gespeichert.
        return { status: "unsupported", pages: [] };
    }
    const hasText = pages.some((p) => p.text.trim().length > 20);
    return hasText ? { status: "ok", pages } : { status: "empty", pages: [] };
  } catch (err) {
    return { status: "failed", pages: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function extractPdf(data: Buffer): Promise<PageText[]> {
  const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(data));
  const { text } = await pdfText(doc, { mergePages: false });
  return text.map((t, i) => ({ page: i + 1, text: t }));
}

async function extractDocx(data: Buffer): Promise<PageText[]> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: data });
  return [{ page: null, text: value }];
}

/** PPTX = ZIP mit XML je Folie; Text steht in <a:t>-Elementen. Folie = "Seite". */
async function extractPptx(data: Buffer): Promise<PageText[]> {
  const zip = await JSZip.loadAsync(data);
  const slideNo = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNo(a) - slideNo(b));
  const pages: PageText[] = [];
  for (const name of slides) {
    const n = slideNo(name);
    const xml = await zip.file(name)!.async("string");
    const notes = await zip.file(`ppt/notesSlides/notesSlide${n}.xml`)?.async("string");
    const text = [xmlText(xml), notes ? xmlText(notes) : ""].filter(Boolean).join("\n\n");
    pages.push({ page: n, text });
  }
  return pages;
}

function xmlText(xml: string): string {
  return xml
    .split(/<\/a:p>/)
    .map((p) =>
      [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
        .map((m) => decodeXml(m[1]))
        .join(""),
    )
    .filter((l) => l.trim())
    .join("\n");
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
