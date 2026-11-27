# Weekendplanner

App-Konzept «Wochenend-Planer» – Stand 27.11.2026, Version 3 (Web-App).

## Inhalt

| Datei / Ordner | Inhalt |
|---|---|
| `01_Konzept_Wochenend-Planer.md` | Vollständiges Konzept: Problem, Job Stories, Entscheidungslogik, Risikostufen, Story Map, Lean Canvas, Entscheide, Technik, Testplan, offene Punkte, Quellen |
| `02_Claude-Code-Prompt.md` | Startauftrag für Claude Code zum Bau des MVP |
| `CLAUDE.md` | Projektregeln, die Claude Code automatisch liest |
| `Konzept-Board.pdf` | Alle 11 Artboards als PDF (eine Seite pro Artboard) |
| `board/` | Alle Artboards als einzelne HTML-Seiten – `board/index.html` im Browser öffnen |

Das Board kannst du online weiter bearbeiten: https://claude.ai/artifact/U3zdqnN6y4aeKyNGALM2rM

## Mit Claude Code loslegen

1. Terminal öffnen und in den Ordner wechseln: `cd D:\Weekendplanner`
2. Claude Code starten: `claude`
3. Den Text aus `02_Claude-Code-Prompt.md` ab der Trennlinie als erste Nachricht einfügen.
4. Claude Code liest das Konzept, stellt Rückfragen und schlägt einen Plan vor. Erst nach deinem OK entsteht Code im Unterordner `app/`.

## Vor dem Bauen klären

- Nutzungsrechte und Browser-Zugriff bei Skitourenguru
- Zeiten für die Donnerstag-Nachricht und den Vorabend-Check
- Grenzwerte pro Sportart (Wind, Sonnenstunden, Temperatur)
