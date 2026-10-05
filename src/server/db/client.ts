import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { env } from "../env";
import { seedIfEmpty } from "./seed";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const globalForDb = globalThis as unknown as { abiosDb?: Db };

/** Öffnet eine Datenbank, führt Migrationen aus und legt Startdaten an. */
export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema }) as Db;
  migrate(db, { migrationsFolder: path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
  seedIfEmpty(db);
  return db;
}

/** Lazy-Singleton: erst beim ersten Zugriff öffnen (nicht beim Build). */
export function getDb(): Db {
  if (!globalForDb.abiosDb) {
    globalForDb.abiosDb = openDb(path.join(env.dataDir, "abios.db"));
  }
  return globalForDb.abiosDb;
}
