import { berechneAddition, berechneSubtraktion } from '../engine/rechnen.js';
import { appendLogEntry, baueFrames, renderTafel } from './multiplikation-division/erklaerung.js';
import { erzeugeFreieFlaeche } from '../shared/freieFlaeche.js';

/* ============================================================
   Ansicht "Erklärung" (entspricht .../erklaerung.js)
   ============================================================ */
export function mountErklaerung(container){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Stelle eine Rechnung mit ganzen Zahlen dar und gehe die Erklärung in deinem eigenen Tempo durch.</p>
    <form class="rechnung-form" novalidate>
      <div class="feld"><label for="feld-a">a</label><input id="feld-a" type="number" name="a" value="3" step="1" required></div>
      <div class="feld"><label for="feld-op">Zeichen</label><select id="feld-op" name="op" aria-label="Rechenzeichen"><option value="+">+</option><option value="-">−</option></select></div>
      <div class="feld"><label for="feld-b">b</label><input id="feld-b" type="number" name="b" value="-5" step="1" required></div>
      <button type="submit">Starten</button>
    </form>
    <div class="arbeitsflaeche">
      <div class="tafel-wrapper">
        <h3>Plättchen-Tafel</h3>
        <div class="plaettchen-tafel" aria-live="polite"></div>
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
  const tafelEl = container.querySelector('.plaettchen-tafel');
  const logEl = container.querySelector('.schritte-log');
  const weiterBtn = container.querySelector('.weiter-btn');
  const zurueckBtn = container.querySelector('.zurueck-btn');
  const freiBtn = container.querySelector('.frei-weiterarbeiten-btn');
  const freiHostEl = container.querySelector('.frei-weiterarbeiten-host');
  let frames = [], index = 0;
  let freieKetteErstellt = false;

  function setzeFreieFortsetzungZurueck(){
    freieKetteErstellt = false;
    freiHostEl.hidden = true;
    freiHostEl.innerHTML = '';
  }

  freiBtn.addEventListener('click', () => {
    if(freieKetteErstellt) return;
    freieKetteErstellt = true;
    const startTiles = frames[index].tiles.map((t) => ({kind:t.kind, sign:t.sign}));
    freiHostEl.hidden = false;
    erzeugeFreieFlaeche(freiHostEl, {
      flaechenTitel: 'Freie Fortsetzung (Kopie der Tafel)',
      initialTiles: startTiles,
    });
  });

  function zeigeFrameBis(i){
    logEl.innerHTML = '';
    for(let j=0;j<=i;j+=1){ if(frames[j].logLabel) appendLogEntry(logEl, frames[j].logLabel, frames[j].logIsResult); }
    const frame = frames[i];
    renderTafel(tafelEl, frame.tiles, {highlightIds:frame.highlightIds, highlightClass:frame.highlightClass, emptyMessage:frame.emptyMessage});
    freiBtn.hidden = false;
  }
  /* Runde 23 (Nutzer-Rückmeldung): "Zurück" ist deaktiviert, solange der
     erste Schritt gezeigt wird – sonst immer bedienbar. */
  function aktualisiereWeiterButton(){
    const fertig = index >= frames.length-1;
    weiterBtn.disabled = fertig;
    weiterBtn.textContent = fertig ? 'Fertig ✓' : 'Nächster Schritt →';
    zurueckBtn.disabled = frames.length===0 || index<=0;
  }
  function starte(a, b, op){
    setzeFreieFortsetzungZurueck();
    const steps = (op==='+' ? berechneAddition(a,b) : berechneSubtraktion(a,b)).steps;
    frames = baueFrames(steps);
    index = 0;
    zeigeFrameBis(0);
    aktualisiereWeiterButton();
  }

  /* Anfangszustand: leere Tafel, kein Rechenweg – erst nach "Starten" wird gerechnet. */
  function zeigeLeer(){
    setzeFreieFortsetzungZurueck();
    frames = [];
    index = 0;
    logEl.innerHTML = '';
    tafelEl.innerHTML = '';
    const hinweis = document.createElement('p');
    hinweis.className = 'tafel-leer';
    hinweis.textContent = 'Noch keine Rechnung dargestellt – Zahlen eingeben und auf "Starten" klicken.';
    tafelEl.appendChild(hinweis);
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
    const a = Number(data.get('a')), b = Number(data.get('b')), op = data.get('op');
    if(!Number.isFinite(a) || !Number.isFinite(b)) return;
    starte(a,b,op);
  });

  zeigeLeer();
}
