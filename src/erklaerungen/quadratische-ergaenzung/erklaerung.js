import { berechneQuadratischeErgaenzung } from '../../engine/rechnen.js';
import { baueFramesKM, mountGefuehrteErklaerungKM, tilesAusRasterFrameKM, zustandAusRasterSnapshotKM } from '../klammern-multiplizieren.js';
import { appendLogEntry } from '../multiplikation-division/erklaerung.js';
import { createAndockRasterUI } from '../../shared/andockRaster.js';
import { erzeugeFreieFlaeche } from '../../shared/freieFlaeche.js';
import { PALETTE_SKALIERUNG } from '../../shared/palette.js';
import { createPlaettchenElement } from '../../shared/renderPlaettchen.js';

/* ============================================================
   Ansicht "Quadratische Ergänzung" (entspricht
   .../quadratische-ergaenzung/erklaerung.js) – zeigt am Malkreuz, wie
   x² + px durch Ergänzen von (p/2)² zu einem vollständigen Quadrat
   (x ± p/2)² wird (berechneQuadratischeErgaenzung weiter oben multipliziert
   dafür die Klammer (x ± p/2) mit sich selbst). p muss gerade und ungleich 0
   sein, sonst zeigt die Engine einen eigenen Fehler-Schritt.
   ============================================================ */
/* Runde 23 (Punkt 5): die Erklärung besteht jetzt – wie "Multiplikation von
   Klammern/Das Malkreuz" – NUR noch aus dem Malkreuz (kein eigenes Plättchen-
   Tafel-Layout mehr); siehe berechneQuadratischeErgaenzung oben. Struktur und
   Variablennamen bewusst eng an mountGefuehrteErklaerungKM angelehnt (gleiche
   Mechanik: andock.stelleZustandWieder pro Frame, Zurück-Button, "Frei ab
   hier weiterarbeiten" über tilesAusRasterFrameKM). */
