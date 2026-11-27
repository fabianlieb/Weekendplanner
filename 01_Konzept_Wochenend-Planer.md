# Wochenend-Planer – App-Konzept

**Stand:** 27.11.2026 · Version 3 (Web-App)
**Board online:** https://claude.ai/artifact/U3zdqnN6y4aeKyNGALM2rM
**Board offline:** Ordner `board/` (HTML) und `Konzept-Board.pdf`

---

## 1. Kurzfassung

> **Freitagabend entschieden statt überfordert.**

Eine Web-App für das iPhone, die jeden Donnerstag drei realistische Wochenendvorschläge macht – für Ski, Skitour, Schneeschuh und Fotografie in der Schweiz. Passend zu Material, Risikostufe und Zeitbudget, mit fertigem Plan, automatischem Plan B und Check am Vorabend. Gerechnet wird lokal im Browser – ohne Server, ohne Mac.

| Thema | Entscheid |
|---|---|
| Zielgruppe | Zuerst ich selbst, später eine Nische (Multisportler in der Schweiz) |
| Planung | Solo, Plan teilbar per Link |
| Region | Schweiz im MVP, Grenzregionen (AT, DE, IT, FR) ab Release 2 |
| Horizont | Wochenende und Kurztrips, Nachricht jeden Donnerstag |
| MVP-Aktivitäten | Ski (Piste), Skitour, Schneeschuh, Fotografie – diesen Winter selbst testbar |
| Plattform | Web-App (PWA) auf dem Home-Bildschirm, alles lokal |
| Alleinstellung | Persönliche Passung (Material, Risikostufe, Zeit, Tagesform) |
| Kennzahl | Umsetzungsrate: Anteil Wochenenden mit umgesetztem Vorschlag |
| Geld | Keins – Side-Project |

**Wochenrhythmus:** Donnerstag Vorschläge (3 Optionen + Plan B) → Freitag Entscheid → Vorabend-Check («Plan steht» oder «Plan B») → Samstag/Sonntag unterwegs → danach Feedback.

---

## 2. Vorgehen

Das Konzept folgt bewährten Methoden der Produktentwicklung:

1. **Problem/Solution Fit zuerst** – prüfen, ob das Problem echt ist, bevor gebaut wird.
2. **Lean Canvas** – das Modell auf einer Seite.
3. **Job Stories (Jobs-to-be-Done)** – «Wenn [Situation], will ich [Motivation], damit [Ergebnis]».
4. **User Story Map (Jeff Patton)** – Nutzerreise horizontal, Releases vertikal, MVP-Linie ziehen.
5. **Annahmen testen** – die riskanteste Annahme zuerst.

---

## 3. Problem & Zielgruppe

### Kern-Job

> «Wenn ich am Freitagabend vor dem Wochenende stehe, will ich wenige, realistische und passende Vorschläge inklusive Plan B – damit ich nicht vor vielen Optionen stehe, von denen keine passt.»

### Persona 1 – ich selbst

Multisportler aus dem Raum Zürich / Ostschweiz:
- Motorrad auf der Strasse und im Gelände
- Landschafts- und Astrofotografie
- Bergtouren mit SAC-Hütten, gute Ausdauer
- Wenig Zeit unter der Woche, plant am Donnerstag- oder Freitagabend

### Pain Points

| Pain Point | Beschreibung |
|---|---|
| Was lohnt sich? | Unklar, welche Aktivität bei diesem Wetter die beste ist |
| Zu viele Quellen | Wetter, Routen, Bulletins und ÖV einzeln prüfen |
| Kein Plan B | Wetter kippt, das Wochenende ist verloren |
| *Nicht das Problem* | Detailplanung – die exakte Route bleibt bei swisstopo |

### Heute genutzt

- Wetter-Apps (MeteoSchweiz, Meteoblue)
- Routen-Apps (Komoot, Calimoto)
- Berg & Winter (SAC, White Risk, Skitourenguru)
- swisstopo (exakte Route, Zustand der Wege)
- Instagram (Inspiration: Wo ist es schön?)

### Markt & Positionierung

- **Wetter-Score-Apps** sagen, *ob* sich etwas lohnt – nicht *was, wo und wie*.
- **Spezial-Apps** (Calimoto, PhotoPills, Skitourenguru) decken je eine Sportart ab.
- **Komoot + ChatGPT** bietet seit Februar 2026 KI-Routensuche per Text.
- **Positionierung:** Entscheidungsschicht *über* den Spezial-Apps, kein Ersatz.

