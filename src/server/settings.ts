import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { settings } from "./db/schema";

/**
 * Einstellungen in der Datenbank (Schlüssel/Wert). Damit lässt sich AbiOS
 * komplett im Browser einrichten – ohne .env, z. B. vom iPad aus.
 * Umgebungsvariablen haben immer Vorrang.
 */
export type SettingKey =
  | "auth.passwordHash"
  | "auth.sessionSecret"
  | "auth.loginFailures"
  | "ai.config";

export async function getSetting<T>(key: SettingKey): Promise<T | undefined> {
  const db = await getDb();
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value as T | undefined;
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  const db = await getDb();
  await db.delete(settings).where(eq(settings.key, key));
}