export function mountQuadratischeErgaenzungErklaerung(container){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Gib eine Startgleichung x² + p·x + c ein und lass dir am Malkreuz zeigen, wie daraus ein vollständiges Quadrat wird: die Klammer (x ± p/2) wird dafür mit sich selbst multipliziert. Wähle eine gerade Zahl für p, damit sich die Hälfte als ganze Plättchen darstellen lässt – c darf beliebig sein; passt es nicht genau zur Ecke, bleibt ein Rest übrig.</p>
    <form class="rechnung-form" novalidate>
      <span class="qe-form__symbol">x² +</span>
      <div class="feld"><label for="feld-p-qe">p</label><input id="feld-p-qe" type="number" name="p" value="6" step="2" required></div>
      <span class="qe-form__symbol">x +</span>
      <div class="feld"><label for="feld-c-qe">c</label><input id="feld-c-qe" type="number" name="c" value="9" step="1" required></div>
      <button type="submit">Starten</button>
    </form>
    <div class="arbeitsflaeche">
      <div class="tafel-wrapper">
        <h4>Malkreuz</h4>
        <div class="malkreuz-host qe-erklaerung-host"></div>
        <div class="qe-rest-anzeige" hidden>
          <p class="qe-rest-anzeige__hinweis"></p>
          <div class="qe-rest-anzeige__kacheln"></div>
        </div>
        <button type="button" class="weiter-btn">Nächster Schritt →</button>
        <button type="button" class="zurueck-btn" disabled>← Zurück</button>
        <button type="button" class="frei-weiterarbeiten-btn" hidden>Frei ab hier weiterarbeiten</button>
      </div>
      <div class="protokoll-wrapper">
        <h3>Rechenweg</h3>
        <ol class="schritte-log"></ol>
      </div>
    </div>
    <div class="frei-weiterarbeiten-host" hidden></div>
  `);

  const form = container.querySelector('.rechnung-form');
  const hostEl = container.querySelector('.qe-erklaerung-host');
  const restAnzeigeEl = container.querySelector('.qe-rest-anzeige');
  const restHinweisEl = container.querySelector('.qe-rest-anzeige__hinweis');
  const restKachelnEl = container.querySelector('.qe-rest-anzeige__kacheln');
  const logEl = container.querySelector('.schritte-log');
  const weiterBtn = container.querySelector('.weiter-btn');
  const zurueckBtn = container.querySelector('.zurueck-btn');
  const freiBtn = container.querySelector('.frei-weiterarbeiten-btn');
  const freiHostEl = container.querySelector('.frei-weiterarbeiten-host');

  let frames = [], index = 0;
  let freieKetteErstellt = false;
  let andock = null;
  // Runde 43 (Nutzer-Rückmeldung: "Lasse die Faktordarstellung weg z.B.
  // (x+3). Die Faktorplättchen [...] sollen erst dann platziert werden, wenn
  // das Produkt als Quadrat gelegt wurde."): ersetzt die bisherige, rein
  // textuelle Achsenbeschriftung (aktualisiereAchsenBeschriftung/
  // faktorText, seit Runde 36/39) durch eine einfache Sichtbarkeits-Markierung
  // für die Achsen-PLÄTTCHEN selbst – siehe achsenPlaettchenSichtbar unten,
  // gelesen von createAndockRasterUI (src/shared/andockRaster.js).
  let achsenAktuellSichtbar = false;

  function setzeFreieFortsetzungZurueck(){
    freieKetteErstellt = false;
    freiHostEl.hidden = true;
    freiHostEl.innerHTML = '';
  }

  freiBtn.addEventListener('click', () => {
    if(freieKetteErstellt || frames.length===0) return;
    freieKetteErstellt = true;
    const startTiles = tilesAusRasterFrameKM(frames[index].raster);
    freiHostEl.hidden = false;
    erzeugeFreieFlaeche(freiHostEl, {
      flaechenTitel: 'Freie Fortsetzung (Kopie des Malkreuzes)',
      initialTiles: startTiles,
    });
  });

  // Runde 24 (Punkt 2, Nutzer-Rückmeldung: "vorallem wenn c einen Rest hat
  // --> Rest im Malkreuz anzeigen"): zeigt den Rest als eigene kleine
  // Plättchen-Reihe direkt UNTER dem Malkreuz. Einmal eingeführt (derselbe
  // Rückwärts-Suchlauf wie beim Malkreuz-Beleg der Gleichung, Punkt 5)
  // bleibt er für alle nachfolgenden Schritte sichtbar stehen.
  function aktualisiereRestAnzeige(i){
    let quelle = null;
    for(let j=i; j>=0; j-=1){
      if(frames[j].emptyMessage) break;
      if(frames[j].restTiles){ quelle = frames[j].restTiles; break; }
    }
    if(quelle && quelle.length>0){
      restAnzeigeEl.hidden = false;
      const vorzeichen = quelle[0].sign>0 ? '+' : '−';
      restHinweisEl.textContent = `Rest am Malkreuz: ${vorzeichen}${quelle.length} – passt nicht exakt zur Ecke (p/2)² und bleibt als eigene Plättchen übrig:`;
      restKachelnEl.innerHTML = '';
      for(const t of quelle) restKachelnEl.appendChild(createPlaettchenElement(t.kind, t.sign, { scale:PALETTE_SKALIERUNG, zeigeWert:true }));
    } else {
      restAnzeigeEl.hidden = true;
      restKachelnEl.innerHTML = '';
    }
  }

  function zeigeFrameBis(i){
    logEl.innerHTML = '';
    for(let j=0;j<=i;j+=1){ if(frames[j].logLabel) appendLogEntry(logEl, frames[j].logLabel, frames[j].logIsResult); }
    const frame = frames[i];
    // Runde 43: die Achsen-Plättchen (Faktor-Plättchen) werden erst
    // sichtbar, sobald der aktuelle Schritt dies vorgibt (`achsenSichtbar`,
    // siehe berechneQuadratischeErgaenzung) – gelesen von der unten beim
    // Anlegen übergebenen `achsenPlaettchenSichtbar`-Option.
    achsenAktuellSichtbar = !!frame.achsenSichtbar;
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
        // Rein anschaulich: beide Achsen fest gesperrt (wie bei "Klammern
        // multiplizieren") – nur "Nächster Schritt"/"Zurück"/"Frei ab hier
        // weiterarbeiten" verändern hier etwas. Runde 43: keine Text-
        // Beschriftung mehr ("?"/abgeleitete Klammer) – der Faktor wird
        // ausschließlich über die tatsächlich platzierten Achsen-Plättchen
        // sichtbar, nicht mehr über ein Label.
        andock = createAndockRasterUI(hostEl, {
          zeilenLabel: '',
          spaltenLabel: '',
          zeilenGesperrt: () => true,
          spaltenGesperrt: () => true,
          achsenPlaettchenSichtbar: () => achsenAktuellSichtbar,
        });
      }
      andock.stelleZustandWieder(zustandAusRasterSnapshotKM(frame.raster));
    }
    aktualisiereRestAnzeige(i);
    freiBtn.hidden = false;
  }

  function aktualisiereWeiterButton(){
    const fertig = index >= frames.length-1;
    weiterBtn.disabled = fertig;
    weiterBtn.textContent = fertig ? 'Fertig ✓' : 'Nächster Schritt →';
    zurueckBtn.disabled = frames.length===0 || index<=0;
  }

  function starte(p, c){
    setzeFreieFortsetzungZurueck();
    andock = null;
    const { steps } = berechneQuadratischeErgaenzung(p, c);
    frames = baueFramesQuadratischeErgaenzung(steps);
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
    hinweis.textContent = 'Noch keine Rechnung dargestellt – p und c eingeben und auf "Starten" klicken.';
    hostEl.appendChild(hinweis);
    restAnzeigeEl.hidden = true;
    restKachelnEl.innerHTML = '';
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
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const p = Number(data.get('p'));
    const c = Number(data.get('c'));
    if(!Number.isFinite(p) || !Number.isFinite(c)) return;
    starte(p, c);
  });

  zeigeLeer();
}

/** Übersetzt die Rechenweg-Schritte von berechneQuadratischeErgaenzung in
    einzeln anzeigbare Frames – 1:1 wie baueFramesKM. */
export function baueFramesQuadratischeErgaenzung(steps){
  return steps.map((step) => ({
    raster: step.raster,
    logLabel: step.label,
    logIsResult: step.type==='result',
    emptyMessage: step.type==='error' ? step.label : undefined,
    restTiles: step.restTiles,
    typ: step.type,
    achsenSichtbar: step.achsenSichtbar,
  }));
}
