@echo off
chcp 65001 >nul
title AbiOS
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js ist noch nicht installiert.
  echo Bitte die Version "LTS" von der Seite installieren, die sich jetzt oeffnet,
  echo und danach diese Datei noch einmal doppelklicken.
  start https://nodejs.org/de/download
  pause
  exit /b 1
)
node scripts\setup.mjs
pause
