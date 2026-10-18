import { tilesAusKoeffizienten } from '../engine/gleichungen.js';
import { erzeugeZufaelligeGleichung, erzeugeZufaelligeGleichungKoeffizienten, erzeugeZufaelligeKachelsammlung, istKachelnVollstaendigGekuerzt, koeffizientenGleich, nettoKoeffizienten, parseGleichung, pruefeGleichungEingabe } from '../engine/termParser.js';
import { erzeugeGleichungsKette } from '../shared/gleichungsKette.js';
import { ALLE_TYPEN } from '../shared/palette.js';
import { mountUebungsAnsichten } from '../terme/uebungsAnsichten.js';

/* ============================================================
   Ansichten "Gleichungen" (entspricht .../gleichungen/*.js): Sandbox (seit
   Runde 19 die "Gleichungs-Kette" mit Äquivalenzumformungen, siehe oben),
   Plättchen zu Gleichung (ablesen + eintragen unter beiden Flächen, mit
   Zufallsgenerator) und Gleichung zu Plättchen (eintragen über beiden
   Flächen, mit Zufallsgenerator), mit denselben typen/opts wie bei "Terme".
   ============================================================ */
export function mountGleichungenSandbox(container, opts={}){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Lege auf beiden Seiten Plättchen aus, um eine Gleichung darzustellen – und forme sie mit "Auf beide Seiten anwenden" äquivalent um.</p>
    <div class="gleichungs-kette-host"></div>
  `);
  erzeugeGleichungsKette(container.querySelector('.gleichungs-kette-host'), { typen: opts.typen });
}

/* Runde 22 (Punkte 13+14): nutzt seither dieselbe UI-Mechanik wie die
   Gleichungen-Sandbox (erzeugeGleichungsKette) statt der abgespeckten
   erzeugeGleichungsSeitenPaar – "+ Neue Zeile darunter" und "Auf beide
   Seiten anwenden" (Äquivalenzumformungskasten) stehen seither auch hier zur
   Verfügung. "Zufällig" und "Überprüfen" beziehen sich auf die ZULETZT
   erzeugte Zeile (die aktuelle Bearbeitungsstufe). */
export function mountPlaettchenZuGleichung(container, opts={}){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Lege auf beiden Seiten Plättchen aus (frei oder per Zufallsgenerator), lies die entstandene Gleichung ab, trage sie unten ein und überprüfe deine Antwort (bezogen auf die zuletzt bearbeitete Zeile).</p>
    <button type="button" class="zufall-btn">Zufällige Plättchensammlung generieren</button>
    <div class="gleichungs-kette-host"></div>
    <form class="term-check-form" novalidate>
      <div class="feld feld--term">
        <label for="gleichung-eingabe-lesen">Deine abgelesene Gleichung</label>
        <input id="gleichung-eingabe-lesen" type="text" name="gleichung" placeholder="z. B. 2x² − x + 3 = −x + 5" autocomplete="off">
      </div>
      <button type="submit" class="ueberpruefen-btn">Überprüfen</button>
    </form>
    <p class="term-check-feedback" role="status" aria-live="polite"></p>
  `);

  const kette = erzeugeGleichungsKette(container.querySelector('.gleichungs-kette-host'), { typen: opts.typen });
  function letzteZeile(){ const zeilen = kette.getZeilen(); return zeilen[zeilen.length-1]; }

  const form = container.querySelector('.term-check-form');
  const input = container.querySelector('#gleichung-eingabe-lesen');
  const feedbackEl = container.querySelector('.term-check-feedback');
  const zufallBtn = container.querySelector('.zufall-btn');
  const mitX2 = (opts.typen ?? ALLE_TYPEN).some((t) => t.kind==='x2');

  zufallBtn.addEventListener('click', () => {
    // Runde 30 (Punkt 1): beide Seiten wurden bis dahin VOLLSTÄNDIG
    // unabhängig voneinander per erzeugeZufaelligeKachelsammlung erzeugt –
    // die resultierende Gleichung hatte dadurch im Allgemeinen keine
    // ganzzahlige Lösung. Seither bestimmt erzeugeZufaelligeGleichungKoeffizienten
    // zuerst eine ganzzahlige Lösung x und beide Seiten passend dazu.
    const zeile = letzteZeile();
    const { links, rechts } = erzeugeZufaelligeGleichungKoeffizienten({ mitX2 });
    zeile.links.clear();
    zeile.links.addTiles(tilesAusKoeffizienten(links));
    zeile.rechts.clear();
    zeile.rechts.addTiles(tilesAusKoeffizienten(rechts));
    input.value = '';
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const zeile = letzteZeile();
    const erwartetLinks = nettoKoeffizienten(zeile.links.board.tiles);
    const erwartetRechts = nettoKoeffizienten(zeile.rechts.board.tiles);
    // Runde 21 (Punkt 6): nur die vollständig vereinfachte Gleichung zählt
    // als Lösung, nicht nur eine wertgleiche.
    pruefeGleichungEingabe(input.value, erwartetLinks, erwartetRechts, feedbackEl, { erfordertVereinfachteForm: true });
  });
}

