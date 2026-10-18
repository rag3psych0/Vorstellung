import { koeffizientenAusRaster } from '../engine/multiplikationRaster.js';
import { berechneKlammernMultiplikation, erzeugeUndoSpeicher, strukturKopie } from '../engine/rechnen.js';
import { formatiereKoeffizientenAlsTerm, parseTerm } from '../engine/termParser.js';
import { mountErklaerungenBereich } from './module.js';
import { appendLogEntry } from './multiplikation-division/erklaerung.js';
import { createAndockRasterUI } from '../shared/andockRaster.js';
import { erzeugeFreieFlaeche, erzeugeZeilenkette } from '../shared/freieFlaeche.js';
import { verdrahteTermToggle } from '../shared/freieTafel.js';
import { ALLE_TYPEN, createPalette } from '../shared/palette.js';

/* ============================================================
   "Multiplikation von Klammern/Das Malkreuz" (entspricht .../erklaerungen/
   klammern-multiplizieren.js): zeigt zunächst eine GEFÜHRTE, Schritt-für-
   Schritt erzählte Erklärung (Runde 18, Punkt 3 – bislang gab es hier nur
   die freie Übung darunter), danach die schon bestehende freie Übung.
   Beide teilen sich dieselbe Malkreuz-Komponente (createAndockRasterUI).
   Reiter hieß bis Runde 17 "Klammern multiplizieren" und heißt seit
   Runde 18 "Multiplikation von Klammern/Das Malkreuz" (siehe
   mountErklaerungenBereich unten).
   ============================================================ */