### Erkenntnisse

1. **Entscheidung statt Detailplanung** – die App ist ein Kurator: filtern, empfehlen, an swisstopo übergeben.
2. **«Passend» heisst personalisiert** – ohne Wissen über die eigenen Grenzen wirkt kein Vorschlag realistisch.
3. **Inspiration + Fakten zusammen** – «Wo ist es schön?» und «Passen die Bedingungen?» in einer Ansicht.

---

## 4. Job Stories

| # | Wenn … | will ich … | damit … |
|---|---|---|---|
| 1 | die Prognose am Donnerstag klarer wird, | wissen, welche meiner Aktivitäten sich lohnt, | ich keinen Top-Tag verschenke. |
| 2 | ich mich entschieden habe, | Zeitplan, Anreise, Route und Packliste, | ich nicht selbst recherchieren muss. |
| 3 | das Wetter kippt, | automatisch einen Plan B, | das Wochenende nicht verloren ist. |
| 4 | ich auf Ski oder Schneeschuh unterwegs bin, | zur besten Lichtstimmung am richtigen Ort sein, | ich Sport und Fotografie verbinde. |
| 5 | ich auf Instagram einen schönen Ort sehe, | ihn speichern, | die App meldet, sobald die Bedingungen passen. |

---

## 5. Entscheidungslogik

### Profil

| Festes Profil (einmalig) | Angaben fürs Wochenende (jeden Donnerstag, 4 Taps) |
|---|---|
| Material & Fahrzeuge | Zeitbudget (Sa/So: ganzer Tag, halber Tag, frei) |
| Risikostufe 1–3 (Selbsteinschätzung) | Anreise max. (1 h / 2 h / 3 h) |
| Grundkondition | Startpunkt (z. B. Zuhause, Ferienhaus, anderer) |
| Früheste Startzeit: vor Sonnenaufgang ok | Tagesform (locker / normal / stark) |
| | *Sportarten ausschliessen (ab R2)* |

### Vier Stufen

**Eingang:** Kandidaten aus der eigenen Liste plus automatischen Quellen.

1. **Ausschluss** – Material fehlt, Risiko über der eigenen Stufe, Anreise zu lang → Ort fällt raus.
2. **Bedingungen** – Wetter, Licht, Schnee, Lawinenrisiko → Note pro Ort und Sportart.
3. **Passung** – Kondition, Zeitbudget, Tagesform, Mix aus Bewährtem und Neuem (2 + 1) → Gewichtung.
4. **Auswahl** – 3 möglichst unterschiedliche Vorschläge + 1 Plan B. Regeln entscheiden, Textbausteine begründen. Plan B wählt die App (anderer Ort, andere Aktivität oder anderer Tag).

### Kriterien im MVP (Winter)

| Aktivität | Lohnt sich, wenn … | Mögliche Datenquellen | Sicherheit |
|---|---|---|---|
| Ski (Piste) | Neuschnee und Sonne, Pisten offen, wenig Andrang · Preis wird angezeigt | ICON-CH via Open-Meteo, Bergbahnen, Schneehöhen | – |
| Skitour | Geringes Risiko laut Skitourenguru, gute Sicht, guter Schnee | Skitourenguru, SLF-Bulletin, MeteoSchweiz | Farbe von Skitourenguru, Filter nach Risikostufe |
| Schneeschuh | Signalisierter Trail oder geringes Risiko, Sonne oder klare Nacht | Skitourenguru (Abdeckung prüfen), SLF, Trail-Infos | Wie Skitour |
| Fotografie | Nebelmeer, Wolkenbild, Sicht, Mondphase, Golden und Blue Hour – als eigener Ausflug oder Zusatz zu jedem Plan | ICON-CH via Open-Meteo, Astro-Berechnung lokal | – |
| *Ab Release 2* | Motorrad, Wandern, Rennrad · Grenzregionen | | |

### Risikostufen

Die drei Stufen entsprechen den Farben von Skitourenguru (grün / orange / rot).

| Stufe | Skitourenguru | Hinweis der App |
|---|---|---|
| 1 | grün – geringes Risiko | für alle Niveaus |
| 2 | orange – erhöhtes Risiko | Vorsicht, nur mit guter Ausrüstung |
| 3 | rot – hohes Risiko | nur in Gruppen mit geschulten Leuten, nie allein |

