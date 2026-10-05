import fs from "node:fs";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/server/auth";
import { getMaterial, materialFilePath } from "@/server/services/materials";
import type { Material } from "@/server/db/schema";

const SAFE_IMAGE = /^image\/(png|jpeg|webp|gif)$/;

/** Content-Type aus dem erkannten Typ ableiten – nie ungeprüft vom Upload übernehmen. */
function safeType(m: Material): { type: string; inline: boolean } {
  switch (m.kind) {
    case "pdf":
      return { type: "application/pdf", inline: true };
    case "text":
    case "note":
      return { type: "text/plain; charset=utf-8", inline: true };
    case "image":
      return SAFE_IMAGE.test(m.mime)
        ? { type: m.mime, inline: true }
        : { type: "application/octet-stream", inline: false };
    case "docx":
      return { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false };
    case "pptx":
      return { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", inline: false };
  }
}

/** Liefert die unveränderte Originaldatei aus. */
export async function GET(_: Request, ctx: RouteContext<"/api/materials/[id]/file">) {
  if (!(await isAuthenticated())) return new NextResponse("Nicht angemeldet", { status: 401 });
  const { id } = await ctx.params;
  const m = getMaterial(id);
  if (!m) return new NextResponse("Nicht gefunden", { status: 404 });
  const file = materialFilePath(m.filePath);
  if (!fs.existsSync(file)) return new NextResponse("Datei fehlt", { status: 404 });
  const data = fs.readFileSync(file);
  const { type, inline } = safeType(m);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(m.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
