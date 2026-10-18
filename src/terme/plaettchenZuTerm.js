import { erzeugeZufaelligeKachelsammlung, nettoKoeffizienten, pruefeTermEingabe } from '../engine/termParser.js';
import { erzeugeFreieFlaeche } from '../shared/freieFlaeche.js';
import { ALLE_TYPEN } from '../shared/palette.js';

/* ============================================================
   Ansicht "Plättchen zu Term" (entspricht .../plaettchenZuTerm.js): frei
   auslegen, Term darunter eintragen und überprüfen.
   ============================================================ */
export function mountPlaettchenZuTerm(container, opts={}){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Lege mit den Plättchen einen beliebigen Term aus (frei oder per Zufallsgenerator). Lies ihn ab, trage ihn unten ein und überprüfe deine Antwort (bezogen auf die zuletzt bearbeitete Zeile).</p>
    <button type="button" class="zufall-btn">Zufällige Plättchensammlung generieren</button>
    <div class="freie-flaeche"></div>
    <form class="term-check-form" novalidate>
      <div class="feld feld--term">
        <label for="term-eingabe-lesen">Dein abgelesener Term</label>
        <input id="term-eingabe-lesen" type="text" name="term" placeholder="z. B. 2x² − x + 3" autocomplete="off">
      </div>
      <button type="submit" class="ueberpruefen-btn">Überprüfen</button>
    </form>
    <p class="term-check-feedback" role="status" aria-live="polite"></p>
  `);
  const flaeche = erzeugeFreieFlaeche(container.querySelector('.freie-flaeche'), { flaechenTitel:'Bearbeitungsfläche', typen:opts.typen });
  const form = container.querySelector('.term-check-form');
  const input = container.querySelector('#term-eingabe-lesen');
  const feedbackEl = container.querySelector('.term-check-feedback');
  const zufallBtn = container.querySelector('.zufall-btn');
  const mitX2 = (opts.typen ?? ALLE_TYPEN).some((t) => t.kind==='x2');
  zufallBtn.addEventListener('click', () => {
    flaeche.tafel.clear();
    flaeche.tafel.addTiles(erzeugeZufaelligeKachelsammlung({ mitX2 }));
    input.value = '';
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const erwartet = nettoKoeffizienten(flaeche.tafel.board.tiles);
    // Runde 21 (Punkt 6): nur der vollständig vereinfachte Term zählt als
    // Lösung, nicht nur ein wertgleicher (z. B. "2x+3x" statt "5x").
    pruefeTermEingabe(input.value, erwartet, feedbackEl, { erfordertVereinfachteForm: true });
  });
}
