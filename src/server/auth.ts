import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { env } from "./env";
import { getSetting, setSetting } from "./settings";

/**
 * Einzelnutzer-Anmeldung mit einem Passwort und signiertem Sitzungs-Cookie.
 *
 * Das Passwort kommt aus APP_PASSWORD (Vorrang) oder wird bei der Einrichtung
 * im Browser festgelegt und als scrypt-Hash in der Datenbank gespeichert.
 */

export const SESSION_COOKIE = "abios_session";
const SESSION_DAYS = 30;
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Passwort per Umgebungsvariable fest vorgegeben (dann nicht in der App änderbar). */
export const passwordFromEnv = () => env.appPassword.length > 0;

/** Ist ein Passwort festgelegt? Sonst muss AbiOS zuerst eingerichtet werden. */
export async function isSetUp(): Promise<boolean> {
  return passwordFromEnv() || !!(await getSetting<string>("auth.passwordHash"));
}

async function getSecret(): Promise<Buffer> {
  if (env.sessionSecret) return Buffer.from(env.sessionSecret);
  let s = await getSetting<string>("auth.sessionSecret");
  if (!s) {
    s = randomBytes(32).toString("hex");
    await setSetting("auth.sessionSecret", s);
  }
  return Buffer.from(s);
}

const sign = async (payload: string) =>
  createHmac("sha256", await getSecret()).update(payload).digest("hex");

export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return `${exp}.${await sign(String(exp))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(await sign(exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function isAuthenticated(): Promise<boolean> {
  // Immer zur Anfragezeit ausführen – nie beim Build vorrendern (Daten sind live).
  await connection();
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** In jeder Seite und jeder Server Action aufrufen. */
export async function requireAuth(): Promise<void> {
  if (await isAuthenticated()) return;
  redirect((await isSetUp()) ? "/login" : "/einrichten");
}

export async function startSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
}

// --- Passwort ----------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function verifyHash(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = await scryptAsync(password, Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// Schutz gegen Durchprobieren: max. 5 Fehlversuche pro 15 Minuten (in der DB,
// damit es auch bei mehreren Server-Instanzen in der Cloud gilt).
const WINDOW = 15 * 60_000;

async function recentFailures(): Promise<number[]> {
  const now = Date.now();
  return ((await getSetting<number[]>("auth.loginFailures")) ?? []).filter((t) => now - t < WINDOW);
}

export async function loginBlocked(): Promise<boolean> {
  return (await recentFailures()).length >= 5;
}

export async function checkPassword(password: string): Promise<boolean> {
  let ok: boolean;
  if (passwordFromEnv()) {
    const a = Buffer.from(createHmac("sha256", "abios").update(password).digest());
    const b = Buffer.from(createHmac("sha256", "abios").update(env.appPassword).digest());
    ok = timingSafeEqual(a, b);
  } else {
    const stored = await getSetting<string>("auth.passwordHash");
    ok = !!stored && (await verifyHash(password, stored));
  }
  if (!ok) await setSetting("auth.loginFailures", [...(await recentFailures()), Date.now()]);
  return ok;
}

export async function setPassword(password: string): Promise<void> {
  await setSetting("auth.passwordHash", await hashPassword(password));
  // Neues Geheimnis → alle bisherigen Sitzungen (andere Geräte) werden abgemeldet.
  if (!env.sessionSecret) await setSetting("auth.sessionSecret", randomBytes(32).toString("hex"));
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Auf Vercel immer HTTPS.
  secure: process.env.COOKIE_SECURE === "true" || process.env.VERCEL === "1",
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