Die Stufe ist **fest im Profil** und gilt als **Obergrenze**. Rote Touren erscheinen nur mit Bestätigung: «Du bist in einer geschulten Gruppe?»

### Sicherheitsprinzip

- **Nie «sicher».** Die App sagt höchstens «geringes Risiko laut Skitourenguru».
- **Immer sichtbar:** Lawinengefahrenstufe und Hinweis aufs aktuelle Bulletin.
- **Fremde Bewertung:** Das Risiko kommt von Skitourenguru – nie aus eigener Logik.
- **Deine Stufe:** 1 grün für alle · 2 orange nur mit guter Ausrüstung · 3 rot nur in geschulten Gruppen, nie allein.
- **Rot nur mit Bestätigung.**

### Spot-Merkliste

Orte werden gespeichert (z. B. aus Instagram). Die App meldet sich, sobald die Bedingungen dort passen. Beispiel: «Am Säntis ist am Samstag Nebelmeer, Sonnenaufgang 07:52.»

---

## 6. Screens (Skizzen, Beispieldaten)

| Screen | Inhalt |
|---|---|
| 06a Donnerstag | 4 Angaben: Zeitbudget Sa/So, Anreise max., Tagesform, Startpunkt → «Vorschläge zeigen» |
| 06b Vorschläge | 3 Karten (Aktivität, Tag, Ort, Begründung in 1–2 Sätzen, Anreise, Fotospot, Preis, Risikofarbe) + Plan B |
| 06c Detailplan | Risikohinweis (Farbe + Gefahrenstufe), Zeitplan, Route-Export (swisstopo / GPX), Anreise mit Startpunkt, Packliste → «Plan wählen» |
| 06d Vorabend-Check | «Plan steht.» oder Wechsel auf Plan B · Feedback am Sonntagabend: umgesetzt? / Vorschläge gepasst? / wie streng war die Tour? |

---

## 7. User Story Map & Releases

| | 01 Einrichten | 02 Wochenende anstossen | 03 Vorschläge prüfen | 04 Vorbereiten | 05 Vorabend | 06 Danach |
|---|---|---|---|---|---|---|
| **MVP** (Winter 26/27) | Material & Risikostufe 1–3 · Eigene Liste + automatische Quellen | Kurzbefehl öffnet die App am Donnerstag · 4 Angaben | 3 Vorschläge mit Begründung · Fotospot + Lichtzeit pro Plan, Preis sichtbar | Zeitplan · Route-Export an swisstopo / GPX | Check: Plan steht oder Plan B · **Automatischer Plan B** (vorgezogen) | Umgesetzt? Ja/Nein · Bewertung pro Vorschlag |
| **R2** (ganzjährig) | Kondition kalibrieren · Export als Backup | Sportarten ausschliessen | Bilder & Webcams vom Ziel | Packliste · Anreise mit ÖV | – | App lernt aus Feedback |
| **R3** (Inspiration) | Spot-Alarm aus eigener Liste | Kurztrips & Feiertage | Kombi-Pläne Sport + Foto | Plan teilen per Link | – | Saisonrückblick |

**R2 zusätzlich:** Motorrad, Wandern, Rennrad · Grenzregionen AT, DE, IT, FR · optional native App mit Expo.

### Ziel pro Release

- **MVP:** Vorschläge passen zu mir – Umsetzungsrate von mindestens 50 % über 8 Wochenenden.
- **R2:** Das ganze Jahr nutzbar – Sommersportarten, Grenzregionen, App lernt dazu.
- **R3:** Inspiration und Teilen – Merkliste, Kombi-Pläne, Plan an Kollegen senden.

---

## 8. Lean Canvas

