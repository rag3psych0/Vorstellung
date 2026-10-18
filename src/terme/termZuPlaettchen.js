import { erzeugeZufaelligenTerm, istKachelnVollstaendigGekuerzt, koeffizientenGleich, nettoKoeffizienten, parseTerm, pruefeTermEingabe } from '../engine/termParser.js';
import { erzeugeFreieFlaeche } from '../shared/freieFlaeche.js';
import { ALLE_TYPEN } from '../shared/palette.js';

/* ============================================================
   Ansicht "Term zu Plättchen" (entspricht .../termZuPlaettchen.js):
   umgekehrte Richtung – zuerst Term eintragen, dann passende Plättchen
   auslegen und überprüfen.
   ============================================================ */
export function mountTermZuPlaettchen(container, opts={}){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Trage oben einen beliebigen Term ein (von Hand oder per Zufallsgenerator) und lege dann die passenden Plättchen aus. Mit "Überprüfen" kontrollierst du dein Ergebnis (bezogen auf die zuletzt bearbeitete Zeile).</p>
    <form class="term-check-form term-check-form--vorher" novalidate>
      <div class="feld feld--term">
        <label for="term-eingabe-vorgabe">Dein Term</label>
        <div class="term-eingabe-zeile">
          <input id="term-eingabe-vorgabe" type="text" name="term" placeholder="z. B. 2x² − x + 3" autocomplete="off">
          <button type="button" class="zufall-btn">Zufällig</button>
        </div>
      </div>
      <button type="submit" class="ueberpruefen-btn">Überprüfen</button>
    </form>
    <p class="term-check-feedback" role="status" aria-live="polite"></p>
    <div class="freie-flaeche"></div>
  `);
  const flaeche = erzeugeFreieFlaeche(container.querySelector('.freie-flaeche'), { flaechenTitel:'Bearbeitungsfläche', typen:opts.typen });
  const form = container.querySelector('.term-check-form');
  const input = container.querySelector('#term-eingabe-vorgabe');
  const feedbackEl = container.querySelector('.term-check-feedback');
  const zufallBtn = container.querySelector('.zufall-btn');
  const mitX2 = (opts.typen ?? ALLE_TYPEN).some((t) => t.kind==='x2');
  zufallBtn.addEventListener('click', () => {
    input.value = erzeugeZufaelligenTerm({ mitX2 });
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const tiles = flaeche.tafel.board.tiles;
    const erwartet = nettoKoeffizienten(tiles);
    // Runde 21 (Punkt 7): nur die vollständig GEKÜRZTE Bearbeitungsfläche
    // zählt als Lösung – stimmt zwar schon der Netto-Wert, liegen aber noch
    // unaufgelöste Nullpaare aus, ist das noch keine fertige Antwort.
    const geparst = parseTerm(input.value);
    if(geparst && koeffizientenGleich(geparst, erwartet) && !istKachelnVollstaendigGekuerzt(tiles)){
      feedbackEl.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
      feedbackEl.textContent = 'Der Wert stimmt schon, aber löse zuerst noch alle Nullpaare auf der Fläche auf – erst die vollständig gekürzte Fläche zählt als Lösung.';
      feedbackEl.classList.add('term-check-feedback--falsch');
      return;
    }
    pruefeTermEingabe(input.value, erwartet, feedbackEl);
  });
}
