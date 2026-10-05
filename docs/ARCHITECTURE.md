# AbiOS – Architektur (Phase 1)

Status: Phase 2 umgesetzt · Stand: 05.10.2026

Dieses Dokument beschreibt, **wie** AbiOS gebaut wird, bevor Code entsteht. Es ist
bewusst so geschrieben, dass es auch in zwei Jahren noch erklärt, warum Dinge so
sind, wie sie sind.

> **Umsetzungsnotizen (Phase 2)** – Abweichungen vom ursprünglichen Entwurf:
> - Beherrschung wird *berechnet*, nicht in einer Tabelle `TopicMastery` gespeichert (keine Synchronisationsfehler; schnell genug).
> - Zwischen Sitzung und Aufgabe steht `session_tasks` mit dem Ablaufzustand (Hinweise, Lösung freigegeben, Erklärung).
> - Material hat eine `category` (`notes`, `past_exam`, `curriculum`): alte Abituraufgaben dienen gezielt als Stil-/Niveauvorbild.
> - Jede Seite und jede Server Action prüft die Anmeldung selbst (`requireAuth`), nicht nur das Layout.
> - Zusätzlicher KI-Anbieter `mock` für Tests und zum Ausprobieren ohne Schlüssel.
> - Standard-KI für den kostenlosen Betrieb: Google Gemini über den OpenAI-kompatiblen Adapter.

---

## 1. Leitprinzipien

| Prinzip | Konsequenz in der Architektur |
|---|---|
| **Funktionierend > kompliziert** | Ein Prozess, eine Datenbankdatei, ein Dateiordner. Keine Microservices, keine Vektor-DB, keine Queue-Infrastruktur im MVP. |
| **Wartbar > beeindruckend** | Eine Sprache (TypeScript) für Frontend und Backend. Lernlogik als reine, getestete Funktionen. |
| **Die App steuert, die KI liefert Inhalte** | Lernabläufe (Hinweis → Lösung, Klausur-Timer, Wiederholungsplan) sind fester Code. Die KI wird nur für klar umrissene Teilaufgaben aufgerufen und muss strukturiertes JSON liefern. |
| **Kein Vendor Lock-in** | KI hinter einer eigenen Schnittstelle; Daten in SQLite + Originaldateien + JSON-Export. |
| **Datenhoheit** | Selbst gehostet. An die KI gehen nur die für eine Anfrage nötigen Textausschnitte – nie die ganze Datenbank, nie persönliche Stammdaten. |

Die wichtigste Designentscheidung steckt in Zeile 3: **AbiOS ist kein Chat mit
Lernmaterial, sondern ein Lernsystem, das an einzelnen Stellen KI benutzt.** Damit
lässt sich garantieren, dass Lösungen nicht zu früh erscheinen – das kann man einem
Sprachmodell per Prompt nur *bitten*, im Code aber *erzwingen*.

---

## 2. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Sprache | **TypeScript** | Ein Typensystem von Datenbank bis UI; große Community, langfristig gepflegt. |
| Web-Framework | **Next.js (App Router)**, `output: "standalone"` | Frontend + Backend in einem Projekt, ein Docker-Container. Läuft ohne Vercel. |
| UI | **Tailwind CSS + shadcn/ui** (Radix), Lucide-Icons | shadcn kopiert Komponenten ins Repo → keine Abhängigkeit von einer UI-Bibliothek. Dark Mode eingebaut. |
| Mathe/Formeln | **KaTeX** + Markdown-Renderer | Schnell, offline, LaTeX ist ein offenes Format. |
| Datenbank | **SQLite** (über `better-sqlite3`) | Eine Datei, kein DB-Server, Backup = Datei kopieren, für einen Nutzer mehr als schnell genug. |
| ORM / Migrationen | **Drizzle ORM** | Schema als TypeScript, SQL bleibt sichtbar, Migrationen als SQL-Dateien. Wechsel auf PostgreSQL später möglich. |
| Volltextsuche | **SQLite FTS5** | Findet passende Materialausschnitte für KI-Anfragen – ohne Vektor-DB. |
| Validierung | **Zod** | Prüft Formulareingaben *und* KI-Antworten gegen dasselbe Schema. |
| Wiederholungsalgorithmus | **FSRS** (`ts-fsrs`, MIT) | Moderner, offener Spaced-Repetition-Algorithmus (Nachfolger von SM-2/Anki-Standard). |
| Dateiextraktion | `unpdf` (PDF), `mammoth` (DOCX), `officeparser` (PPTX) | Reine JS-Bibliotheken, keine externen Dienste. Bilder: zunächst nur Ablage, OCR/Vision später. |
| Tests | **Vitest** (Logik), **Playwright** (wenige End-to-End-Pfade) | |
| Betrieb | **Docker Compose** + **Caddy** (automatisches HTTPS) | Läuft auf kleinem VPS, Heimserver oder Raspberry Pi 5. |
| Mobile | Responsive + **PWA** (installierbar auf dem Homescreen) | Keine separate App nötig. |

