#!/bin/bash
# AbiOS per Doppelklick starten (macOS).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js ist noch nicht installiert."
  echo "Bitte die Version \"LTS\" von der Seite installieren, die sich jetzt öffnet,"
  echo "und danach diese Datei noch einmal doppelklicken."
  open "https://nodejs.org/de/download"
  read -r -p "Enter zum Schließen …"
  exit 1
fi
node scripts/setup.mjs
