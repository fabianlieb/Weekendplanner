# Prompt für Claude Code – MVP «Wochenend-Planer»

> **So startest du:** Öffne ein Terminal in `D:\Weekendplanner`, starte `claude` und kopiere alles ab der Linie unten als erste Nachricht hinein.
> Claude Code liest zusätzlich automatisch die Datei `CLAUDE.md` in diesem Ordner.

---

Du hilfst mir, das MVP meiner App **«Wochenend-Planer»** zu bauen. Das vollständige Konzept steht in `01_Konzept_Wochenend-Planer.md` in diesem Ordner, die visuellen Skizzen liegen in `board/` und in `Konzept-Board.pdf`. **Lies zuerst das Konzept vollständig**, dann die Screens `board/06a` bis `board/06d`.

## Ziel

Eine **Web-App (PWA)** für mein iPhone 15 Pro, die mir jeden Donnerstag **3 realistische Wochenendvorschläge + 1 Plan B** für **Ski (Piste), Skitour, Schneeschuh und Fotografie** in der Schweiz macht – passend zu Material, Risikostufe, Zeitbudget, Startpunkt und Tagesform. Mit Detailplan, Check am Vorabend und Feedback nach dem Wochenende. Ich teste sie 8 Wochenenden lang (Dezember–Januar) allein.

## Harte Rahmenbedingungen