**Bewusst nicht gewählt (für jetzt):**
- *PostgreSQL / Supabase / Firebase*: mehr Betrieb oder Anbieterbindung ohne Nutzen für einen einzelnen Nutzer.
- *Vektor-Datenbank / Embeddings*: FTS5 reicht für die Materialmenge eines Abiturienten. Embeddings können später als Tabelle in SQLite (`sqlite-vec`) ergänzt werden, ohne Architekturwechsel.
- *Vercel-Hosting*: SQLite und lokale Dateien brauchen ein persistentes Dateisystem.
- *LangChain o. ä.*: zu viel Abstraktion für wenige, klar definierte KI-Aufrufe.

---

## 3. Systemüberblick

```
┌──────────────────────────── Browser / PWA ────────────────────────────┐
│ Dashboard · Lernen · Üben · Klausuren · Wiederholen · Fehler · ...    │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ HTTPS (Server Actions / Route Handlers)
┌───────────────────────────────▼───────────────────────────────────────┐
│ Next.js Server                                                        │
│                                                                       │
│  app/            UI-Routen (dünn, keine Geschäftslogik)               │
│    │                                                                  │
│  server/services Anwendungsfälle: Material hochladen, Lernsitzung,    │
│    │             Übung erzeugen, Klausur bewerten, Export ...         │
│    ├──────────► server/domain   reine Logik, ohne I/O, voll getestet: │
│    │                            FSRS, Themen-Beherrschung, Tages-     │
│    │                            empfehlung, Lernplan, Notenpunkte     │
│    ├──────────► server/ai       KI-Schicht (Provider-unabhängig)      │
│    │              ├─ tasks/     "generateTasks", "evaluateAnswer" ... │
│    │              ├─ prompts/   versionierte Prompt-Vorlagen          │
│    │              └─ providers/ openai-compatible · anthropic · ...   │
│    ├──────────► server/ingest   Text aus PDF/DOCX/PPTX → Chunks → FTS │
│    └──────────► server/db       Drizzle-Schema + Migrationen          │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          ▼                     ▼                      ▼
   data/abios.db         data/files/            data/backups/
   (SQLite)              Originaldateien        tägliche Snapshots
                         (unverändert)
```

**Regel für die Abhängigkeiten:** `app → services → (domain | ai | ingest | db)`.
`domain` importiert nichts davon – dadurch bleibt die Lernlogik testbar und
unabhängig von Framework, Datenbank und KI.

---

## 4. Datenmodell

Alle IDs sind UUIDs (stabil bei Export/Import). Zeitstempel in UTC (ISO 8601).

### 4.1 Struktur

```
Subject (Fach)
  id, name, slug, color, icon
  profile: "stem" | "language" | "humanities" | "arts"   ← steuert Bewertungslogik
  level: "eA" | "gA" | null                              ← erhöhtes/grundl. Anforderungsniveau
  archived_at                                            ← Fächer entfernen ohne Datenverlust

Topic (Thema, beliebig tief verschachtelt)
  id, subject_id, parent_id → Topic, title, position
  exam_weight (0–3)   ← Prüfungsrelevanz, für Priorisierung
  description         ← optional: Lehrplanbezug / Lernziele
```

Beispiel: *Mathematik → Analytische Geometrie → Geraden → Lagebeziehungen* sind
vier `Topic`-Zeilen mit `parent_id`-Kette. Neue Fächer sind reine Daten – kein Code,
keine Migration.

