import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAuthenticated } from "@/server/auth";
import { env } from "@/server/env";
import { storageMode } from "@/server/storage";

/**
 * Cloud-Betrieb: Der Browser lädt Dateien direkt in den privaten Blob-Speicher
 * (umgeht die 4,5-MB-Grenze für Anfragen). Hier wird nur ein kurzlebiges,
 * auf einen Pfad beschränktes Upload-Token ausgestellt – und nur nach Anmeldung.
 */
export async function POST(request: Request) {
  if (storageMode() !== "blob") return NextResponse.json({ error: "Nicht aktiv" }, { status: 404 });
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  try {
    const body = (await request.json()) as HandleUploadBody;
    const res = await handleUpload({
      body,
      request,
      token: env.blobToken,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("uploads/")) throw new Error("Ungültiger Pfad");
        return {
          maximumSizeInBytes: env.maxUploadMb * 1024 * 1024,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 400 });
  }
}
