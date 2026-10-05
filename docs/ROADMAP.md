# AbiOS – Stand & Planung

| Phase | Inhalt | Status |
|---|---|---|
| 1 | Architektur | ✅ erledigt |
| 2 | MVP: Dashboard, Fächer, Themen, Materialien, Lernmodus, Übungsmodus, Fortschritt | ✅ erledigt (siehe Review) |
| 3 | Fehlerdatenbank, Spaced Repetition (FSRS), Klausurmodus, Prüfungstermine & Lernplan | ⏳ als Nächstes |
| 4 | UI-Feinschliff, PWA-Offline, Export/Import, automatische Backups, OCR, Sicherheit | geplant |
| 5 | Deployment-Anleitung, Wartung, Monitoring | geplant |

---

## Review nach Phase 2

### Funktioniert alles?

Geprüft mit 29 automatischen Tests (Lernlogik, KI-Adapter gegen nachgebauten
OpenAI-kompatiblen Server, Freigaberegeln der Sitzungen) und einem
Browser-Durchlauf gegen den Produktions-Build:

- Anmeldung inkl. Fehlversuch; geschützte Seiten und APIs (401/Weiterleitung, auch bei gefälschtem Cookie)
- Themenbaum anlegen, PDF hochladen → Text erkannt → Volltextsuche
- Lernmodus: Diagnose → falsche Antwort → Hinweis 1 → Hinweis 2 → erst dann Lösung + gezielte Erklärung → Kontrollfrage
- Übungsmodus: mehrere Aufgaben, Timer, Abschließen nach Versuch, Zusammenfassung mit Punkten/Notenpunkten
- Dashboard, Fortschritt, Mobilansicht, Dark Mode

**Test mit echter KI (Google Gemini, Free Tier):**

- Mathe (Lagebeziehungen): Aufgaben greifen Notizen *und* die alte Abituraufgabe auf; die Bewertung erkennt den typischen Denkfehler („gleich“ statt „Vielfache“, Punktprobe vergessen) und verrät die Lösung nicht. Vektoren werden als LaTeX-Matrizen korrekt dargestellt.
- Englisch (Discussion): getrennte Bewertung von Inhalt, Struktur, Ausdruck und Sprachrichtigkeit; konkrete Grammatikfehler erkannt; realistische Punktzahl.
- Dabei gefunden und behoben:
  - Modellnamen veralten schnell (`gemini-2.5-flash` für neue Nutzer abgeschaltet) → klare Fehlermeldung, Vorlage auf `gemini-3.8-flash` aktualisiert.
  - Free Tier häufig überlastet (503) oder am Limit (429) → **Ausweichmodelle** (`AI_MODEL_FALLBACKS`).
  - LaTeX-Backslashes machten JSON ungültig oder verfälschten Formeln still (`\frac` → Steuerzeichen) → Reparatur vor dem Parsen.
  - Interne Material-IDs („[M1]“) tauchten in Aufgaben/Hinweisen auf → Prompt verschärft + im Code entfernt.
  - Erklärungen stellten Gegenfragen, Rückfragen kamen auch bei eindeutig falschen Antworten → Prompt und Code angepasst.
- Offen: Hinweise werden vorab erzeugt und gehen daher nicht auf die konkrete Antwort ein. Idee für Phase 3: Hinweis 1 aus dem Feedback ableiten.

**Nicht geprüft:** `docker build` – kein Docker-Daemon verfügbar. Der darin verwendete Standalone-Build wurde direkt getestet.

### Architekturprobleme?

Keine grundlegenden. Kleinere Punkte:

- Beherrschung wird bei jedem Seitenaufruf aus allen Antworten berechnet. Für einen Nutzer über Jahre unkritisch (Tausende Zeilen); bei Bedarf später zwischenspeichern.
- Fehler stehen bisher nur im Bewertungs-JSON jeder Antwort. Phase 3 braucht eine eigene Tabelle `mistakes` mit Zusammenführung ähnlicher Fehler – Daten dafür werden bereits gesammelt.
- Sitzungen bleiben „offen“, bis man sie beendet. Phase 3: automatisch nach Inaktivität schließen.

### Unnötige Komplexität?

- Bewusst weggelassen: Vektor-DB, Job-Queue, UI-Bibliothek, ORM-Magie. Ein Prozess, eine DB-Datei.
- Grenzfall: Der Claude-Adapter nutzt serverseitige Ausweichmodelle. Klein und gekapselt – bleibt.

### Vor Phase 3 verbessern

1. 1–2 Wochen mit echten Notizen + alten Abituraufgaben nutzen und Prompts nach den Erfahrungen nachschärfen (`src/server/ai/tasks.ts`, `PROMPT_VERSION` erhöhen).
2. Mehrfaches Berechnen der Fortschrittsübersicht auf dem Dashboard zusammenfassen, sobald die Tagesplanung (Phase 3) dazukommt.
3. Gescannte PDFs/Fotos: aktuell „kein Text“ – OCR ist für Phase 4 eingeplant; bis dahin Text-PDFs oder Notizen nutzen.

---

## Phase 3 – Plan

1. **Fehlerdatenbank:** Tabelle `mistakes` + `mistake_occurrences`; Bewertung bekommt bestehende Fehler-Labels zur Auswahl (Deduplizierung); Seite „Fehler“ mit Status (offen/unsicher/verbessert/behoben).
2. **Spaced Repetition:** `ts-fsrs`, `review_items` für falsch gelöste Aufgaben und Fehlerbilder; Fehler-Wiederholung erzeugt *neue* Aufgaben zum selben Fehlerbild; Seite „Wiederholen“.
3. **Klausurmodus:** serverseitiger Timer, keine Hinweise/Lösungen während der Bearbeitung, Zwischenspeichern, Abgabe → Gesamtbewertung (Punkte, Notenpunkte, Lücken, Denkfehler, Niveau).
4. **Prüfungstermine & Lernplan:** Termine mit Themen; deterministische Tagesempfehlung (fällige Wiederholungen, Fehler, Beherrschung, Prüfungsnähe × Relevanz).