- **Kein Backend, kein Server, keine API-Schlüssel.** Alles läuft im Browser auf dem iPhone.
- **Kein Mac vorhanden.** Ich entwickle unter Windows. Keine nativen iOS-Abhängigkeiten.
- **Daten nur auf dem Gerät** (IndexedDB). Keine Tracking- oder Analytics-Dienste.
- **Kostenlos:** Open-Meteo (nicht kommerziell, < 10'000 Aufrufe/Tag, Quellenangabe «Weather data by Open-Meteo.com», CC BY 4.0 sichtbar in der App), Hosting auf GitHub Pages.
- **Sprache der Oberfläche:** Deutsch (Schweizer Schreibweise, «ss» statt «ß»). Code, Bezeichner und Commits auf Englisch.
- **Design:** leicht vom Swiss Style inspiriert, wie im Board – weisser Grund, Schwarz #111111, Grau #5E5E5E, Akzent Rot #D52B1E, Schrift Inter, klares Raster, keine Emojis, Touch-Ziele ≥ 44 px.

## Sicherheitsregeln (nicht verhandelbar, mit Tests absichern)

1. Die App schreibt **nie** «sicher». Höchstens «geringes Risiko laut Skitourenguru».
2. Das Lawinenrisiko kommt aus Skitourenguru-Farben (grün / orange / rot) oder aus einer eigenen Risikoberechnung auf Basis des offiziellen SLF-Bulletins (Regel am 28.11.2026 geändert).
3. **Fail closed:** Fehlt die Risikofarbe einer Skitour oder Schneeschuhtour ohne Signalisation, oder ist sie älter als der aktuelle Tag, gilt sie als «unbekannt» und wird **nicht vorgeschlagen**.
4. Filter nach der Risikostufe im Profil: Stufe 1 → nur grün · Stufe 2 → grün und orange · Stufe 3 → zusätzlich rot.
5. **Rote Touren nur mit Bestätigung** («Du bist in einer geschulten Gruppe?»), sonst ausblenden. Hinweis bei Rot: «nur in Gruppen mit geschulten Leuten, nie allein».
6. Bei jeder Skitour und Schneeschuhtour sichtbar: Risikofarbe, Lawinengefahrenstufe (wenn bekannt) und der Hinweis, das aktuelle SLF-Bulletin vor dem Start zu prüfen.
7. **Skitourenguru nicht scrapen.** Die Nutzungsrechte sind noch nicht geklärt.

## Tech-Stack

- Vite + React + TypeScript (strict)
- `vite-plugin-pwa` (Manifest, Service Worker, Installation auf dem Home-Bildschirm, `display: standalone`)
- Dexie für IndexedDB
- `suncalc` für Sonne und Mond (Auf- und Untergang, Golden Hour, Blue Hour, Mondphase, Mondaufgang)
- Vitest für Unit-Tests
- GitHub Actions → GitHub Pages (Base-Path beachten)

Frag mich, bevor du weitere Abhängigkeiten hinzufügst.

## Datenmodell (Vorschlag, gerne verbessern)

- **Profile:** Material (Liste, z. B. Ski, Tourenski, Felle, LVS-Set, Schneeschuhe, Kamera mit Stativ), Risikostufe 1–3, Grundkondition (max. Höhenmeter und Stunden), früheste Startzeit (vor Sonnenaufgang erlaubt), Startpunkte (Name + Koordinaten, z. B. «Zuhause», «Ferienhaus»).
- **Candidate** (eigene Liste): Name, Typ (`ski_resort` | `ski_tour` | `snowshoe_trail` | `photo_spot`), Koordinaten Tal und Ziel/Gipfel, Höhe, Höhenmeter, Dauer, Anreisezeit pro Startpunkt (manuell), signalisiert ja/nein (Schneeschuh), Preis CHF (optional), «schon gemacht», Notiz, Link (z. B. swisstopo oder Instagram), optionale Fotospot-Zuordnung.
- **RiskEntry:** Candidate-ID, Farbe (`green` | `orange` | `red`), Gefahrenstufe (optional), Datum, Quelle «Skitourenguru (manuell)».
- **WeekendInput:** Zeitbudget Sa/So (ganz / halb / frei), Anreise max. (1 h / 2 h / 3 h), Startpunkt, Tagesform (locker / normal / stark).
- **Suggestion / Plan:** Aktivität, Tag, Kandidat, Score mit Teilnoten, Begründung (Textbausteine), Zeitplan, Fotospot + Lichtzeit, Anreise, Preis, Risiko-Infos, Plan-B-Verweis.
- **Feedback:** Wochenende, umgesetzt ja/nein, Grund bei «nein», Anzahl passende Vorschläge (1 / 2 / 3), Strenge (zu leicht / passend / zu streng).

## Entscheidungslogik (reine Funktionen in `src/engine/`, vollständig getestet)

1. **Ausschluss:** Material fehlt · Risiko über der Stufe oder unbekannt (Regel 3) · Anreise > max. · Dauer passt nicht ins Zeitbudget · Start vor erlaubter Startzeit.
2. **Bedingungen:** Note 0–100 pro Kandidat und Tag aus Wetterdaten:
   - Ski: Sonne/Bewölkung, Neuschnee der letzten Tage, Wind, Temperatur.
   - Skitour/Schneeschuh: Sicht, Wind, Neuschnee, Sonne (bzw. klare Nacht und Mondphase bei Abendtouren).
   - Fotografie: Golden und Blue Hour, Wolkenbild (tiefe, mittlere, hohe Bewölkung), Sicht, Mondphase, **Nebelmeer-Heuristik** (erste Version: viel tiefe Bewölkung am Talpunkt, wenig Bewölkung und Inversion am Gipfelpunkt – als eigenes, kalibrierbares Modul mit Konstanten).
   - Alle Grenzwerte in **einer** Konfigurationsdatei (`src/engine/thresholds.ts`), damit ich sie nach dem Testen anpassen kann.
3. **Passung:** Kondition und Tagesform vs. Höhenmeter und Dauer · Zeitbudget · Mix: etwa 2 bewährte («schon gemacht») + 1 neue Option · Strenge-Feedback verschiebt die Kondition leicht.
4. **Auswahl:** 3 Vorschläge mit möglichst unterschiedlichen Aktivitäten, Orten oder Tagen + 1 Plan B (anderer Ort, andere Aktivität oder anderer Tag – die App wählt die beste Alternative für den Fall, dass Vorschlag 1 wegfällt).
5. **Foto-Zusatz:** Jeder Sport-Vorschlag bekommt den besten Fotospot in der Nähe und die passende Lichtzeit.
6. **Begründung:** 1–2 Sätze aus Textbausteinen, abgeleitet aus den stärksten Teilnoten. Keine KI.

## Datenquellen

- **Wetter:** Open-Meteo mit den MeteoSchweiz-Modellen ICON-CH. Prüfe Parameter und Modellnamen in der Doku: https://open-meteo.com/en/docs/meteoswiss-api . Für Prognosen nach 5 Tagen auf ein globales Modell zurückfallen. Antworten in IndexedDB cachen.
- **Lawinenrisiko:** Im MVP **manuell**: Ich trage am Donnerstag pro Tour die Skitourenguru-Farbe ein (schnelles Formular, Farbe in 1 Tap). Lege dafür ein Interface `AvalancheRiskProvider` an, damit später ein automatischer Anbieter dazukommen kann.
- **Sonne & Mond:** lokal mit `suncalc`.
- **Route:** Link zu swisstopo (map.geo.admin.ch mit Koordinaten) und GPX-Export, falls ich einen Track hinterlegt habe.

## Screens (siehe `board/06a`–`06d`)

1. **Donnerstag:** 4 Angaben (Zeitbudget Sa/So, Anreise max., Tagesform, Startpunkt) → «Vorschläge zeigen».
2. **Vorschläge:** 3 Karten + Plan-B-Karte. Pro Karte: Aktivität · Tag · Ort · Begründung · Anreise · Fotospot · Preis · Risikofarbe mit Text (Farbe nie allein) · Kennzeichnung «neu».
3. **Detailplan:** Risikohinweis, Zeitplan, Route-Export, Anreise mit Startpunkt → «Plan wählen».
4. **Vorabend-Check:** «Plan steht.» oder «Wechsel auf Plan B» mit Grund (neu berechnen mit aktuellen Daten).
5. **Feedback** (Sonntagabend): umgesetzt? · wie viele Vorschläge passten? · wie streng war die Tour?
6. **Verwaltung:** Profil, eigene Liste (Kandidaten anlegen, bearbeiten, «schon gemacht»), Risiko-Eingabe, **Export/Import als JSON** (Backup, da die Daten nur auf dem Gerät liegen).
7. **Auswertung:** Umsetzungsrate über die Testwochenenden und Ø passende Vorschläge.

**Deep Links** für die Kurzbefehle-Automation: `?view=thursday` öffnet Screen 1, `?view=check` öffnet den Vorabend-Check, `?view=feedback` das Feedback.

## Arbeitsweise

1. Lies das Konzept und die Screens. **Stell mir danach deine offenen Fragen** (z. B. Grenzwerte, Zeiten für Donnerstag und Vorabend) und schlage einen kurzen Umsetzungsplan in Etappen vor. **Warte auf mein OK**, bevor du Code schreibst.
2. Erstelle das Projekt im Unterordner `app/`. Initialisiere Git.
3. **Logik zuerst:** Datenmodell, Engine und Tests, bevor die Oberfläche entsteht. Die Engine muss ohne Browser testbar sein.
4. Danach Datenanbindung (Open-Meteo, suncalc, manuelles Risiko), dann die Screens.
5. Danach PWA, Deep Links und Deployment auf GitHub Pages.
6. Am Schluss ein `app/README.md` mit: lokal starten, deployen, auf dem iPhone zum Home-Bildschirm hinzufügen, **Kurzbefehle-Automation einrichten** (Automation → Tageszeit → «Sofort ausführen» → «URL öffnen» mit Deep Link), JSON-Format der eigenen Liste.
7. Kleine Commits pro Etappe. Nach jeder Etappe kurz zusammenfassen, was fertig ist und was ich testen soll.

## Fertig, wenn

- [ ] Alle Sicherheitsregeln sind umgesetzt und durch Tests abgedeckt.
- [ ] Die Engine liefert mit Testdaten 3 unterschiedliche Vorschläge + Plan B und eine Begründung pro Vorschlag.
- [ ] Unbekanntes oder veraltetes Risiko führt nie zu einem Skitour-Vorschlag.
- [ ] Die App läuft installiert auf dem iPhone-Home-Bildschirm, offline-fähig für zuletzt geladene Daten.
- [ ] Profil, eigene Liste, Risiko-Eingabe, Feedback und Export/Import funktionieren.
- [ ] Deep Links öffnen die richtigen Screens.
- [ ] Die Open-Meteo-Quellenangabe ist sichtbar.
- [ ] Die Grenzwerte sind zentral in einer Datei anpassbar.

## Nicht im MVP

Motorrad, Wandern, Rennrad · Grenzregionen · Bilder/Webcams · Packliste · ÖV-Verbindungen · Spot-Alarm · Kombi-Pläne · Teilen · KI-Texte · Server jeglicher Art.
