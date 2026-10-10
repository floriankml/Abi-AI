// AbiOS – Ein-Klick-Start für Einsteiger.
// Wird von "AbiOS starten (Windows).bat" bzw. "AbiOS starten (Mac).command" aufgerufen.
// 1. fragt beim ersten Start Passwort + Gemini-Schlüssel ab und schreibt .env
// 2. installiert Abhängigkeiten und baut die App (nur wenn nötig)
// 3. startet AbiOS und öffnet den Browser
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline";

const root = resolve(import.meta.dirname, "..");
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const PORT = process.env.PORT ?? "3000";
const URL = `http://127.0.0.1:${PORT}`;
/** Eine gemeinsame Eingabe für alle Fragen (sonst gehen Eingaben verloren). */
let rl = null;
const tty = Boolean(process.stdin.isTTY);
const pendingLines = [];
const waiting = [];

const say = (msg = "") => console.log(msg);
const fail = (msg) => {
  say(`\n❌ ${msg}\n`);
  process.exit(1);
};

// --- Node-Version prüfen ------------------------------------------------------
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) fail(`Node.js ${process.versions.node} ist zu alt. Bitte Version 22 oder neuer von https://nodejs.org installieren.`);

say("\n=== AbiOS ===\n");

// --- 1. Einstellungen (.env) --------------------------------------------------
const envFile = join(root, ".env");
if (!existsSync(envFile)) {
  say("Erster Start – zwei kurze Fragen.\n");
  let password = "x";
  while (password && password.length < 6) {
    password = (await ask("Passwort für AbiOS (leer lassen = ohne Passwort): ", true)).trim();
    if (password && password.length < 6) say("Bitte mindestens 6 Zeichen – oder leer lassen.");
  }
  say("\nGemini-API-Schlüssel (kostenlos unter https://aistudio.google.com/apikey).");
  const key = (await ask("Schlüssel einfügen und Enter drücken (leer lassen = später): ", true)).trim();

  const lines = [
    "# AbiOS – deine Einstellungen (nicht teilen!)",
    `APP_PASSWORD=${password}`,
    "COOKIE_SECURE=false",
    "DATA_DIR=./data",
    "",
    key ? "AI_PROVIDER=openai-compatible" : "AI_PROVIDER=none",
    "AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/",
    `AI_API_KEY=${key}`,
    "AI_MODEL_FAST=gemini-3.8-flash",
    "AI_MODEL_STRONG=gemini-3.8-flash",
    "AI_MODEL_FALLBACKS=gemini-3.5-flash,gemini-flash-lite-latest",
    "AI_JSON_MODE=json_object",
    "",
  ];
  writeFileSync(envFile, lines.join("\n"), { mode: 0o600 });
  closeInput();
  say("\n✅ Einstellungen gespeichert (Datei .env). Ändern: .env mit einem Texteditor öffnen.\n");
}

// --- 2. Installieren & bauen (nur wenn nötig) ---------------------------------
if (!existsSync(join(root, "node_modules"))) {
  say("📦 Installiere Bausteine (einmalig, dauert ein paar Minuten)…");
  run(npm, ["install", "--no-audit", "--no-fund"]);
}

const serverJs = join(root, ".next", "standalone", "server.js");
const builtAt = existsSync(serverJs) ? statSync(serverJs).mtimeMs : 0;
const sourcesChangedAt = Math.max(
  ...["src", "drizzle", "package.json", "next.config.ts"].map((p) => newestMtime(join(root, p))),
);
if (builtAt < sourcesChangedAt) {
  say("🔨 Baue AbiOS (einmalig bzw. nach Updates, ca. 1 Minute)…");
  run(npm, ["run", "build"]);
}

// --- 3. Starten & Browser öffnen ----------------------------------------------
say(`🚀 Starte AbiOS… (Fenster offen lassen – Schließen beendet AbiOS)\n`);
const server = spawn(process.execPath, [join(root, "scripts", "start.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT },
});
server.on("exit", (code) => process.exit(code ?? 0));

for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const res = await fetch(`${URL}/api/health`);
    if (res.ok) {
      say(`\n✅ AbiOS läuft: ${URL}\n`);
      openBrowser(URL);
      break;
    }
  } catch {
    /* noch nicht bereit */
  }
}

// --- Hilfsfunktionen ----------------------------------------------------------
function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: isWin });
  if (r.status !== 0) fail(`"${cmd} ${args.join(" ")}" ist fehlgeschlagen. Die Meldung steht oben.`);
}

function newestMtime(path) {
  if (!existsSync(path)) return 0;
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  return Math.max(st.mtimeMs, ...readdirSync(path).map((f) => newestMtime(join(path, f))));
}

function openBrowser(url) {
  if (process.env.ABIOS_NO_BROWSER) return;
  const [cmd, args] = isWin ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => say(`Bitte im Browser öffnen: ${url}`)).unref();
}

/** Fragt eine Zeile ab; bei hidden werden Eingaben als * angezeigt. */
function ask(question, hidden = false) {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
    // Zeilen puffern: eingefügter Text kann schneller kommen als die nächste Frage.
    rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : pendingLines.push(line)));
    rl.on("close", () => waiting.splice(0).forEach((resolveLine) => resolveLine("")));
  }
  rl._writeToOutput =
    hidden && tty
      ? (s) => rl.output.write(s.includes("\n") || s.includes("\r") ? "\n" : "*".repeat(s.length))
      : (s) => rl.output.write(s);
  process.stdout.write(question);
  if (pendingLines.length) return Promise.resolve(pendingLines.shift());
  return new Promise((resolveLine) => waiting.push(resolveLine));
}

function closeInput() {
  rl?.close();
  rl = null;
}