export function mountKlammernMultiplizierenErklaerung(container){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <section class="rechen-beispiel" data-teil="erklaerung">
      <h3 class="rechen-beispiel__titel">Geführte Erklärung: Zwei Klammern multiplizieren</h3>
    </section>
    <section class="rechen-beispiel" data-teil="uebung">
      <button type="button" class="frei-uebung-oeffnen-btn">Frei üben</button>
      <div class="frei-uebung-inhalt" hidden></div>
    </section>
  `);
  mountGefuehrteErklaerungKM(container.querySelector('[data-teil="erklaerung"]'));

  // Runde 22 Punkt 1: "Frei üben" steckt hinter einem eigenen Knopf – der
  // Übungsbereich wird erst nach Klick ins DOM gehängt/angezeigt.
  const oeffnenBtn = container.querySelector('.frei-uebung-oeffnen-btn');
  const inhaltEl = container.querySelector('.frei-uebung-inhalt');
  let geoeffnet = false;
  oeffnenBtn.addEventListener('click', () => {
    if(!geoeffnet){
      geoeffnet = true;
      inhaltEl.insertAdjacentHTML('beforeend', '<h3 class="rechen-beispiel__titel">Frei üben</h3>');
      mountUebungKM(inhaltEl);
    }
    inhaltEl.hidden = !inhaltEl.hidden;
    oeffnenBtn.textContent = inhaltEl.hidden ? 'Frei üben' : 'Frei üben verbergen';
  });
}

/* Runde 18 (Punkt 3): zwei lineare Klammern werden als Text eingegeben (z. B.
   "x+3" und "x-2", über parseTerm, auf lineare Klammern ohne x² beschränkt),
   danach zeigt berechneKlammernMultiplikation den Rechenweg Schritt für
   Schritt: erst Klammer A Plättchen für Plättchen ans Malkreuz (unten links),
   dann Klammer B (oben rechts), anschließend jede Produkt-Zelle einzeln,
   zuletzt das ausmultiplizierte Ergebnis – folgt demselben Formular-/Frame-/
   "Nächster Schritt"-Muster wie die übrigen Erklär-Ansichten. Diese Ansicht
   ist rein anschaulich (nicht ziehbar, kein eigenes "Rückgängig") – die
   freie Übung darunter (mountUebungKM) bleibt der Ort, an dem selbst gezogen
   werden muss. Bietet wie die anderen Erklär-Ansichten "Frei ab hier
   weiterarbeiten" an. */
export function mountGefuehrteErklaerungKM(container){
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Gib zwei lineare Klammern ein (z. B. „x+3" und „x-2") und lass dir Schritt für Schritt zeigen, wie das Malkreuz sie multipliziert.</p>
    <form class="term-check-form" novalidate>
      <div class="feld feld--term"><label for="km-faktor-a">Klammer A</label><input id="km-faktor-a" type="text" value="x+3" autocomplete="off"></div>
      <div class="feld feld--term"><label for="km-faktor-b">Klammer B</label><input id="km-faktor-b" type="text" value="x-2" autocomplete="off"></div>
      <button type="button" class="zufall-btn">Zufällig</button>
      <button type="submit" class="ueberpruefen-btn">Starten</button>
    </form>
    <p class="term-check-feedback" role="status" aria-live="polite"></p>
    <div class="arbeitsflaeche">
      <div class="tafel-wrapper">
        <h4>Malkreuz</h4>
        <div class="malkreuz-host km-erklaerung-host"></div>
        <button type="button" class="weiter-btn">Nächster Schritt →</button>
        <button type="button" class="zurueck-btn" disabled>← Zurück</button>
        <button type="button" class="frei-weiterarbeiten-btn" hidden>Frei ab hier weiterarbeiten</button>
      </div>
      <div class="protokoll-wrapper">
        <h4>Rechenweg</h4>
        <ol class="schritte-log"></ol>
      </div>
    </div>
    <div class="frei-weiterarbeiten-host" hidden></div>
  `);

  const form = container.querySelector('.term-check-form');
  const faktorAInput = container.querySelector('#km-faktor-a');
  const faktorBInput = container.querySelector('#km-faktor-b');
  const zufallBtn = container.querySelector('.zufall-btn');
  const feedbackEl = container.querySelector('.term-check-feedback');
  const hostEl = container.querySelector('.km-erklaerung-host');
  const logEl = container.querySelector('.schritte-log');
  const weiterBtn = container.querySelector('.weiter-btn');
  const zurueckBtn = container.querySelector('.zurueck-btn');
  const freiBtn = container.querySelector('.frei-weiterarbeiten-btn');
  const freiHostEl = container.querySelector('.frei-weiterarbeiten-host');

  let frames = [], index = 0;
  let freieKetteErstellt = false;
  let andock = null;

  function setzeFreieFortsetzungZurueck(){
    freieKetteErstellt = false;
    freiHostEl.hidden = true;
    freiHostEl.innerHTML = '';
  }

  freiBtn.addEventListener('click', () => {
    if(freieKetteErstellt || frames.length===0) return;
    freieKetteErstellt = true;
    // Die freie Fortsetzung übernimmt ALLE aktuell sichtbaren Plättchen
    // (beide Faktor-Ketten + bereits gefüllte Produkt-Zellen) als lose
    // Sammlung.
    const startTiles = tilesAusRasterFrameKM(frames[index].raster);
    freiHostEl.hidden = false;
    erzeugeFreieFlaeche(freiHostEl, {
      flaechenTitel: 'Freie Fortsetzung (Kopie des Malkreuzes)',
      initialTiles: startTiles,
    });
  });

  function zeigeFrameBis(i){
    logEl.innerHTML = '';
    for(let j=0;j<=i;j+=1){ if(frames[j].logLabel) appendLogEntry(logEl, frames[j].logLabel, frames[j].logIsResult); }
    const frame = frames[i];
    if(frame.emptyMessage){
      hostEl.innerHTML = '';
      andock = null;
      const p = document.createElement('p');
      p.className = 'tafel-leer';
      p.textContent = frame.emptyMessage;
      hostEl.appendChild(p);
    } else {
      if(!andock){
        hostEl.innerHTML = '';
        // Rein anschaulich: beide Achsen fest gesperrt, damit sich am
        // Malkreuz nichts herausziehen lässt – nur "Nächster
        // Schritt"/"Frei ab hier weiterarbeiten" verändern hier etwas.
        andock = createAndockRasterUI(hostEl, {
          zeilenLabel: 'Klammer A',
          spaltenLabel: 'Klammer B',
          zeilenGesperrt: () => true,
          spaltenGesperrt: () => true,
        });
      }
      andock.stelleZustandWieder(zustandAusRasterSnapshotKM(frame.raster));
    }
    freiBtn.hidden = false;
  }

  function aktualisiereWeiterButton(){
    const fertig = index >= frames.length-1;
    weiterBtn.disabled = fertig;
    weiterBtn.textContent = fertig ? 'Fertig ✓' : 'Nächster Schritt →';
    zurueckBtn.disabled = frames.length===0 || index<=0;
  }

  function starte(faktorA, faktorB){
    setzeFreieFortsetzungZurueck();
    andock = null;
    const { steps } = berechneKlammernMultiplikation(faktorA, faktorB);
    frames = baueFramesKM(steps);
    index = 0;
    zeigeFrameBis(0);
    aktualisiereWeiterButton();
  }

  function zeigeLeer(){
    setzeFreieFortsetzungZurueck();
    andock = null;
    frames = [];
    index = 0;
    logEl.innerHTML = '';
    hostEl.innerHTML = '';
    const hinweis = document.createElement('p');
    hinweis.className = 'tafel-leer';
    hinweis.textContent = 'Noch keine Klammern dargestellt – zwei Klammern eingeben und auf "Starten" klicken.';
    hostEl.appendChild(hinweis);
    weiterBtn.disabled = true;
    weiterBtn.textContent = 'Nächster Schritt →';
    zurueckBtn.disabled = true;
    freiBtn.hidden = true;
  }

  zurueckBtn.addEventListener('click', () => {
    if(index<=0) return;
    index -= 1;
    zeigeFrameBis(index);
    aktualisiereWeiterButton();
  });
  weiterBtn.addEventListener('click', () => {
    if(index >= frames.length-1) return;
    index += 1;
    zeigeFrameBis(index);
    aktualisiereWeiterButton();
  });

  /** Liest eine Eingabe als lineare Klammer ({x, zahl}); null bei ungültiger oder quadratischer Eingabe. */
  function leseLineareKlammerKM(eingabe){
    const koeffizienten = parseTerm(eingabe);
    if(!koeffizienten || koeffizienten.x2!==0) return null;
    return { x: koeffizienten.x, zahl: koeffizienten.zahl };
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const faktorA = leseLineareKlammerKM(faktorAInput.value);
    const faktorB = leseLineareKlammerKM(faktorBInput.value);
    feedbackEl.classList.remove('term-check-feedback--fehler');
    if(!faktorA || !faktorB){
      feedbackEl.textContent = 'Bitte zwei gültige lineare Klammern eingeben, ohne x² (z. B. „x+3" und „x-2").';
      feedbackEl.classList.add('term-check-feedback--fehler');
      return;
    }
    feedbackEl.textContent = '';
    starte(faktorA, faktorB);
  });

  zufallBtn.addEventListener('click', () => {
    faktorAInput.value = zufaelligeLineareKlammerKM();
    faktorBInput.value = zufaelligeLineareKlammerKM();
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('term-check-feedback--fehler');
  });

  zeigeLeer();
}