Das `profile` ist der einzige Ort, an dem fachspezifisches Verhalten hängt
(Bewertung nach Lösungsweg vs. nach Ausdruck/Grammatik/Argumentation/Struktur).
Musik bekommt z. B. `arts`; ein neues Fach wählt eins der vorhandenen Profile.

### 4.2 Materialien

```
Material
  id, subject_id, topic_id?, title, kind ("pdf"|"docx"|"pptx"|"image"|"text"|"note")
  file_path (relativ in data/files/), mime, size, sha256   ← Original bleibt unverändert
  extracted_at, extraction_status, created_at

MaterialChunk                     ← extrahierter Text, ~800–1500 Zeichen
  id, material_id, position, text, page?
  + FTS5-Index über text
```

Notizen und reiner Text werden ebenfalls als `Material` gespeichert (als `.md`-Datei),
damit es nur *einen* Weg gibt, wie Inhalte ins System kommen.

### 4.3 Aufgaben und Antworten

```
Task (eine Aufgabe/Frage, egal ob aus Lernen, Üben oder Klausur)
  id, subject_id, topic_id, type ("short"|"open"|"calc"|"mc"|"essay"|...)
  difficulty (1–5), prompt_md, max_points
  solution_md, rubric_json, hints_json[]     ← SERVERSEITIG, nie vorab an den Client
  source_chunk_ids[], origin ("material"|"curriculum"|"general")
  generator ("ai:<provider>/<model>@<prompt-version>" | "manual")

Session (eine Lern-, Übungs- oder Klausursitzung)
  id, mode ("learn"|"practice"|"exam"|"review"), subject_id, topic_ids[]
  started_at, ended_at, time_limit_s?, state_json   ← Zustand des Ablaufs

Attempt (ein Lösungsversuch)
  id, task_id, session_id, answer_md, hints_used, solution_revealed
  score, max_score, evaluation_json, evaluator_confidence
  duration_s, created_at
```

### 4.4 Fehlerdatenbank

```
Mistake
  id, subject_id, topic_id
  label            ← "Richtungsvektoren falsch interpretiert"
  category         ← aus fachprofilspezifischem Katalog, z. B. "Konzept", "Rechenfehler",
                     "Grammatik", "Argumentation", "Struktur", "Fachbegriff"
  description_md, first_seen_at, last_wrong_at
  occurrences, successful_retests
  status: "open" | "unsure" | "improving" | "resolved"

MistakeOccurrence  ← verknüpft Mistake ↔ Attempt (Beleg, wo der Fehler auftrat)
```

**Deduplizierung:** Bei der Bewertung bekommt die KI die Liste der bestehenden
Fehler-Labels dieses Themas und muss entweder ein vorhandenes wählen oder ein neues
vorschlagen. So entsteht „Richtungsvektoren falsch interpretiert (4×)“ statt vier
ähnlicher Einträge.

### 4.5 Wiederholung (Spaced Repetition)

```
ReviewItem
  id, kind ("task"|"mistake"|"topic_check"), ref_id
  fsrs_state_json (stability, difficulty, due, reps, lapses, ...)
  due_at, last_reviewed_at

ReviewLog          ← jede Wiederholung (Bewertung 1–4), Grundlage für Statistiken
```

- Falsch beantwortete Aufgaben → `ReviewItem(kind="task")`.
- Jeder `Mistake` → `ReviewItem(kind="mistake")`: bei Fälligkeit wird eine *neue*
  Aufgabe zum selben Fehlerbild erzeugt (nicht dieselbe – sonst lernt man die Antwort
  auswendig statt das Konzept).
- Status des Fehlers wird aus erfolgreichen Wiederholungen abgeleitet.

### 4.6 Fortschritt und Planung

```
TopicMastery       ← abgeleiteter Wert pro Thema (0–1) + Unsicherheit
  topic_id, mastery, confidence, last_practiced_at, updated_at

Exam (echte Klausur/Prüfung)
  id, subject_id, title, date, topic_ids[], kind ("klausur"|"abitur_schriftlich"|"abitur_muendlich")

StudyPlanItem
  id, date, subject_id, topic_id, minutes, reason, exam_id?, done_at

StudyTimeLog       ← tatsächliche Lernzeit, aus Sessions abgeleitet

Setting            ← key/value (Tageslernzeit, Notenschlüssel, KI-Einstellungen ...)
AiUsageLog         ← Datum, Aufgabe, Modell, Tokens, Kosten – KEINE Inhalte
```

