# Weekendplanner

App-Konzept und MVP «Wochenend-Planer» – Stand 27.11.2026, Version 3 (Web-App).

- **App (live):** https://fabianlieb.github.io/Weekendplanner/
- **App-Code und Anleitung:** [`app/README.md`](app/README.md) – lokal starten, deployen, iPhone-Installation, Kurzbefehle, JSON-Format

## Inhalt

| Datei / Ordner | Inhalt |
|---|---|
| `01_Konzept_Wochenend-Planer.md` | Vollständiges Konzept: Problem, Job Stories, Entscheidungslogik, Risikostufen, Story Map, Lean Canvas, Entscheide, Technik, Testplan, offene Punkte, Quellen |
| `02_Claude-Code-Prompt.md` | Startauftrag für Claude Code zum Bau des MVP |
| `CLAUDE.md` | Projektregeln, die Claude Code automatisch liest |
| `Konzept-Board.pdf` | Alle 11 Artboards als PDF (eine Seite pro Artboard) |
| `board/` | Alle Artboards als einzelne HTML-Seiten – `board/index.html` im Browser öffnen |
| `app/` | Web-App (Vite, React, TypeScript), siehe [`app/README.md`](app/README.md) |

Das Board kannst du online weiter bearbeiten: https://claude.ai/artifact/U3zdqnN6y4aeKyNGALM2rM

## Mit Claude Code loslegen

1. Terminal öffnen und in den Ordner wechseln: `cd D:\Weekendplanner`
2. Claude Code starten: `claude`
3. Den Text aus `02_Claude-Code-Prompt.md` ab der Trennlinie als erste Nachricht einfügen.
4. Claude Code liest das Konzept, stellt Rückfragen und schlägt einen Plan vor. Erst nach deinem OK entsteht Code im Unterordner `app/`.

## Noch offen

- Nutzungsrechte bei Skitourenguru (im MVP: Farben manuell eintragen, kein Scraping)
- Grenzwerte nach den 8 Testwochenenden kalibrieren (`app/src/engine/thresholds.ts`)
- Ob «URL öffnen» aus den Kurzbefehlen auf dem iPhone die App oder Safari öffnet