| Feld | Inhalt |
|---|---|
| 1 Problem | Viele Optionen, keine passt · Infos über zu viele Quellen verstreut · Kein Plan B, wenn das Wetter kippt |
| Heutige Alternativen | Wetter-Apps, Komoot, Skitourenguru, swisstopo und Instagram – von Hand kombiniert |
| 2 Lösung | Am Donnerstag 3 passende Vorschläge · Fertiger Plan (Zeit, Route, Anreise) · Automatischer Plan B · Check am Vorabend · Web-App, rechnet lokal im Browser |
| 3 Kennzahlen | **Umsetzungsrate** · Bewertung pro Vorschlag · Nutzung am Donnerstag |
| 4 Wertversprechen | «Freitagabend entschieden statt überfordert.» – Wenige, realistische Ideen, die zu dir passen, inklusive Plan B |
| Kurz gesagt | Ein persönlicher Wochenend-Kurator über den Spezial-Apps |
| 5 Alleinstellung | Persönliche Passung: Profil mit Material, Risikostufe 1–3, Zeit und Tagesform – privat auf dem Gerät |
| 6 Kanäle | Jetzt: keine nötig · Später: Freunde, SAC-Sektionen, Foto-Communities |
| 7 Zielgruppe | Zuerst: ich selbst · Danach: Multisportler in der Schweiz mit wenig Zeit unter der Woche |
| Early Adopter | Plant am Donnerstag-/Freitagabend und betreibt mehrere Sportarten |
| 8 Kosten | Kein Server nötig · eventuell Datenzugänge (Bergbahnen, Skitourenguru) · Entwicklungszeit · kein Mac, kein Apple-Konto – Teilen per Link |
| 9 Einnahmen | Keine – Side-Project. Neu bewerten, falls die Nische die App will |

---

## 9. Details & Entscheide

### A – Profil & Sicherheit

| Thema | Entscheid | Bemerkung |
|---|---|---|
| Risikostufe | 1–3, fest im Profil | Selbsteinschätzung, gilt als Obergrenze |
| Begleitung | Spielt keine Rolle | Die Risikostufe deckt das ab |
| Startpunkt | Wechselnd | 4. Angabe am Donnerstag, z. B. Zuhause oder Ferienhaus |
| Startzeit | Vor Sonnenaufgang ok | Öffnet Morgenlicht- und Nebelmeer-Pläne |

### B – Vorschläge

| Thema | Entscheid | Bemerkung |
|---|---|---|
| Fotografie | Eigene Aktivität und Zusatz | Jeder Sport-Plan bekommt Fotospot und Lichtzeit |
| Neu oder bekannt | Mix | Etwa 2 bewährte + 1 neue Option pro Woche |
| Kandidaten | Eigene Liste + automatisch | Startklar auch ohne Skitourenguru-Daten |
| Kosten | Anzeigen | Preis sichtbar, aber kein Kriterium |

### C – Technik

| Thema | Entscheid | Bemerkung |
|---|---|---|
| Plattform | Web-App auf dem Home-Bildschirm | Kein Mac nötig, rechnet lokal im Browser |
| Logik | Regeln + Score | Begründung aus Textbausteinen, KI später möglich |
| Historie | Nur Feedback in der App | Plus Häkchen «schon gemacht» in der eigenen Liste |
| Daten | Nur auf dem Gerät | Safari löscht Home-Bildschirm-Apps nicht nach 7 Tagen · Backup ab R2 |

---

## 10. Technik

### Plattform-Entscheid

Eine native iOS-App bräuchte zum Bauen und Signieren einen Mac mit Xcode. Ohne Mac fiel die Wahl auf eine **Web-App (PWA)**:

- Kostenlos, kein Mac, kein Apple-Entwicklerkonto.
- Daten bleiben im Browser-Speicher des iPhones. Web-Apps auf dem Home-Bildschirm sind von Safaris 7-Tage-Löschung ausgenommen.
- Die Logik in TypeScript lässt sich später fast unverändert in eine native App mit **Expo (React Native)** übernehmen.

Alternativen für später: Expo Go (gratis zum Testen von Windows aus), eigene native App über Expo-Build + TestFlight (99 USD/Jahr), Sideloading mit AltStore (umständlich, Apple-ID an Drittsoftware).

### Tech-Stack (Vorschlag)

| Baustein | Lösung |
|---|---|
| Oberfläche | Web-App (PWA) in TypeScript · Logik später in Expo nutzbar |
| Speicher | IndexedDB im Browser, nur auf dem iPhone |
| Wetter | Open-Meteo mit ICON-CH von MeteoSchweiz · ohne API-Schlüssel |
| Lawinenrisiko | Farbe von Skitourenguru · blockiert der Browser: kleine Weiterleitung ohne Speicher |
| Begründung | Textbausteine aus dem Score |
| Sonne & Mond | Lokale Berechnung |
| Nachrichten | Kurzbefehle-Automation öffnet die App am Donnerstag und am Vorabend · kein Server |
| Hosting | Kostenloses Hosting für statische Seiten, z. B. GitHub Pages |

### Nachricht ohne Server: Kurzbefehle-Automation