**Beherrschung** wird deterministisch berechnet: gewichteter Mittelwert der
Versuchsergebnisse eines Themas, neuere Versuche zählen stärker, Zeit seit der
letzten Übung senkt den Wert (Vergessen). Die Formel liegt in `server/domain` und ist
in Tests dokumentiert – keine Blackbox.

---

## 5. KI-Schicht

### 5.1 Schnittstelle

```ts
interface AiProvider {
  /** Liefert ein Objekt, das garantiert dem Zod-Schema entspricht (oder wirft). */
  generateObject<T>(req: {
    model: "fast" | "strong";
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
    schema: ZodType<T>;
  }): Promise<{ object: T; usage: TokenUsage }>;

  /** Für längere Fließtext-Erklärungen mit Streaming. */
  streamText(req: { ... }): AsyncIterable<string>;
}
```

Konfiguration ausschließlich über Umgebungsvariablen:

```env
AI_PROVIDER=openai-compatible     # oder: anthropic
AI_BASE_URL=https://api.openai.com/v1   # oder http://ollama:11434/v1, OpenRouter, Mistral ...
AI_API_KEY=...
AI_MODEL_FAST=...                 # günstig: Hinweise, kurze Bewertungen
AI_MODEL_STRONG=...               # stark: Aufgabengenerierung, Klausurbewertung
```

**Zwei Adapter reichen für fast alles:**
- `openai-compatible`: OpenAI, Mistral, OpenRouter, Groq, **Ollama / LM Studio (komplett lokal)** u. v. m.
- `anthropic`: Claude.

Ein weiterer Anbieter = eine neue Datei in `server/ai/providers/` (~100 Zeilen).
Kein anderer Code kennt den Anbieter.

### 5.2 KI-Aufgaben statt freiem Chat

Die Anwendung ruft nur eine kleine Zahl klar definierter Funktionen auf. Jede hat
Eingabe-Typ, Ausgabe-Schema und eine versionierte Prompt-Vorlage:

| Funktion | Zweck | Modell |
|---|---|---|
| `diagnose` | 2–4 Einstiegsfragen, um Vorwissen zu erfassen | fast |
| `generateTasks` | Aufgaben inkl. Lösung, Bewertungsraster, gestufter Hinweise | strong |
| `evaluateAnswer` | Antwort bewerten: Punkte, Fehler, Fehler-Label, Konfidenz | fast/strong |
| `giveHint` | nächster Hinweis, ohne Lösung zu verraten | fast |
| `explain` | kurze, gezielte Erklärung zu *einem* erkannten Missverständnis | fast |
| `gradeExam` | Gesamtbewertung, Wissenslücken, Denkfehler, Niveau | strong |
| `extractTopics` | Themenvorschläge aus hochgeladenem Material (optional) | fast |

Jede Ausgabe wird mit Zod validiert. Bei ungültiger Antwort: ein Wiederholungsversuch,
dann eine verständliche Fehlermeldung – nie halbe Daten in der Datenbank.

### 5.3 Materialbezug (Retrieval)

1. Suche relevante `MaterialChunk`s per FTS5 (Thema + Fragetext), max. ~6 Ausschnitte.
2. Ausschnitte gehen mit IDs in den Prompt: `[M12] …Text…`.
3. Die KI muss bei jeder inhaltlichen Aussage angeben: `source: "material" (mit IDs) | "general"`.
4. Die UI zeigt das sichtbar an: **„aus deinen Materialien“** (mit Link zur Datei/Seite)
   vs. **„Allgemeinwissen“**.
5. Das Schema hat ein Feld `conflicts[]` für Widersprüche zwischen Material und
   Allgemeinwissen – wird als Warnhinweis angezeigt.

### 5.4 Tutor-Verhalten im Code, nicht nur im Prompt

