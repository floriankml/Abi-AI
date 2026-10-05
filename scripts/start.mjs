// Startet den Produktions-Build ohne Docker: `npm run build && npm start`.
// Kopiert die statischen Dateien in den Standalone-Ordner und lädt .env.
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const standalone = resolve(root, ".next/standalone");
if (!existsSync(standalone)) {
  console.error("Kein Build gefunden. Bitte zuerst `npm run build` ausführen.");
  process.exit(1);
}
cpSync(resolve(root, ".next/static"), resolve(standalone, ".next/static"), { recursive: true });
cpSync(resolve(root, "public"), resolve(standalone, "public"), { recursive: true });
cpSync(resolve(root, "drizzle"), resolve(standalone, "drizzle"), { recursive: true });
if (existsSync(resolve(root, ".env"))) process.loadEnvFile(resolve(root, ".env"));

const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: process.env.PORT ?? "3000",
  HOSTNAME: process.env.HOSTNAME ?? "127.0.0.1",
  // Datenordner relativ zum Projekt, nicht zum Build-Ordner.
  DATA_DIR: resolve(root, process.env.DATA_DIR ?? "./data"),
};
console.log(`AbiOS läuft auf http://${env.HOSTNAME}:${env.PORT}`);
const child = spawn(process.execPath, ["server.js"], { cwd: standalone, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
