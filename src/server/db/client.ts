import fs from "node:fs";
import path from "node:path";
import { createClient, type Client, type InValue } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import { env } from "../env";
import { seedIfEmpty } from "./seed";

/**
 * Datenbank: SQLite über libSQL.
 * - Lokal: Datei (DATA_DIR/abios.db) – wie bisher, offenes Format.
 * - Cloud: Turso (DATABASE_URL=libsql://…) – ebenfalls SQLite, jederzeit exportierbar.
 */
export type Db = LibSQLDatabase<typeof schema> & { $client: Client };

const globalForDb = globalThis as unknown as { abiosDb?: Promise<Db> };

export async function openDb(url: string, authToken?: string): Promise<Db> {
  if (url.startsWith("file:")) {
    fs.mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
  }
  const client = createClient({ url, authToken });
  if (url.startsWith("file:")) {
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000");
  }
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema }) as Db;
  await migrate(db, { migrationsFolder: path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
  await seedIfEmpty(db);
  return db;
}

/** Lazy-Singleton: erst beim ersten Zugriff öffnen (nicht beim Build). */
export function getDb(): Promise<Db> {
  if (!globalForDb.abiosDb) {
    const url = env.databaseUrl || `file:${path.join(env.dataDir, "abios.db")}`;
    globalForDb.abiosDb = openDb(url, env.databaseAuthToken || undefined).catch((err) => {
      globalForDb.abiosDb = undefined; // beim nächsten Aufruf erneut versuchen
      throw err;
    });
  }
  return globalForDb.abiosDb;
}

/** Rohe SQL-Abfrage (für FTS5, json_each, Fensterfunktionen). Liefert einfache Objekte. */
export async function queryAll<T>(sqlText: string, args: InValue[] = []): Promise<T[]> {
  const db = await getDb();
  const res = await db.$client.execute({ sql: sqlText, args });
  return res.rows.map((row) => Object.fromEntries(res.columns.map((c) => [c, row[c]])) as T);
}

export async function queryOne<T>(sqlText: string, args: InValue[] = []): Promise<T | undefined> {
  return (await queryAll<T>(sqlText, args))[0];
}
