import fs from "node:fs";
import path from "node:path";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { env } from "./env";

/**
 * Einfache Einzelnutzer-Anmeldung: ein Passwort (APP_PASSWORD), ein signiertes
 * Sitzungs-Cookie. Ohne APP_PASSWORD ist die Anmeldung deaktiviert (nur für
 * rein lokale Nutzung gedacht).
 */

export const SESSION_COOKIE = "abios_session";
const SESSION_DAYS = 30;

export const authEnabled = () => env.appPassword.length > 0;

let secret: Buffer | null = null;
function getSecret(): Buffer {
  if (secret) return secret;
  if (env.sessionSecret) {
    secret = Buffer.from(env.sessionSecret);
  } else {
    // Automatisch erzeugen und im Datenordner ablegen (nicht im Export).
    const file = path.join(env.dataDir, ".session-secret");
    fs.mkdirSync(env.dataDir, { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
    secret = Buffer.from(fs.readFileSync(file, "utf8").trim());
  }
  return secret;
}

const sign = (payload: string) => createHmac("sha256", getSecret()).update(payload).digest("hex");

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return `${exp}.${sign(String(exp))}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(sign(exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function isAuthenticated(): Promise<boolean> {
  // Immer zur Anfragezeit ausführen – nie beim Build vorrendern (Daten sind live).
  await connection();
  if (!authEnabled()) return true;
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** In jeder Seite und jeder Server Action aufrufen. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}

// Schutz gegen Durchprobieren: max. 5 Fehlversuche pro 15 Minuten.
const failures: number[] = [];
const WINDOW = 15 * 60_000;

export function loginBlocked(): boolean {
  const now = Date.now();
  while (failures.length && now - failures[0] > WINDOW) failures.shift();
  return failures.length >= 5;
}

export function checkPassword(password: string): boolean {
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(env.appPassword).digest();
  const ok = timingSafeEqual(a, b);
  if (!ok) failures.push(Date.now());
  return ok;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