| Anforderung | Umsetzung |
|---|---|
| Lösung nicht sofort zeigen | `solution_md` verlässt den Server erst, wenn der Ablauf es erlaubt (nach Versuch + Hinweisen oder ausdrücklichem „Lösung zeigen“). |
| Erst Hinweis, dann Lösung | Hinweise sind gestuft (`hints_json[0..2]`), die Freigabe zählt der Server. |
| Klausur: keine Lösungen | Im `exam`-Modus liefert die API für die Dauer der Sitzung keine Lösung, keine Hinweise und keine Bewertung aus. Timer läuft serverseitig (`started_at + time_limit_s`). |
| Nicht vorschnell „richtig“ sagen | `evaluateAnswer` liefert `confidence`. Unter Schwelle: Rückfrage an mich („Wie bist du auf … gekommen?“) statt Urteil. |
| Mathe/NaWi: Lösungsweg | Profil `stem`: Raster bewertet Ansatz, Zwischenschritte, Ergebnis, Einheit getrennt. Teilpunkte für richtigen Weg. |
| Sprachen | Profil `language`: vier getrennte Dimensionen – Inhalt/Argumentation, Struktur, Ausdruck, Grammatik/Sprachrichtigkeit. |
| Kurz erklären | Ausgabeschemas haben Längenlimits; Erklärungen sind auf ein Missverständnis fokussiert. |

### 5.5 Datenschutz bei KI-Anfragen

- Gesendet werden: Aufgabentext, meine Antwort, ausgewählte Materialausschnitte, Fachprofil.
- Nicht gesendet: Name, Schule, Termine, Gesamthistorie, Dateien als Ganzes.
- Prompts/Antworten werden **nicht** im Rohformat protokolliert (nur Token-Verbrauch).
  Ein Debug-Schalter dafür ist standardmäßig aus.
- Mit Ollama läuft alles lokal, ohne dass eine Anfrage das eigene Netz verlässt.

---

## 6. Die Lernmodi als Abläufe

### 6.1 Lernmodus (Zustandsautomat)

```
            ┌──────────────┐
  Start ───►│  DIAGNOSE    │ 2–4 kurze Fragen → Einstiegsniveau
            └──────┬───────┘
                   ▼
            ┌──────────────┐
      ┌────►│   FRAGE      │ kurze Verständnisfrage (Active Recall)
      │     └──────┬───────┘
      │            ▼
      │     ┌──────────────┐  richtig   ┌────────────────┐
      │     │  BEWERTUNG   ├───────────►│ schwieriger    ├──┐
      │     └──────┬───────┘            └────────────────┘  │
      │      falsch│                                        │
      │            ▼                                        │
      │     ┌──────────────┐ max. 2 Hinweise, dann          │
      │     │  HINWEIS     │ gezielte ERKLÄRUNG             │
      │     └──────┬───────┘                                │
      │            ▼                                        │
      └──── KONTROLLFRAGE (neue Frage zum selben Konzept) ◄─┘
```

„Erklär mir Newton“ startet genau diesen Ablauf: zuerst eine Aktivierungsfrage,
nicht ein Text. Eine längere Erklärung gibt es nur auf ausdrücklichen Wunsch – und
auch dann folgt sofort eine Verständnisfrage.

### 6.2 Übungsmodus
Formular (Fach, Thema, Schwierigkeit, Typ, Anzahl, Zeit) → `generateTasks` →
Aufgaben einzeln bearbeiten mit Hinweis-Stufen → Bewertung pro Aufgabe → Fehler und
Wiederholungen werden automatisch angelegt. Freitext-Eingabe („5 schwere Aufgaben
zur analytischen Geometrie auf Thüringer Abiturniveau“) wird per KI in dieses
Formular übersetzt und mir zur Bestätigung angezeigt.

### 6.3 Klausurmodus
Aufgaben erzeugen → Sitzung starten (Timer serverseitig) → Antworten werden
zwischengespeichert (Verbindungsabbruch ≠ Datenverlust) → Abgabe oder Zeitablauf →
`gradeExam` → Bericht: Punkte, Notenpunkte (0–15, Schlüssel konfigurierbar), Fehler,
Wissenslücken, typische Denkfehler, Verbesserungsvorschläge, geschätztes Niveau.
Handschriftliche Lösungen (Foto) sind für später vorgesehen (Vision-Modell).

### 6.4 Wiederholen
Fällige `ReviewItem`s nach FSRS, gemischt über Fächer (Interleaving). Ich beantworte
zuerst selbst, dann Selbst- oder KI-Bewertung → Rating 1–4 → nächster Termin.

---

## 7. Tagesempfehlung und Lernplanung