In der Kurzbefehle-App: **Automation → Neue Automation → Tageszeit** → Uhrzeit und Wiederholung (Donnerstag bzw. Vorabend) festlegen → **Sofort ausführen** → Aktion «URL öffnen» mit der Adresse der Web-App. Ist das iPhone gesperrt, muss das Öffnen kurz bestätigt werden.

### Kosten

**0 CHF** zum Bauen und Testen:
- Kein Mac, kein Apple-Entwicklerkonto nötig
- Hosting für statische Seiten gratis
- Kurzbefehle-App ist auf jedem iPhone dabei
- Open-Meteo gratis bis 10'000 Aufrufe pro Tag, nicht kommerziell, mit Quellenangabe (CC BY 4.0)
- Später nativ: Expo Go gratis zum Testen, eigene App 99 USD/Jahr

---

## 11. Testplan

| | |
|---|---|
| Kritischste Annahme | Die Vorschläge passen zu mir |
| Testform | Web-App direkt bauen |
| Dauer | 8 Wochenenden, Dezember – Januar |
| Tester | Nur ich |

### Annahmen-Matrix

| | kaum belegt | belegt |
|---|---|---|
| **wichtig** | **Zuerst testen:** Vorschläge passen · Datenzugang Skitourenguru · Plan B taugt | **Beobachten:** Rhythmus Do/Fr passt · MeteoSchweiz-Daten frei verfügbar · Kurzbefehl öffnet die App zuverlässig |
| **weniger wichtig** | **Später:** Teilen wird genutzt · Nische will die App auch · Textbausteine klingen natürlich genug | **Ok:** Web-App reicht als Plattform |

### Erfolgskriterien (Vorschlag)

- **≥ 50 %** Umsetzungsrate: 4 von 8 Wochenenden mit umgesetztem Vorschlag
- **2 / 3** Vorschläge pro Woche als passend bewertet

Pro Wochenende festhalten: umgesetzt ja/nein, Bewertung je Vorschlag, bei «nein» kurz den Grund.

### Empfehlungen

1. **Logik vor Oberfläche** – erste Version gibt nur 3 Vorschläge mit Begründung aus.
2. **Parallel 2 Wochen Concierge-Test** – Vorschläge von Hand, bevor Code existiert: Stimmen die Kriterien?
3. **Skitourenguru zuerst klären** – ob und wie die Daten genutzt werden dürfen.
4. **Kurzbefehl einrichten** – Automation «Tageszeit» mit «Sofort ausführen» für Donnerstag und Vorabend.

---

## 12. Noch offen

1. Zeiten für die Nachricht am Donnerstag und den Vorabend-Check
2. Grenzwerte pro Sportart: Wind, Sonnenstunden, Temperatur
3. Wie die App ein Nebelmeer vorhersagt
4. Nutzungsrechte und Browser-Zugriff bei Skitourenguru
5. Name der App

---

## 13. Quellen

- Komoot ChatGPT-App (Februar 2026): https://newsroom.komoot.com/261872-komoot-makes-outdoor-adventures-accessible-with-ai-powered-route-discovery-on-chatgpt/
- Skitourenguru (Risikofarben grün/orange/rot): https://www.alpenverein.de/artikel/tourenplanung-skitourenguru_52809215-c883-4acc-a9c5-d0eb47fed7aa
- BFU zu Skitourenguru: https://www.bfu.ch/media/2tykzsku/lawinengefahr-abseits-der-piste-studie-bestaetigt-nutzen-des-planungstools-skitourenguru.pdf
- MeteoSchweiz Open Data: https://www.meteoschweiz.admin.ch/service-und-publikationen/service/open-data.html
- Open-Meteo MeteoSwiss API: https://open-meteo.com/en/docs/meteoswiss-api
- Open-Meteo Nutzungsbedingungen: https://open-meteo.com/en/terms
- WebKit – Speicher bei Home-Bildschirm-Apps: https://developer.apple.com/forums/thread/710157
- Apple – Mitgliedschaften (Personal Team): https://developer.apple.com/support/compare-memberships
- Expo – iOS ohne Mac: https://expo.dev/articles/testing-and-previewing/test-ios-app-without-mac
- Kurzbefehle-Automation (Tageszeit): https://communities.apple.com/de/thread/256332480
- User Story Mapping: https://www.atlassian.com/agile/product-management/story-mapping
- Job Stories: https://thoughtbot.com/playbook/validation/jtbd
- Lean Canvas / Problem-Solution Fit: https://www.leanfoundry.com/lean-1-2-3/apr-20-2024
