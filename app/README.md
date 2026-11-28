# Wochenend-Planer

Web-App (PWA) fürs iPhone: Jeden Donnerstag 3 Wochenendvorschläge + 1 Plan B für **Ski (Piste), Skitour, Schneeschuh und Fotografie** in der Schweiz – passend zu Material, Risikostufe, Zeitbudget, Startpunkt und Tagesform. Mit Detailplan, Vorabend-Check und Feedback.

- **Live:** https://fabianlieb.github.io/Weekendplanner/
- **Kein Backend, keine API-Schlüssel, keine Tracker.** Alles rechnet im Browser, Daten liegen nur auf dem Gerät (IndexedDB).
- Konzept: [`../01_Konzept_Wochenend-Planer.md`](../01_Konzept_Wochenend-Planer.md)

---

## Inhalt

1. [Lokal starten](#lokal-starten)
2. [Deployen (GitHub Pages)](#deployen-github-pages)
3. [Auf dem iPhone installieren](#auf-dem-iphone-installieren)
4. [Kurzbefehle-Automation einrichten](#kurzbefehle-automation-einrichten)
5. [Ablauf einer Woche](#ablauf-einer-woche)
6. [Sicherheitsregeln](#sicherheitsregeln)
7. [JSON-Format der eigenen Liste](#json-format-der-eigenen-liste)
8. [Grenzwerte anpassen](#grenzwerte-anpassen)
9. [Projektstruktur](#projektstruktur)
10. [Datenquellen und Lizenzen](#datenquellen-und-lizenzen)
11. [Bekannte Grenzen](#bekannte-grenzen)

---

## Lokal starten

Voraussetzung: **Node.js 24** (Windows reicht, kein Mac nötig).

```powershell
cd D:\Weekendplanner\app
npm ci
npm run dev
```

Dann http://localhost:5173 öffnen (im Browser die Entwicklertools auf Handybreite stellen).

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver mit Hot Reload |
| `npm test` | Alle Tests (Engine, Sicherheitsregeln, Daten, Hilfsfunktionen) |
| `npm run demo` | Druckt Beispielvorschläge mit Testdaten in die Konsole |
| `npm run typecheck` | TypeScript-Prüfung (strict) |
| `npm run build` | Produktions-Build nach `dist/` |
| `npm run preview` | Build lokal ansehen, inkl. Service Worker (offline testbar) |
| `node scripts/make-icons.mjs` | App-Symbole in `public/` neu erzeugen |
| `node scripts/build-catalog.mjs` | Routen-Katalog von geo.admin.ch neu laden (einige Minuten) |

Der Service Worker ist nur im Build aktiv (`npm run build` + `npm run preview`), nicht im Entwicklungsserver.

---

## Deployen (GitHub Pages)

Jeder Push auf `main` startet [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml): `npm ci` → `npm test` → `npm run build` → GitHub Pages. Schlägt ein Test fehl, wird nichts veröffentlicht.

Einmalig im Repo: **Settings → Pages → Source: «GitHub Actions»**. Gratis-Konten brauchen ein **öffentliches** Repo.

Der Basispfad wird automatisch aus dem Repo-Namen gesetzt (`BASE_PATH=/<repo>/`). Lokal mit Basispfad bauen:

```powershell
$env:BASE_PATH='/Weekendplanner/'; npm run build; Remove-Item Env:BASE_PATH
```

Neue Versionen lädt die installierte App beim nächsten Öffnen automatisch (Service Worker `autoUpdate`); notfalls die App einmal ganz schliessen und neu öffnen.

---

## Auf dem iPhone installieren

1. In **Safari** https://fabianlieb.github.io/Weekendplanner/ öffnen.
2. **Teilen** → **«Zum Home-Bildschirm»** → «Als Web-App öffnen» eingeschaltet lassen → **Hinzufügen**.
3. Die App **über das neue Symbol** öffnen und dort einrichten: *Profil* (Sportarten und Niveau, Material, Kondition, früheste Abfahrt, Startpunkte), dann unter *Liste* die Startliste laden oder eigene Einträge anlegen. Die App ist danach in drei Tabs gegliedert: **Wochenende** (Startseite), **Liste**, **Profil** (mit Backup und Auswertung).


**Wichtig:**

- Die Home-Bildschirm-App hat **eigene Daten**, getrennt von Safari. Was du in einem Safari-Tab einträgst, sieht die App nicht. Läuft die Seite in Safari, zeigt sie einen Hinweis.
- Home-Bildschirm-Apps sind von Safaris 7-Tage-Löschung ausgenommen. Trotzdem: **regelmässig ein Backup** machen (*Profil → Backup & Import → Backup als JSON speichern* → «In Dateien sichern»).
- Startpunkte: Koordinaten als `47.3769, 8.5417` oder direkt aus swisstopo als LV95 (`2'683'000, 1'248'000`) einfügen, oder «Aktueller Standort».
- Offline: Die App selbst, die zuletzt berechneten Vorschläge und das zuletzt geladene Wetter sind offline verfügbar. Neues Wetter braucht Netz.

---

## Kurzbefehle-Automation einrichten

Ziel: Die App meldet sich zur richtigen Zeit – ohne Server.

### Deep Links

| Link | Öffnet |
|---|---|
| `https://fabianlieb.github.io/Weekendplanner/?view=thursday` | Donnerstag: 4 Angaben |
| `https://fabianlieb.github.io/Weekendplanner/?view=check` | Vorabend-Check |
| `https://fabianlieb.github.io/Weekendplanner/?view=feedback` | Feedback |

### Automationen anlegen

In der App **Kurzbefehle** → **Automation** → **+** → **Tageszeit**:

| Automation | Uhrzeit | Wiederholen | Link |
|---|---|---|---|
| Vorschläge | 18:00 | Wöchentlich, Donnerstag | `?view=thursday` |
| Vorabend-Check | 18:00 | Wöchentlich, Freitag und Samstag | `?view=check` |
| Feedback | 19:00 | Wöchentlich, Sonntag | `?view=feedback` |

Jeweils: **«Sofort ausführen»** wählen → **Weiter** → Aktion **«URL öffnen»** → den vollen Link einsetzen → **Fertig**. Ist das iPhone gesperrt, muss das Öffnen kurz bestätigt werden.

### Achtung: Safari oder App?

iOS öffnet «URL öffnen» je nach Version **in Safari statt in der installierten App** – und Safari hat nicht deine Daten (siehe oben). Der früher genannte Trick mit `webapp://` funktioniert laut Berichten seit April 2026 nicht mehr. **Teste einmal**, was bei dir passiert:

- **Öffnet sich die App:** fertig, die Links führen direkt auf den richtigen Screen.
- **Öffnet sich Safari:** nimm die Automation nur als Erinnerung (z. B. Aktion «Mitteilung anzeigen» statt «URL öffnen») und **tippe dann aufs App-Symbol**. Die Startseite *Wochenende* zeigt dann von selbst, was ansteht: am Vorabend den Knopf «Vorabend-Check machen» in der Karte «Dein Plan», von Sonntagabend bis Mittwoch die Frage nach dem Feedback.
- **Noch einfacher:** den gewählten Plan mit dem Kalender-Knopf eintragen – der Kalender erinnert dich am Vorabend um 18:00 und 30 min vor der Abfahrt.

---

## Ablauf einer Woche

1. **Donnerstag:** *Wochenende* öffnen. Die Startseite zeigt sofort Vorschläge mit deinen letzten Einstellungen und deinem Standort; sie aktualisiert sich **einmal pro Tag am Morgen** automatisch, sonst über «Aktualisieren».
   - **Skitourenguru-Farben:** Der Block «… passende Touren warten auf die Skitourenguru-Farbe von heute» listet nur Touren, die sonst zu dir passen würden. Pro Tour die aktuelle Farbe von [Skitourenguru](https://www.skitourenguru.ch) antippen (optional die Gefahrenstufe laut Bulletin) → **Mit diesen Farben neu vorschlagen**.
   - **Einstellungen:** eine Zeile wie «Sa ganz · So frei · 2 h · Normal · Zuhause» – antippen öffnet Zeitbudget, Anreise max., Tagesform und Startpunkt → **Neu vorschlagen**.
   - **Startpunkt «Standort»:** Liegt dein Standort weniger als 10 km von einem gespeicherten Startpunkt entfernt, gelten dessen Anreisezeiten; sonst schätzt die App ab dem Standort. Ohne Standortfreigabe rechnet sie ab dem gespeicherten Startpunkt (mit Hinweis). Der Standort bleibt auf dem Gerät.
   - Jede Karte zeigt das Wetter oben während der Aktivität, z. B. «−5 °C · Böen 25 km/h · 6 h Sonne · 12 cm Neuschnee», bei Bedarf «Nebelmeer wahrscheinlich».
   - Einen Vorschlag öffnen → **Plan wählen** (Leiste unten) → **Kalender-Knopf** (Kalender mit Plus) und **Navigation**. Der Plan erscheint dann oben als **«Dein Plan»** und bleibt erhalten, auch wenn er nach einer Aktualisierung nicht mehr vorgeschlagen würde.
2. **Freitagabend** (bzw. Samstagabend für einen Sonntagsplan): Farben **von heute** eintragen → in «Dein Plan» **Vorabend-Check machen**. Ergebnis: «Plan steht.» oder «Wechsel auf Plan B» mit Grund → ggf. **Plan B übernehmen**.
3. **Unterwegs:** SLF-Bulletin vor dem Start prüfen.
4. **Sonntagabend:** Die Startseite fragt nach dem **Feedback** – umgesetzt? wie viele Vorschläge passten? wie streng war die Tour? Die Auswertung zeigt Umsetzungsrate und Ø passende Vorschläge über die 8 Testwochenenden.

---

### Katalog: Vorschläge ohne eigene Liste

Die App schlägt aus einem **Katalog** vor; die eigene Liste ergänzt ihn (z. B. um Fotospots):

| Quelle | Inhalt | Anzahl (Nov. 2026) |
|---|---|---|
| swisstopo / SAC, Skirouten | Gipfel, Route, SAC-Schwierigkeit, Höhenmeter, Aufstiegszeit, Link ins SAC-Tourenportal | 2472 |
| swisstopo / SAC, Schneeschuhrouten | dito, Schwierigkeit WT1–WT5 (nicht signalisiert → braucht Skitourenguru-Farbe) | 391 |
| ASTRA / SchweizMobil, Schneeschuhwanderwege | signalisierte Trails mit Länge, Höhenmeter, Zeit, Link zu SchweizMobil | 396 |
| eingebaute Liste | 26 grössere Skigebiete (Koordinaten ungefähr) | 26 |

- **Auswahl:** Vor dem Wetterabruf filtert die App nach Sportart, **Schwierigkeit** (Profil: Skitour bis L/WS/ZS/S, Schneeschuh bis leicht/mittel/schwer), Kondition und geschätzter Anreise und nimmt pro Sportart die nächstgelegenen (bis 40 Skitouren, 30 Schneeschuh, 15 Skigebiete). Merkorte, als gemacht markierte und der gewählte Plan kommen immer mit. Eigene Einträge haben Vorrang: ein Katalog-Eintrag mit Gipfel unter 1 km von einem eigenen fällt weg.
- **Farben:** Touren brauchen weiterhin die Skitourenguru-Farbe von heute. Die App fragt nur die **5 passendsten** ab (mit Link zur Route beim SAC, damit du sie auf Skitourenguru findest).
- **Liste → Katalog:** suchen, nach Sportart filtern, Orte merken (Stern), als gemacht markieren, ausblenden («Nicht vorschlagen») oder «In eigene Liste übernehmen», um Anreisezeiten, Parkplatz und Packliste zu ergänzen.
- **Aktualisierung:** `node scripts/build-catalog.mjs` lädt die Daten über die offene API von geo.admin.ch (ohne Schlüssel) nach `public/catalog/routes.json`, die Routenlinien kompakt nach `scripts/route-lines.json`. Der Deploy-Workflow macht das monatlich automatisch (bei einem Fehler bleibt der gespeicherte Stand).
- **Lizenz:** Open Government Data; die Quellenangabe ist Pflicht und steht auf jeder Seite («Routen: © swisstopo / SAC · Schneeschuhwanderwege: ASTRA / SchweizMobil»). Routenangaben ohne Gewähr – der effektive Verlauf hängt von den Verhältnissen ab.

### Bilder, Sport-Symbole und GPS-Tracks

- **Sport-Symbol** (Ski, Skitour, Schneeschuh, Foto) auf jeder Karte, in «Dein Plan» und im Detailplan.
- **Bild pro Ort:** von Wikipedia / Wikimedia Commons, nur wenn ein Artikel in der Nähe des Ziels zum Ortsnamen passt – sonst kein Bild. Im Detailplan stehen Urheber und Lizenz (Pflicht bei CC-Lizenzen). An Wikipedia gehen nur die Koordinaten des Ziels, nie dein Standort. Ergebnisse (auch «kein Bild») bleiben 30 Tage auf dem Gerät.
- **GPS-Track:** Katalog-Routen (SAC, SchweizMobil) haben eine Routenlinie; die App lädt sie bei Bedarf von geo.admin.ch, zeichnet sie im Detailplan (Start = Kreis, Ziel = Dreieck) Eine eigene GPX-Datei (Editor) hat Vorrang. Karten mit Track tragen den Hinweis «GPS-Track». Ohne Track wird nichts angezeigt.
- **Route in der Karten-App öffnen:** Bei Katalog-Routen öffnen die Knöpfe «swisstopo» und «Guru Maps» die Route direkt in der jeweiligen App. Beide Apps laden die GPX-Datei von einer öffentlichen Adresse; deshalb erzeugt `npm run build` (Schritt `scripts/build-gpx.mjs`) aus `scripts/route-lines.json` eine GPX-Datei pro Route unter `catalog/gpx/` (rund 44 MB, wird mit der App auf GitHub Pages veröffentlicht, aber nicht vorgeladen). Links: swisstopo `https://swisstopo.app/u/<GPX-URL in Base64>` (offizieller Routen-Link), Guru Maps `guru://open?url=<GPX-URL>`. Eine eigene GPX-Datei hat keine öffentliche Adresse: «GPX teilen» und im Teilen-Menü die App wählen.

### Kalender

Der Kalender-Knopf (im Detailplan und in «Dein Plan») erzeugt einen Termin (.ics) von der Abfahrt bis zur Rückkehr mit Ort, Wetter, Risikohinweis, Zeitplan, Packliste und Navigationslink sowie zwei Erinnerungen: **am Vorabend um 18:00** («Vorabend-Check») und **30 min vor der Abfahrt**. Er bietet zwei Wege:

- **Im Kalender öffnen:** Die App legt die Datei in ihren Offline-Speicher; der Service Worker liefert sie unter einer echten Adresse der App aus (`…/calendar/….ics`, `text/calendar`), und iOS zeigt «Zum Kalender hinzufügen». (Ein `data:`-Link funktioniert in der installierten App nicht.)
- **Als Datei teilen:** Teilen-Menü → z. B. «In Dateien sichern», die Datei dort öffnen → «Alle hinzufügen». Funktioniert auch, wenn der erste Weg auf einer iOS-Version nicht greift.

Am Computer wird die Datei heruntergeladen.

### Packliste

Jeder Plan hat eine Packliste: Grundausrüstung pro Sportart, angepasst an die Lage (LVS-Set bei Touren und nicht signalisierten Trails, Stirnlampe bei Abend- und Fototouren, Kamera und Stativ beim Fotospot) plus eigene Ergänzungen pro Ort (Editor: «Zusätzlich mitnehmen»). Im Detailplan abhaken; die Liste steht auch im Kalendereintrag.

### Plan teilen

Der Teilen-Knopf schickt einen Link, der den ganzen Plan enthält (nach dem `#`, wird also nie an einen Server übertragen). Wer ihn öffnet, sieht Zeitplan, Wetter, Risikohinweis, Packliste und Navigation – ohne App-Einrichtung, und nichts wird gespeichert.

### Merkliste und Spot-Radar

In der Liste markiert der **Stern** einen Ort für die Merkliste. Bei jeder Aktualisierung prüft die App die nächsten 7 Tage; Merkorte mit sehr guten Bedingungen (z. B. «Nebelmeer wahrscheinlich · Sonnenaufgang 07:34») erscheinen auf der Startseite unter «Merkliste · lohnt sich». Touren im Lawinengelände erscheinen dort bewusst nicht. Koordinaten neuer Orte lassen sich auch als **Google-Maps- oder Apple-Maps-Link** einfügen (z. B. von einem Instagram-Ort); Kurzlinks (maps.app.goo.gl) bitte zuerst im Browser öffnen und den langen Link kopieren.

### Feedback

Am Sonntagabend bewertest du jeden der 3 Vorschläge mit «Passt» oder «Passt nicht», dazu umgesetzt ja/nein und die Strenge. Die Auswertung (Profil → Auswertung) zeigt Umsetzungsrate, Ø passende Vorschläge und die Trefferquote pro Sportart.

### Navigation und Parkplatz

«Navigation (Google Maps)» im Detailplan führt zum **Parkplatz**, falls im Eintrag hinterlegt, sonst zum Startpunkt (Touren, Trails), zur Talstation (Skigebiete) bzw. zum Fotostandort.

---

## Sicherheitsregeln

Umgesetzt in [`src/engine/risk.ts`](src/engine/risk.ts) und abgesichert in [`src/engine/safety.test.ts`](src/engine/safety.test.ts):

1. Die App schreibt **nie** «sicher» – ein Test durchsucht allen App-Code und alle erzeugten Texte.
2. Das Lawinenrisiko kommt **nur** aus den Skitourenguru-Farben, die du einträgst. Keine eigene Risikoberechnung, kein Scraping.
3. **Fail closed:** Ein Eintrag gilt nur **am Tag, an dem er gemacht wurde**. Fehlt die Farbe von heute (Skitour oder nicht signalisierter Schneeschuh-Trail), gilt das Risiko als unbekannt – keine Vorschläge, kein Plan B, und der Vorabend-Check wechselt auf Plan B.
4. Filter nach dem Niveau pro Sportart im Profil (Skitour und Schneeschuh je Stufe 1–3): 1 → nur grün · 2 → grün und orange · 3 → zusätzlich rot. Sportarten, die du im Profil ausschaltest, werden nie vorgeschlagen.
5. Rot nur bei Stufe 3 **und** Bestätigung «Du bist in einer geschulten Gruppe?» (wird jedes Wochenende neu gefragt, nie gespeichert). Hinweis: «nur in Gruppen mit geschulten Leuten, nie allein».
6. Jede Tour zeigt Risikofarbe (immer mit Text), Gefahrenstufe und den Hinweis aufs SLF-Bulletin.

Ein Fuzz-Test prüft 300 zufällige Kombinationen aus Farben, Daten und Stufen.

---

## JSON-Format der eigenen Liste

Unter *Profil → Backup & Import → JSON-Datei wählen* lassen sich zwei Formate importieren. Ungültige Dateien werden mit Fehlerliste abgelehnt, es wird dann nichts geändert.

### 1. Kandidatenliste (eigene Liste, wird immer zusammengeführt)

Entweder ein Array `[ … ]` oder ein Objekt `{ "candidates": [ … ] }`:

```json
{
  "candidates": [
    {
      "id": "pizol",
      "name": "Pizol",
      "kind": "ski_tour",
      "region": "Sarganserland",
      "valley": { "lat": 46.985, "lon": 9.425, "elevation": 2220 },
      "summit": { "lat": 46.9703, "lon": 9.3967, "elevation": 2844 },
      "elevationGain": 700,
      "durationHours": 4,
      "travelMinutes": { "home": 75 },
      "eveningPossible": false,
      "done": true,
      "active": true,
      "link": "https://www.sac-cas.ch/de/huetten-und-touren/sac-tourenportal/",
      "note": "Start ab Bergstation"
    },
    {
      "name": "Rigi Kulm",
      "kind": "photo_spot",
      "valley": { "lat": 47.0856, "lon": 8.4419, "elevation": 440 },
      "summit": { "lat": 47.0567, "lon": 8.485, "elevation": 1797 },
      "durationHours": 1.5,
      "approachMinutes": 10
    }
  ]
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | nein | Eindeutige ID. Fehlt sie, wird eine erzeugt. Gleiche ID = Eintrag wird überschrieben. |
| `name` | ja | Name |
| `kind` | ja | `ski_resort` · `ski_tour` · `snowshoe_trail` · `photo_spot` |
| `region` | nein | Text |
| `valley` | ja | `{ lat, lon, elevation }` – Talstation, Startpunkt, Trailstart; bei Fotospots der **Talpunkt** für die Nebelmeer-Erkennung (tief im Tal davor) |
| `summit` | ja | `{ lat, lon, elevation }` – Bergstation, Gipfel, höchster Punkt bzw. **Fotostandort** |
| `elevationGain` | bei Touren/Trails | Höhenmeter |
| `durationHours` | ja | Zeit vor Ort in Stunden (0.1–24): Tour total, Skitag, bei Fotospots Mindestaufenthalt |
| `approachMinutes` | nein | Fotospots: Zustieg vom Parkplatz, einfach, Minuten |
| `travelMinutes` | nein | `{ "<Startpunkt-ID>": Minuten }`, einfache Fahrt. Fehlt ein Wert, schätzt die App aus der Luftlinie («geschätzt»). Die Startpunkt-IDs stehen im Backup unter `profile.startPoints`. |
| `signposted` | nein | Schneeschuh: signalisierter Trail (`true`) braucht keine Farbe; sonst gilt er als Tour im Lawinengelände |
| `eveningPossible` | nein | Tour/Trail auch nach Sonnenuntergang (klare Nacht, Mond) |
| `priceChf` | nein | Skigebiet: Tageskarte in CHF (wird nur angezeigt) |
| `done` | nein | «schon gemacht» (bewährt), Standard `false` |
| `active` | nein | Wird vorgeschlagen, Standard `true` |
| `parking` | nein | `{ lat, lon }` – Parkplatz für die Navigation (Google Maps) |
| `favorite` | nein | Merkliste (Spot-Radar), Standard `false` |
| `difficulty` | nein | Schwierigkeit: SAC-Skala (`L`, `WS`, `ZS` …, `WT1`–`WT6`) oder Trail-Farbe (`blau`, `rot`, `schwarz`) |
| `packing` | nein | Liste zusätzlicher Gegenstände für die Packliste |
| `photoSpotIds` | nein | IDs zugeordneter Fotospots (sonst automatisch im Umkreis von 10 km) |
| `link` | nein | Muss mit `http://` oder `https://` beginnen |
| `note` | nein | Text |
| `gpx` | nein | GPX-Track als Text (für den GPX-Export im Detailplan) |

Koordinaten in WGS84 (Dezimalgrad), Höhen in Metern über Meer. Im Editor der App kannst du statt Koordinaten auch einen **swisstopo-Link** (map.geo.admin.ch) einfügen – die App liest die Koordinaten daraus. Anreisezeiten aller Einträge trägst du am schnellsten unter *Liste → Anreisezeiten* in einer Tabelle ein (leere Felder zeigen die Schätzung).

### 2. Vollständiges Backup

Erzeugt von *Backup als JSON speichern*; Import wahlweise **zusammenführen** oder **alles ersetzen**:

```json
{
  "format": "wochenend-planer",
  "version": 1,
  "exportedAt": "2026-12-06T19:00:00.000Z",
  "profile": {
    "equipment": ["alpine_ski", "touring_ski", "skins", "avalanche_kit", "snowshoes", "camera", "tripod"],
    "activities": {
      "ski_tour": { "enabled": true, "level": 2 },
      "snowshoe": { "enabled": true, "level": 2 },
      "ski": { "enabled": true, "level": 1 },
      "photo": { "enabled": true, "level": 1 }
    },
    "maxDifficulty": { "ski_tour": "WS", "snowshoe": "mittel" },
    "fitness": { "maxElevationGain": 1200, "maxHours": 6 },
    "earliestStart": 300,
    "startPoints": [{ "id": "home", "name": "Zuhause", "lat": 47.3769, "lon": 8.5417 }]
  },
  "candidates": [],
  "riskEntries": [{ "candidateId": "pizol", "color": "green", "dangerLevel": 2, "date": "2026-12-03", "source": "Skitourenguru (manuell)" }],
  "feedback": [{ "weekend": "2026-12-05", "implemented": true, "fittingSuggestions": 2, "strictness": "fitting" }],
  "weekendPlans": []
}
```

- `activities`: pro Sportart (`ski_tour`, `snowshoe`, `ski`, `photo`) `enabled` und `level` 1–3 (begrenzt bei Skitour und Schneeschuh die Skitourenguru-Farben). Ältere Backups mit einem einzigen `riskLevel` werden weiterhin gelesen.
- `equipment`: `alpine_ski`, `touring_ski`, `skins`, `avalanche_kit` (LVS, Sonde, Schaufel), `snowshoes`, `camera`, `tripod`
- `earliestStart`: Minuten nach Mitternacht (300 = 05:00)
- `riskEntries[].color`: nur `green`, `orange`, `red`; `dangerLevel` 1–5; `date` = Tag der Eingabe (gilt nur an diesem Tag)
- `feedback[].strictness`: `too_easy`, `fitting`, `too_hard`; `fittingSuggestions` 0–3; optional `ratings`: `[{ suggestionId, candidateId, activity, fits }]`
- Das Wetter wird nicht exportiert (wird neu geladen).

---

## Grenzwerte anpassen

Alle Grenzwerte stehen in **einer** Datei: [`src/engine/thresholds.ts`](src/engine/thresholds.ts). Die wichtigsten:

| Bereich | Wert | Standard |
|---|---|---|
| `time.budgetHours` | Tür zu Tür: ganzer / halber Tag | 12 h / 6 h |
| `time.tourStartPreferred` | Start am Ausgangspunkt | 08:30 |
| `time.daylightMarginMinutes` | Tagestouren zurück vor Sonnenuntergang | 30 min |
| `fitness.dayFormFactor` | locker / normal / stark | 0.7 / 1.0 / 1.15 |
| `fitness.feedbackStep` / `feedbackCap` | Strenge-Feedback verschiebt Kondition | ±5 % / max. ±15 % |
| `weather.ski.gustKnockout` | Böen, ab denen ein Skitag wegfällt | 70 km/h |
| `weather.tour.gustKnockout` | Böen, ab denen eine Tour wegfällt | 60 km/h |
| `fogSea.*` | Nebelmeer: tiefe Wolken im Tal, klarer Gipfel, Inversion | 70 % / 30 % / ≥ 0 °C |
| `scoring.minConditionScore` | Mindestnote Bedingungen | 35 |
| `selection.targetNew` | neue Optionen pro Wochenende | 1 |
| `travelEstimate.*` | Anreise-Schätzung aus der Luftlinie | Faktor 1.3, 70 km/h, +10 min |
| `photoAddOn.radiusKm` | automatische Fotospots im Umkreis | 10 km |

Nach einer Änderung `npm test` laufen lassen und pushen.

---

## Projektstruktur

```
app/
├─ src/
│  ├─ engine/        Reine Funktionen, ohne Browser testbar
│  │  ├─ thresholds.ts   alle Grenzwerte
│  │  ├─ types.ts        Datenmodell
│  │  ├─ risk.ts         Skitourenguru-Farben, Fail closed, Filter
│  │  ├─ conditions.ts   Wetternoten pro Aktivität
│  │  ├─ fogSea.ts       Nebelmeer-Heuristik
│  │  ├─ timing.ts       Zeitbudget, Startzeit, Tageslicht
│  │  ├─ fit.ts          Kondition, Tagesform, Feedback
│  │  ├─ photoAddOn.ts   Fotospot + Lichtzeit pro Sport-Vorschlag
│  │  ├─ suggest.ts      Ausschluss → Bedingungen → Passung → Auswahl + Plan B
│  │  ├─ eveningCheck.ts Vorabend-Check
│  │  ├─ texts.ts        alle Textbausteine (Deutsch)
│  │  └─ *.test.ts       Tests, inkl. safety.test.ts
│  ├─ data/          IndexedDB (Dexie), Open-Meteo, Backup, Startliste
│  └─ ui/            React-Screens (Wochenende, Liste, Profil), Routing, Stile
├─ public/           App-Symbole
└─ scripts/          Symbol-Generator
```

---

## Datenquellen und Lizenzen

- **Wetter:** [Open-Meteo](https://open-meteo.com/) – *Weather data by Open-Meteo.com*, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), nicht kommerziell. Modell `meteoswiss_icon_seamless` (MeteoSchweiz ICON-CH1/CH2, ca. 5 Tage), stundenweise ergänzt durch `best_match` (global). Sichtweite stammt immer aus dem globalen Modell (ICON-CH liefert keine). Die Quellenangabe ist auf jedem Screen sichtbar.
- **Lawinenrisiko:** Farben von [Skitourenguru](https://www.skitourenguru.ch), **manuell** eingetragen. Kein Scraping – die Nutzungsrechte sind nicht geklärt. Für einen späteren automatischen Anbieter gibt es das Interface `AvalancheRiskProvider`.
- **Sonne & Mond:** lokal mit [suncalc](https://github.com/mourner/suncalc).
- **Karten:** Links auf [map.geo.admin.ch](https://map.geo.admin.ch) (swisstopo).
- **Bilder:** Wikipedia / Wikimedia Commons, Lizenz und Urheber pro Bild im Detailplan.
- **Routenlinien:** geo.admin.ch (© swisstopo / SAC, ASTRA / SchweizMobil).
- **Schrift:** Inter (SIL Open Font License), lokal eingebunden.

---

## Bekannte Grenzen

- **Startliste und Skigebiete:** Beispiele bzw. eingebaute Skigebiete mit **ungefähren** Koordinaten – bei Bedarf prüfen («In swisstopo prüfen» im Editor).
- **Katalog-Routen:** Start und Gipfel werden aus der Routenlinie und dem Höhenmodell abgeleitet; Dauer = SAC-Aufstiegszeit plus geschätzte Abfahrt. Anreise wird aus der Luftlinie geschätzt.
- **Anreise:** ohne eingetragene Zeit nur eine Schätzung aus der Luftlinie – auch beim Startpunkt «Standort» weit weg von gespeicherten Startpunkten. Für verlässliche Pläne die Minuten pro Startpunkt eintragen (Tabelle *Anreisezeiten*).
- **Kalender auf dem iPhone:** ob die installierte App den Dialog «Zum Kalender hinzufügen» direkt öffnet, hängt von der iOS-Version ab – bitte testen.
- **Foto-Zusatz:** Die Fahrt zwischen Fotospot und Aktivität wird vorsichtig aus der Luftlinie geschätzt; Bergketten kennt die App nicht. Fotospots deshalb am besten selbst zuordnen.
- **Pisten offen, Andrang, Schneehöhe:** nicht berücksichtigt (keine freie Datenquelle); inaktive Skigebiete in der Liste ausschalten.
- **Kurzbefehle:** öffnen je nach iOS Safari statt der App (siehe oben).
- **Nebelmeer:** erste, einfache Heuristik – nach den Testwochenenden in `thresholds.ts` kalibrieren.
