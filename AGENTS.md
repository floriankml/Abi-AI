<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AbiOS – Projektkonventionen

- Architektur und Begründungen: `docs/ARCHITECTURE.md`; Stand/Plan: `docs/ROADMAP.md`.
- Abhängigkeiten nur in eine Richtung: `app → server/services → server/{domain,ai,ingest,db}`. `server/domain` bleibt frei von I/O und ist getestet.
- Lernabläufe (wann Hinweise/Lösungen sichtbar werden) stehen in `server/services/sessions.ts`, nicht in Prompts. Lösungen nie vorzeitig an den Client geben.
- KI-Anbieter nur in `server/ai/index.ts` auswählen; neue Anbieter als Datei in `server/ai/providers/`.
- Jede Seite und Server Action ruft `requireAuth()` auf.
- Schemaänderung: `src/server/db/schema.ts` ändern, dann `npm run db:generate`.
- Vor dem Commit: `npm run check`. UI-Texte auf Deutsch.
