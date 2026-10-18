# Plättchenmodell

Interaktive, webbasierte Lernumgebung zur Unterstützung algebraischer
Lernprozesse auf Basis des Plättchenmodells – entstanden im Rahmen einer
Masterarbeit (Lehramt Mathematik/Physik). Die Lernumgebung deckt Addition,
Subtraktion, Multiplikation, Division sowie lineare und quadratische Terme
bis hin zur quadratischen Ergänzung ab und ist für Realschüler:innen
ausgelegt.

Die Anwendung ist rein clientseitig (reines HTML/CSS/JavaScript ohne
Build-Schritt oder Backend) und läuft vollständig im Browser.

## Projektstruktur

```
index.html              Einstiegspunkt – lädt styles/styles.css und src/app.js
styles/
  styles.css             Gesamtes Erscheinungsbild der Anwendung
src/
  app.js                 App-Rahmen / oberste Navigationsebene (vier Bereiche)
  engine/                 Reine Rechen-/Daten-Logik, ohne DOM-Zugriff
    rechnen.js              Addition, Subtraktion, Multiplikation, Division,
                             quadratische Ergänzung, Klammern-Multiplikation
    multiplikationRaster.js Daten-Engine des Malkreuz-Rasters
    termParser.js           Parser für Term-/Gleichungseingaben, Zufallsgenerierung
    gleichungen.js           Äquivalenzumformungen, x-Wert-Einsetzen
  shared/                 Wiederverwendbare UI-Bausteine
    theme.js, renderPlaettchen.js, freieTafel.js, palette.js,
    freieFlaeche.js, gleichungsKette.js, bereichsTabs.js, andockRaster.js
  erklaerungen/            Bereich "Erklärungen" (geführte Beispiele)
  terme/                   Bereich "Terme" (Sandbox, Plättchen↔Term)
  gleichungen/             Bereich "Gleichungen"
  funktionen/              Bereich "Funktionen"
tests/                    Playwright-Tests (End-to-End, im echten Browser)
scripts/                  Hilfsskripte für lokale Entwicklung und Tests
```

Jede Datei unter `src/` beginnt mit einem Kommentarblock, der die
fachliche/technische Herkunft der jeweiligen Rolle beschreibt; viele
Funktionen verweisen zusätzlich auf die "Runde", in der sie eingeführt oder
zuletzt geändert wurden (siehe Entwicklungsprotokoll der Masterarbeit).

### Verhältnis zur Single-File-Demo

Parallel zu diesem Projekt existiert `plaettchenmodell-demo.html` – eine
funktional identische, einzelne HTML-Datei (ohne externe Dateien), die sich
leicht als Vorschau teilen lässt (z. B. als Claude-Artefakt). Dieses Projekt
hier ist die nach fachlicher Zuständigkeit in einzelne Module aufgeteilte
Fassung desselben Codes, gedacht für Versionierung, Lesbarkeit und
Weiterentwicklung.

## Lokal starten

Voraussetzung: Python 3 (für den einfachen statischen Entwicklungsserver).

```sh
./scripts/dev-server.sh        # Standard-Port 8099
# oder: npm start
```

Anschließend im Browser öffnen: <http://localhost:8099/index.html>

Die Anwendung lädt keine externen Ressourcen außer den Google-Fonts-Links
in `index.html`; ein Build-Schritt ist nicht nötig.

## Tests ausführen

Die Tests nutzen [Playwright](https://playwright.dev/) und steuern die
Anwendung wie eine echte Person im Browser (Klicks, Ziehen von
Plättchen, …).

Einmalig installieren:

```sh
npm install
npx playwright install chromium
```

Danach:

```sh
./scripts/run-tests.sh         # Standard-Port 8099
# oder: npm test
```

Das Skript startet selbstständig einen lokalen Server, führt alle Dateien
unter `tests/*.mjs` aus und beendet den Server anschließend wieder. Enthalten
sind:

- `tests/regression.mjs` – klickt sich durch alle Module/Bereiche/Ansichten
  und prüft, dass dabei keine Konsolenfehler auftreten.
- `tests/malkreuz-ausrichtung.mjs` – prüft die automatische
  Ausrichtungs-Erkennung für x-Produktplättchen im Malkreuz.
- `tests/x-wert-einsetzen-reihenfolge.mjs` – prüft, dass die Umrandungen beim
  Einsetzen eines x-Werts unabhängig vom Ergebnis-Vorzeichen in der
  Reihenfolge x² → x → 1 erscheinen.

## Fachlicher Hintergrund

Ausführliche Dokumentation der fachdidaktischen Entscheidungen und der
Entwicklungsgeschichte (jede Änderungsrunde mit Anlass, Umsetzung,
Testergebnissen und fachdidaktischer Einordnung) befindet sich im
Entwicklungsprotokoll der Masterarbeit (`entwicklungsprotokoll-quelle.md`).