/* Zufällige lineare Klammer für den "Zufällig"-Button, klein genug, um
   innerhalb des Plättchen-Limits von berechneKlammernMultiplikation zu
   bleiben (x-Koeffizient und Zahl je in [-3, 3], nicht beide 0). */
export function zufaelligeLineareKlammerKM(){
  let x, zahl;
  do {
    x = Math.floor(Math.random()*7) - 3;
    zahl = Math.floor(Math.random()*7) - 3;
  } while(x===0 && zahl===0);
  return formatiereKoeffizientenAlsTerm({ x2:0, x, zahl });
}

/** Übersetzt die Rechenweg-Schritte von berechneKlammernMultiplikation in einzeln anzeigbare Frames. */
export function baueFramesKM(steps){
  return steps.map((step) => ({
    raster: step.raster,
    logLabel: step.label,
    logIsResult: step.type==='result',
    emptyMessage: step.type==='error' ? step.label : undefined,
  }));
}

/** Sammelt alle aktuell sichtbaren Plättchen eines Malkreuz-Rasters (beide Ketten + gefüllte Produkt-Zellen) als lose Liste. */
export function tilesAusRasterFrameKM(raster){
  const tiles = [];
  for(const t of raster.zeilen) tiles.push({ kind:t.kind, sign:t.sign });
  for(const t of raster.spalten) tiles.push({ kind:t.kind, sign:t.sign });
  for(const reihe of raster.zellen){
    for(const zelle of reihe){
      if(zelle.gefuellt) tiles.push({ kind: zelle.erwarteteArt, sign: zelle.erwartetesVorzeichen });
    }
  }
  return tiles;
}

