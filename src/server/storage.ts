import fs from "node:fs";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { env } from "./env";

/**
 * Ablage der Originaldateien – austauschbar wie die KI:
 * - lokal: Ordner DATA_DIR/files (Standard, Datenhoheit)
 * - Cloud: Vercel Blob, privat (wenn BLOB_READ_WRITE_TOKEN gesetzt ist)
 *
 * In der Datenbank steht der Speicherort: "<name>" (lokal) oder "blob:<pfad>".
 */

const BLOB_PREFIX = "blob:";

export const storageMode = (): "local" | "blob" => (env.blobToken ? "blob" : "local");

const filesDir = () => path.join(env.dataDir, "files");

function localPath(name: string): string {
  const abs = path.resolve(filesDir(), name);
  // Schutz vor Pfad-Tricks: nur innerhalb des Dateiordners.
  if (!abs.startsWith(path.resolve(filesDir()) + path.sep)) throw new Error("Ungültiger Pfad");
  return abs;
}

/** Speichert eine Datei und gibt den Speicherort für die Datenbank zurück. */
export async function saveFile(name: string, data: Buffer, contentType: string): Promise<string> {
  if (storageMode() === "blob") {
    const res = await put(`files/${name}`, data, {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: env.blobToken,
    });
    return BLOB_PREFIX + res.pathname;
  }
  fs.mkdirSync(filesDir(), { recursive: true });
  const abs = localPath(name);
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, data);
  return name;
}

/** Liest eine Datei (Datenbank-Speicherort oder Blob-Pfad eines Direkt-Uploads). */
export async function readFile(stored: string): Promise<Buffer | null> {
  if (stored.startsWith(BLOB_PREFIX)) {
    const res = await get(stored.slice(BLOB_PREFIX.length), { access: "private", token: env.blobToken });
    if (!res || !res.stream) return null;
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  const abs = localPath(stored);
  return fs.existsSync(abs) ? fs.readFileSync(abs) : null;
}

export async function deleteFile(stored: string): Promise<void> {
  if (stored.startsWith(BLOB_PREFIX)) {
    await del(stored.slice(BLOB_PREFIX.length), { token: env.blobToken });
    return;
  }
  fs.rmSync(localPath(stored), { force: true });
}

/** Speicherort für eine per Direkt-Upload hochgeladene Blob-Datei. */
export const blobStored = (pathname: string) => BLOB_PREFIX + pathname;