/* Runde 22 (siehe mountPlaettchenZuGleichung für die volle Begründung):
   nutzt seither ebenfalls erzeugeGleichungsKette. Die Gleichung oben bleibt
   fest, "Überprüfen" bezieht sich auf die ZULETZT erzeugte Zeile. */
export function mountGleichungZuPlaettchen(container, opts={}){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Trage oben eine Gleichung ein (von Hand oder per Zufallsgenerator) und lege dann auf beiden Seiten die passenden Plättchen aus. Mit "Überprüfen" kontrollierst du dein Ergebnis (bezogen auf die zuletzt bearbeitete Zeile).</p>
    <form class="term-check-form term-check-form--vorher" novalidate>
      <div class="feld feld--term">
        <label for="gleichung-eingabe-vorgabe">Deine Gleichung</label>
        <div class="term-eingabe-zeile">
          <input id="gleichung-eingabe-vorgabe" type="text" name="gleichung" placeholder="z. B. 2x² − x + 3 = −x + 5" autocomplete="off">
          <button type="button" class="zufall-btn">Zufällig</button>
        </div>
      </div>
      <button type="submit" class="ueberpruefen-btn">Überprüfen</button>
    </form>
    <p class="term-check-feedback" role="status" aria-live="polite"></p>
    <div class="gleichungs-kette-host"></div>
  `);

  const kette = erzeugeGleichungsKette(container.querySelector('.gleichungs-kette-host'), { typen: opts.typen });
  function letzteZeile(){ const zeilen = kette.getZeilen(); return zeilen[zeilen.length-1]; }

  const form = container.querySelector('.term-check-form');
  const input = container.querySelector('#gleichung-eingabe-vorgabe');
  const feedbackEl = container.querySelector('.term-check-feedback');
  const zufallBtn = container.querySelector('.zufall-btn');
  const mitX2 = (opts.typen ?? ALLE_TYPEN).some((t) => t.kind==='x2');

  zufallBtn.addEventListener('click', () => {
    input.value = erzeugeZufaelligeGleichung({ mitX2 });
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const zeile = letzteZeile();
    const linksTiles = zeile.links.board.tiles;
    const rechtsTiles = zeile.rechts.board.tiles;
    const erwartetLinks = nettoKoeffizienten(linksTiles);
    const erwartetRechts = nettoKoeffizienten(rechtsTiles);

    // Runde 21 (Punkt 7): nur beidseitig vollständig GEKÜRZTE Flächen zählen
    // als Lösung – stimmt zwar schon der Netto-Wert, liegen aber auf einer
    // der beiden Seiten noch unaufgelöste Nullpaare aus, ist das noch keine
    // fertige Antwort.
    const geparst = parseGleichung(input.value);
    const wertRichtig = geparst && koeffizientenGleich(geparst.links, erwartetLinks) && koeffizientenGleich(geparst.rechts, erwartetRechts);
    const vollstaendigGekuerzt = istKachelnVollstaendigGekuerzt(linksTiles) && istKachelnVollstaendigGekuerzt(rechtsTiles);
    if(wertRichtig && !vollstaendigGekuerzt){
      feedbackEl.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
      feedbackEl.textContent = 'Der Wert stimmt schon, aber löse zuerst noch alle Nullpaare auf – erst zwei vollständig gekürzte Flächen zählen als Lösung.';
      feedbackEl.classList.add('term-check-feedback--falsch');
      return;
    }

    pruefeGleichungEingabe(input.value, erwartetLinks, erwartetRechts, feedbackEl);
  });
}

/* Innerer Umschalter für "Gleichungen", spiegelt mountUebungsAnsichten. */
export function mountGleichungenUebungsAnsichten(container, opts={}){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <div class="ansicht-tabs" role="tablist"></div>
    <div class="ansicht-inhalt"></div>
  `);
  const ANSICHTEN = [
    {id:'sandbox', titel:'Sandbox', mount:(el)=>mountGleichungenSandbox(el, opts)},
    {id:'plaettchen-zu-gleichung', titel:'Plättchen zu Gleichung', mount:(el)=>mountPlaettchenZuGleichung(el, opts)},
    {id:'gleichung-zu-plaettchen', titel:'Gleichung zu Plättchen', mount:(el)=>mountGleichungZuPlaettchen(el, opts)},
  ];
  const tabsEl = container.querySelector('.ansicht-tabs');
  const inhaltEl = container.querySelector('.ansicht-inhalt');
  function zeigeAnsicht(ansicht){
    tabsEl.querySelectorAll('.ansicht-tab').forEach(btn => {
      const aktiv = btn.dataset.id===ansicht.id;
      btn.classList.toggle('ansicht-tab--aktiv', aktiv);
      btn.setAttribute('aria-selected', String(aktiv));
    });
    ansicht.mount(inhaltEl);
  }
  for(const ansicht of ANSICHTEN){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ansicht-tab';
    btn.dataset.id = ansicht.id;
    btn.setAttribute('role','tab');
    btn.textContent = ansicht.titel;
    btn.addEventListener('click', () => zeigeAnsicht(ansicht));
    tabsEl.appendChild(btn);
  }
  zeigeAnsicht(ANSICHTEN[0]);
}