Beides ist **deterministischer Code**, keine KI – nachvollziehbar, kostenlos, testbar.

### 7.1 Tagesempfehlung
Für jedes Thema ein Prioritätswert:

```
priorität = w1 · fällige Wiederholungen
          + w2 · offene/unsichere Fehler (Häufigkeit)
          + w3 · (1 − Beherrschung)
          + w4 · Prüfungsnähe × Prüfungsgewicht
          + w5 · Zeit seit letzter Übung
```

Dann werden die Top-Themen in 10–15-Minuten-Blöcke bis zur eingestellten Tageszeit
verteilt, mit maximal zwei Blöcken pro Fach hintereinander (Interleaving). Jeder Block
zeigt seinen Grund („3 fällige Wiederholungen, Fehler ‚Richtungsvektoren‘ 4×“).

### 7.2 Lernplan bis zur Prüfung
Für eine Klausur mit Datum und Themen werden die verfügbaren Tage bis dahin
aufgeteilt. Bei knapper Zeit wird in der geforderten Reihenfolge priorisiert:
1. große Wissenslücken (niedrige Beherrschung), 2. häufige Fehler,
3. Prüfungsgewicht, 4. Wiederholung beherrschter Inhalte.
Die letzten 1–2 Tage sind für eine Klausursimulation reserviert. Der Plan wird täglich
anhand der echten Ergebnisse neu berechnet, nicht einmal festgeschrieben.

---

## 8. Datenhoheit: Export, Import, Backup

**Speicherorte** – alles in einem Verzeichnis `data/`:
- `abios.db` – SQLite (offenes, dokumentiertes Format, mit jedem SQLite-Tool lesbar)
- `files/` – Originaldateien, Name = `<sha256>.<ext>`, Metadaten in der DB
- `backups/` – automatische Snapshots

**Export** (Button in den Einstellungen + CLI-Befehl): ZIP mit
```
abios-export-2026-10-05/
  manifest.json          Version, Datum, Schema-Version
  data/*.json            eine JSON-Datei pro Tabelle (lesbar, dokumentiert)
  files/...              alle Originaldateien
  abios.db               zusätzlich die Rohdatenbank
```
Damit sind die Daten auch ohne AbiOS nutzbar (JSON + Originale).

**Import**: dasselbe ZIP-Format zurück; Schema-Version wird geprüft und ggf. migriert.

**Backup**: täglicher Snapshot per `VACUUM INTO` (konsistent auch im laufenden
Betrieb) + Dateiordner, Aufbewahrung z. B. 7 täglich / 4 wöchentlich. Zusätzlich
dokumentiert: Synchronisation des `backups/`-Ordners auf einen zweiten Ort
(z. B. `restic`, Nextcloud, externe Platte).

---

## 9. Sicherheit

- **Einzelnutzer-Anwendung**: Login mit Passwort (gehasht mit Argon2), Sitzungs-Cookie
  (`HttpOnly`, `Secure`, `SameSite=Lax`). Kein Fremd-Login-Anbieter nötig.
- Rate-Limit auf Login.
- Uploads: Größenlimit, MIME-Prüfung, Speicherung außerhalb des Web-Roots,
  Dateinamen nie vom Nutzer übernommen.
- Geheimnisse (API-Keys) nur in `.env`, nie in der DB oder im Export.
- HTTPS über Caddy.

---

## 10. Projektstruktur

```
abios/
├─ src/
│  ├─ app/                    Routen & Seiten (Dashboard, lernen, ueben, ...)
│  ├─ components/             UI-Bausteine (shadcn/ui + eigene)
│  └─ server/
│     ├─ db/                  schema.ts, migrations/, client.ts
│     ├─ domain/              fsrs.ts, mastery.ts, daily-plan.ts, study-plan.ts, grading.ts
│     ├─ services/            materials.ts, learn-session.ts, practice.ts, exam.ts, export.ts
│     ├─ ai/
│     │  ├─ provider.ts       Interface + Factory (liest AI_PROVIDER)
│     │  ├─ providers/        openai-compatible.ts, anthropic.ts
│     │  ├─ tasks/            diagnose.ts, generate-tasks.ts, evaluate-answer.ts, ...
│     │  └─ prompts/          versionierte Vorlagen pro Aufgabe und Fachprofil
│     └─ ingest/              pdf.ts, docx.ts, pptx.ts, chunk.ts
├─ tests/                     Vitest + Playwright
├─ scripts/                   backup.ts, export.ts, import.ts, seed.ts
├─ docs/                      ARCHITECTURE.md, ROADMAP.md, Betriebsanleitung
├─ data/                      (gitignored) abios.db, files/, backups/
├─ Dockerfile, docker-compose.yml, Caddyfile
└─ .env.example
```

