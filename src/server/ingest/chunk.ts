export type PageText = { page: number | null; text: string };
export type Chunk = { page: number | null; text: string };

const TARGET = 1200;
const MAX = 1800;

/**
 * Teilt Text in Abschnitte von ca. TARGET Zeichen, bevorzugt an Absatzgrenzen.
 * Seitenzuordnung bleibt erhalten (Quellenangabe "S. 3").
 */
export function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    const paragraphs = normalize(text)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    let current = "";
    const flush = () => {
      if (current.trim()) chunks.push({ page, text: current.trim() });
      current = "";
    };
    for (const para of paragraphs) {
      for (const piece of splitLong(para)) {
        if (current && current.length + piece.length + 2 > TARGET) flush();
        current = current ? `${current}\n\n${piece}` : piece;
      }
    }
    flush();
  }
  return chunks;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Sehr lange Absätze an Satzgrenzen (notfalls hart) teilen. */
function splitLong(para: string): string[] {
  if (para.length <= MAX) return [para];
  const sentences = para.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length + 1 > TARGET) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur} ${s}` : s;
    while (cur.length > MAX) {
      out.push(cur.slice(0, TARGET));
      cur = cur.slice(TARGET);
    }
  }
  if (cur) out.push(cur);
  return out;
}