/** Wandelt einen reinen Raster-Snapshot in den Zustand um, den createAndockRasterUI's stelleZustandWieder erwartet ({raster, zellTiles, naechsteZellId}). */
export function zustandAusRasterSnapshotKM(raster){
  const rasterKopie = strukturKopie(raster);
  const zellTiles = new Map();
  let naechsteZellId = 0;
  rasterKopie.zellen.forEach((reihe, i) => {
    reihe.forEach((zelle, j) => {
      if(zelle.gefuellt){
        naechsteZellId += 1;
        zellTiles.set(`${i},${j}`, `km-erklaerung-zelle-${naechsteZellId}`);
      }
    });
  });
  return { raster: rasterKopie, zellTiles, naechsteZellId };
}

/* Freie Übung zur Multiplikation zweier linearer Klammern nach dem
   Flächenmodell (unverändert seit Runde 12) – ergänzt seit Runde 18 die neue
   geführte Erklärung oben (mountGefuehrteErklaerungKM). Das entstehende
   Produkt-Raster muss die Schülerin/der Schüler selbst mit den passenden
   Produkt-Plättchen befüllen (jede Zelle wird einzeln geprüft). */
export const KM_ACHSEN_TYPEN = [
  {kind:'x', sign:1}, {kind:'x', sign:-1}, {kind:'zahl', sign:1}, {kind:'zahl', sign:-1},
];
export function mountUebungKM(container){
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Ziehe Plättchen aus der <strong>linken Auswahl</strong> an die Seite des jeweils letzten Plättchens unten links (wird Stück für Stück zu einem Faktor, stehend) oder oben rechts (wird Stück für Stück zum anderen Faktor, liegend). Sobald beide Faktoren mindestens ein Plättchen haben, öffnet sich unten rechts das Produkt-Raster – die passenden Produkt-Plättchen musst du selbst aus der <strong>rechten Auswahl</strong> in die leeren Zellen ziehen (oder, sobald schon eine Zeile und eine Spalte stehen, direkt weiter unterhalb bzw. rechts davon in den leeren Rand – dort wächst das Produkt-Raster dann von selbst mit).</p>
    <div class="zeilenkette-host"></div>
  `);

  erzeugeZeilenkette(container.querySelector('.zeilenkette-host'), {
    mountZeile(inhaltEl, { vorherigerZustand }) {
      inhaltEl.insertAdjacentHTML('beforeend', `
        <div class="klammern-layout">
          <div class="klammern-palette-spalte">
            <h3>Faktor-Plättchen <span class="klammer-baustein__hinweis">ans Kreuz ziehen</span></h3>
            <div class="achsen-palette"></div>
            <button type="button" class="mult-zuruecksetzen-btn">Zurücksetzen</button>
          </div>
          <div class="klammern-andock-spalte">
            <div class="andock-host"></div>
            <p class="mult-status" aria-live="polite"></p>
            <button type="button" class="rueckgaengig-btn" disabled>↶ Rückgängig</button>
          </div>
          <div class="klammern-palette-spalte">
            <h3>Produkt-Plättchen <span class="klammer-baustein__hinweis">in leere Zellen ziehen</span></h3>
            <div class="mult-palette"></div>
          </div>
        </div>
        <button type="button" class="term-toggle-btn" hidden>Ausmultiplizierten Term anzeigen</button>
        <div class="term-anzeige" hidden>
          <span class="term-anzeige__label">Ausmultiplizierter Term</span>
          <span class="term-anzeige__wert">0</span>
        </div>
      `);

      const statusEl = inhaltEl.querySelector('.mult-status');
      const termToggleBtn = inhaltEl.querySelector('.term-toggle-btn');
      const termAnzeigeEl = inhaltEl.querySelector('.term-anzeige');
      const termWertEl = inhaltEl.querySelector('.term-anzeige__wert');
      verdrahteTermToggle(termToggleBtn, termAnzeigeEl, {
        textAnzeigen: 'Ausmultiplizierten Term anzeigen',
        textVerbergen: 'Ausmultiplizierten Term verbergen',
      });

      const rueckgaengigBtn = inhaltEl.querySelector('.rueckgaengig-btn');
      // Runde 16 ("Rückgängig button"): eigener Undo-Speicher pro Zeile.
      const undo = erzeugeUndoSpeicher({ onChange: (n) => { rueckgaengigBtn.disabled = n===0; } });
      rueckgaengigBtn.addEventListener('click', () => undo.rueckgaengig());

      const andock = createAndockRasterUI(inhaltEl.querySelector('.andock-host'), {
        zeilenLabel: 'Faktor A', spaltenLabel: 'Faktor B', onChange: aktualisiereStatus, undo,
      });

      function aktualisiereStatus(){
        const raster = andock.getRaster();
        if(raster.zeilen.length===0 || raster.spalten.length===0){
          statusEl.textContent = 'Noch keine Zeile/Spalte angedockt.';
          termToggleBtn.hidden = true; termAnzeigeEl.hidden = true;
          return;
        }
        const gesamt = raster.zeilen.length*raster.spalten.length;
        const gefuellt = raster.zellen.flat().filter(z => z.gefuellt).length;
        if(andock.istVollstaendig()){
          statusEl.textContent = '🎉 Vollständig ausmultipliziert! Alle Zellen sind richtig gefüllt.';
          termToggleBtn.hidden = false;
        } else {
          statusEl.textContent = `${gefuellt} von ${gesamt} Zellen richtig gefüllt.`;
          termToggleBtn.hidden = true; termAnzeigeEl.hidden = true;
        }
        termWertEl.textContent = formatiereKoeffizientenAlsTerm(koeffizientenAusRaster(raster));
      }

      createPalette(inhaltEl.querySelector('.achsen-palette'), {
        typen: KM_ACHSEN_TYPEN,
        onDrop(typ, punkt){
          if(andock.punktTrifftZone(andock.getSpaltenZoneEl(), punkt)) andock.spalteHinzufuegen(typ);
          else if(andock.punktTrifftZone(andock.getZeilenZoneEl(), punkt)) andock.zeileHinzufuegen(typ);
        },
      });
      createPalette(inhaltEl.querySelector('.mult-palette'), {
        typen: ALLE_TYPEN,
        onDrop(typ, punkt){
          const zielEl = andock.findeZelleAnPunkt(punkt);
          if(zielEl){ andock.versucheZelleFuellen(zielEl, typ); return; }
          // Runde 24 (Punkt 3): Produktfeld von Anfang an befüllbar, auch
          // hier in "Multiplikation von Klammern" – ohne Achsen erzeugt ein
          // Treffer im Produktfeld-Quadranten Zeile+Spalte+Zelle in einem Zug.
          if(andock.punktTrifftZone(andock.getProduktZoneEl(), punkt)) andock.versucheErstbefuellung(typ, punkt);
        },
      });
      inhaltEl.querySelector('.mult-zuruecksetzen-btn').addEventListener('click', () => {
        andock.reset();
        undo.leeren(); // kompletter Neustart – nicht rückgängig machbar (Runde 16)
      });

      if(vorherigerZustand){
        for(const t of vorherigerZustand.zeilen) andock.zeileHinzufuegen(t);
        for(const t of vorherigerZustand.spalten) andock.spalteHinzufuegen(t);
        undo.leeren(); // Übernahme der Vorzeile ist kein eigener Nutzer-Schritt
      }

      aktualisiereStatus();

      return {
        kopiereZustand: () => {
          const raster = andock.getRaster();
          return {
            zeilen: raster.zeilen.map((z) => ({ kind: z.kind, sign: z.sign })),
            spalten: raster.spalten.map((s) => ({ kind: s.kind, sign: s.sign })),
          };
        },
      };
    },
  });
}