---

## 11. Betrieb und Kosten

| Option | Kosten/Monat | Bemerkung |
|---|---|---|
| Kleiner VPS (z. B. 2 vCPU / 4 GB) | ca. 4–6 € | Von überall erreichbar, empfohlen. |
| Heimserver / Raspberry Pi 5 | Strom | Volle Datenhoheit; für Zugriff unterwegs z. B. Tailscale. |
| Nur lokal (`docker compose up`) | 0 € | Gut zum Start, aber kein Handy-Zugriff unterwegs. |
| KI-API | ca. 1–10 € | Abhängig von Nutzung; „fast“-Modell für die meisten Aufrufe hält Kosten niedrig. Verbrauch wird in der App angezeigt. |
| Lokale KI (Ollama) | 0 € | Braucht leistungsfähige Hardware; Qualität bei Bewertung schwächer. |

Updates: `git pull && docker compose up -d --build`; Migrationen laufen beim Start
automatisch, vorher wird automatisch ein Backup erstellt.

---

## 12. Selbstkritik: Risiken und bewusste Vereinfachungen

| Risiko | Gegenmaßnahme |
|---|---|
| KI bewertet falsch (v. a. Mathe) | Konfidenzwert, Rückfragen, Lösungsweg-Raster; später optional numerische Prüfung mit `mathjs`. Ich kann jede Bewertung korrigieren – die Korrektur fließt in Fehler/Beherrschung ein. |
| KI-generierte Aufgaben fehlerhaft | Lösung + Raster werden zusammen erzeugt; „Aufgabe melden/verwerfen“ entfernt sie aus Wiederholungen. |
| Thüringer Abiturniveau ist für die KI unscharf | Lehrplan-Themen und Beispielaufgaben als eigenes Material hinterlegen; sie werden bevorzugt als Kontext genutzt. |
| Textextraktion aus gescannten PDFs/Bildern | MVP: Hinweis „kein Text erkannt“. Phase 4: OCR (`tesseract.js`) oder Vision-Modell. |
| Next.js-Komplexität (Caching, Server Components) | Bewusst einfache Nutzung: Server Actions + dynamisches Rendering; keine Edge-Runtime, kein ISR. |
| Zu viele Statistiken | Dashboard zeigt max. 6 Kacheln; Detailstatistiken nur unter „Fortschritt“. |

**Bewusste MVP-Vereinfachungen:** ein Nutzer; keine Embeddings; keine
Echtzeit-Synchronisation/Offline-Modus; keine Handschrift-Erkennung; Text-Extraktion
synchron beim Upload (bei großen Dateien später Hintergrund-Job über eine
`jobs`-Tabelle – ohne neue Infrastruktur).

---

## 13. Phasenplan (Kurzfassung)

| Phase | Inhalt | Prüfpunkt danach |
|---|---|---|
| **2 – MVP** | Projektgerüst, Auth, Fächer/Themen, Material-Upload + Extraktion, KI-Schicht (2 Adapter), Lernmodus, Übungsmodus, Attempts + Beherrschung, einfaches Dashboard | Läuft per Docker; ein kompletter Lernzyklus mit eigenem PDF funktioniert. |
| **3 – Lernsystem** | Fehlerdatenbank, FSRS-Wiederholung, Klausurmodus mit Bericht, Prüfungstermine + Lernplan, Tagesempfehlung | Domain-Logik vollständig getestet; 1 Woche echte Nutzung. |
| **4 – Qualität** | UI-Feinschliff, PWA, Mobile-Optimierung, Export/Import, automatische Backups, Sicherheits-Härtung, OCR | Export → frische Instanz → Import ergibt identische Daten. |
| **5 – Betrieb** | Deployment-Anleitung (VPS/Heimserver), Update-Prozess, Monitoring (Healthcheck), Wartungsdoku | Neuinstallation nach Anleitung in < 30 min. |
