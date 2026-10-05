# AbiOS

Persönliche, selbst gehostete Lernplattform fürs Abitur: aktives Abrufen statt
passivem Lesen, gestufte Hinweise statt sofortiger Lösungen, Aufgaben aus den
eigenen Materialien und alten Abituraufgaben.

- **KI austauschbar** (`AI_PROVIDER=…`): Google Gemini (kostenlos), Ollama (lokal), Mistral, OpenAI, Claude
- **Deine Daten bleiben bei dir:** SQLite-Datei + Originaldateien in einem Ordner
- **Läuft überall:** eigener PC, Raspberry Pi, kleiner Server – mit oder ohne Docker

Architektur: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Stand & Planung: [docs/ROADMAP.md](docs/ROADMAP.md)

---

## Einfachster Start (Doppelklick)

1. **Node.js** installieren: <https://nodejs.org/de/download> → Version „LTS“.
2. **AbiOS herunterladen** und entpacken:
   [ZIP herunterladen](https://github.com/floriankml/abi-ai/archive/refs/heads/claude/abios-learning-platform-9h6w5w.zip)
3. Im entpackten Ordner doppelklicken:
   - Windows: **`AbiOS starten (Windows).bat`**
   - Mac: **`AbiOS starten (Mac).command`** (beim ersten Mal: Rechtsklick → „Öffnen“)
4. Beim ersten Start fragt AbiOS nach einem **Passwort** (frei wählbar) und deinem
   **Gemini-Schlüssel** (<https://aistudio.google.com/apikey>). Danach öffnet sich der Browser.

Ab dann: nur noch doppelklicken. Das Fenster offen lassen, solange du lernst.

## Schnellstart für Entwickler (eigener Rechner, kostenlos)

Voraussetzung: [Node.js 22+](https://nodejs.org)

```bash
git clone <dieses-repo> abios && cd abios
npm install
cp .env.example .env      # dann .env anpassen (siehe unten)
npm run build
npm start                 # → http://127.0.0.1:3000
```

Zum Entwickeln: `npm run dev`.

### KI kostenlos einrichten (Google Gemini)

1. Auf <https://aistudio.google.com/apikey> mit einem Google-Konto einen API-Schlüssel erstellen.
2. In `.env` die Vorlage „Option A“ aktivieren und den Schlüssel eintragen.
   Am besten auch `AI_MODEL_FALLBACKS` setzen: Der Gratis-Tarif ist oft überlastet
   oder am Limit, dann weicht AbiOS automatisch auf das nächste Modell aus.
3. AbiOS neu starten. Unter **Einstellungen** steht dann „aktiv“.

> Hinweis zum Datenschutz: Im kostenlosen Tarif darf Google Anfragen zur
> Verbesserung seiner Dienste nutzen. AbiOS schickt nur Aufgabe, Antwort und
> wenige Materialausschnitte – keine Namen oder Lernhistorie. Wer gar nichts
> herausgeben möchte, nutzt Ollama (Option B, läuft komplett lokal).

Ohne KI lassen sich Fächer, Themen und Materialien schon verwalten. Zum
Ausprobieren der Oberfläche gibt es `AI_PROVIDER=mock` (Platzhalter-Aufgaben).

---

## Betrieb mit Docker

```bash
cp .env.example .env      # APP_PASSWORD setzen!
mkdir -p data
docker compose up -d      # → http://localhost:3000
```

**Von unterwegs (Handy) erreichbar machen – kostenlose Wege:**

| Weg | Aufwand | Bemerkung |
|---|---|---|
| [Tailscale](https://tailscale.com) auf PC/Pi und Handy | gering | privates Netz, nichts öffentlich im Internet – **empfohlen** |
| Eigene Domain + `docker compose --profile https up -d` | mittel | Caddy holt automatisch ein HTTPS-Zertifikat; `DOMAIN` und `COOKIE_SECURE=true` in `.env` |

Auf dem Handy die Seite öffnen und „Zum Home-Bildschirm hinzufügen“ – AbiOS
verhält sich dann wie eine App.

**Update:** `git pull && docker compose up -d --build` – Datenbank-Migrationen laufen beim Start automatisch.

---

## Daten & Backup

Alles liegt im Ordner `data/`:

- `abios.db` – SQLite-Datenbank (offenes Format, z. B. mit [DB Browser for SQLite](https://sqlitebrowser.org) lesbar)
- `files/` – deine Originaldateien, unverändert

**Backup = den Ordner `data/` kopieren** (am besten bei gestoppter App).
Export/Import per Knopfdruck und automatische Backups folgen in Phase 4.

---

## Entwicklung

```bash
npm run dev         # Entwicklungsserver
npm run check       # Typprüfung + Lint + Tests
npm run db:generate # Migration nach Schemaänderung erzeugen (src/server/db/schema.ts)
```

Struktur: `src/app` (Seiten, dünn) → `src/server/services` (Anwendungsfälle) →
`src/server/domain` (reine, getestete Lernlogik) · `src/server/ai` (KI-Schicht) ·
`src/server/db` (Schema) · `src/server/ingest` (Textextraktion).
