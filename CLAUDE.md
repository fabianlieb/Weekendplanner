# CLAUDE.md – Wochenend-Planer

Projektkontext für Claude Code. Details: `01_Konzept_Wochenend-Planer.md`, Startauftrag: `02_Claude-Code-Prompt.md`.

## Projekt
Web-App (PWA) für das iPhone, die jeden Donnerstag 3 Wochenendvorschläge + 1 Plan B macht (MVP: Ski, Skitour, Schneeschuh, Fotografie in der Schweiz). Ein Nutzer (ich), Testphase 8 Wochenenden.

## Regeln
- Kein Backend, keine API-Schlüssel, keine Tracker. Alles im Browser, Daten nur in IndexedDB.
- Entwicklung unter Windows, kein Mac. Keine nativen iOS-Abhängigkeiten.
- UI auf Deutsch (Schweizer Schreibweise, «ss»), Code und Commits auf Englisch.
- Stack: Vite, React, TypeScript strict, vite-plugin-pwa, Dexie, suncalc, Vitest. Neue Abhängigkeiten nur nach Rückfrage.
- App-Code liegt in `app/`. Engine-Logik als reine Funktionen in `app/src/engine/` mit Tests.
- Alle Grenzwerte zentral in `app/src/engine/thresholds.ts`.
- Design: Swiss Style light – Weiss, #111111, #5E5E5E, Akzent #D52B1E, Inter, keine Emojis, Touch-Ziele ≥ 44 px.
- Open-Meteo-Quellenangabe in der App sichtbar halten.

## Sicherheit (nie brechen)
- Nie «sicher» schreiben.
- Lawinenrisiko nur aus Skitourenguru-Farben (grün/orange/rot), keine eigene Risikoberechnung, kein Scraping.
- Fehlendes oder veraltetes Risiko = unbekannt = nicht vorschlagen (fail closed).
- Filter nach Risikostufe im Profil; Rot nur mit Bestätigung «geschulte Gruppe», Hinweis «nie allein».
- Bei Touren immer Risikofarbe, Gefahrenstufe und Hinweis aufs SLF-Bulletin anzeigen.

## Arbeitsweise
- Vor grösseren Schritten kurzen Plan zeigen und auf OK warten.
- Kleine Commits pro Etappe, Tests vor der Oberfläche.
- Nach jeder Etappe: was ist fertig, was soll ich testen.
