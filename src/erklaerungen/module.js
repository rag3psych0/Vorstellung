import { planeAusklammernLoesung, planeGleichungsLoesung, planeQuadratischeErgaenzungGleichungLoesung } from '../engine/gleichungen.js';
import { mountErklaerung } from './erklaerung.js';
import { mountKlammernMultiplizierenErklaerung } from './klammern-multiplizieren.js';
import { appendLogEntry, mountEinzelBeispiel, mountMultiplikationDivisionErklaerung } from './multiplikation-division/erklaerung.js';
import { mountQuadratischeErgaenzungErklaerung } from './quadratische-ergaenzung/erklaerung.js';
import { mountGleichungenBereich } from '../gleichungen/module.js';
import { createAndockRasterUI } from '../shared/andockRaster.js';
import { TYPEN_OHNE_QUADRAT, erzeugeBereichsTabs } from '../shared/bereichsTabs.js';
import { erzeugeGleichungsKette } from '../shared/gleichungsKette.js';
import { createPlaettchenElement } from '../shared/renderPlaettchen.js';

/* ============================================================
   Bereich "Erklärungen" (entspricht .../erklaerungen/module.js)
   ============================================================ */
/* "Klammern multiplizieren" stand ursprünglich (Runde 12–16) als
   Unterpunkt unter "Terme" – seit Runde 17 (Nutzer-Rückmeldung Punkt 5)
   hier unter "Erklärungen", da es inhaltlich eine geführte Erklärung der
   Multiplikation zweier Klammern ist, keine freie Übung. "Division /
   Faktorisieren" wurde in Runde 17 (Nutzer-Rückmeldung Punkt 6) ganz
   entfernt (siehe mountDivisionFaktorisieren, das es zuvor bereitstellte).
   Seit Runde 18 (Punkt 3) heißt der Reiter "Multiplikation von Klammern/Das
   Malkreuz" und zeigt zusätzlich zur freien Übung eine geführte,
   Schritt-für-Schritt erzählte Erklärung. */
/* --- Runde 19 (Nutzer-Vorgabe): "Gleichungen" innerhalb von "Erklärungen",
   selbst wieder in "Linear"/"Quadratisch" unterteilt (verschachtelte Tabs,
   dieselbe Struktur wie mountGleichungenBereich auf oberster Ebene). Zeigt
   eine geführte, Schritt-für-Schritt erzählte Lösung von "a·kind + b = c"
   per Äquivalenzumformung (planeGleichungsLoesung), mit anschließender
   "Frei ab hier weiterarbeiten" (erzeugeGleichungsKette). --- */
/**
 * Runde 22 (Punkt 5): "Quadratisch" ist selbst nochmal in drei Unterkapitel
 * aufgeteilt (verschachtelte Tabs auf einer dritten Ebene), da die drei
 * klassischen Grundformen quadratischer Gleichungen jeweils einen eigenen,
 * grundverschiedenen Lösungsweg brauchen:
 * - "a·x² + c = 0": weiterhin über planeGleichungsLoesung (Äquivalenz-
 *   umformungen + Wurzelziehen, unverändert seit Runde 19/21).
 * - "a·x² + b·x = 0": NEU über planeAusklammernLoesung (Ausklammern von x +
 *   Nullprodukt-Eigenschaft).
 * - "a·x² + b·x + c = 0": NEU über planeQuadratischeErgaenzungGleichungLoesung
 *   – AUSDRÜCKLICH über quadratische Ergänzung statt der abc-/pq-Formel.
 * Alle drei nutzen denselben generischen Renderer mountGleichungLoesungErklaerung
 * unten (Formular/Frame/"Nächster Schritt"/Log/"Frei ab hier weiterarbeiten"-
 * Grundgerüst bleibt gleich, nur Formular-Felder und die aufgerufene
 * Lösungsweg-Funktion unterscheiden sich je Unterkapitel).
 */
export function mountGleichungenErklaerungenBereich(container){
  erzeugeBereichsTabs(container, {
    titel: 'Gleichungen',
    tabsKlasse: 'gleichungen-erklaerung-tabs',
    eintraege: [
      {id:'linear', titel:'Linear', mount:(el)=>mountLinearErklaerung(el)},
      {id:'quadratisch', titel:'Quadratisch', mount:(el)=>mountQuadratischErklaerungenBereich(el)},
    ],
  });
}

/**
 * Liest ein Vorzeichen-Dropdown + ein betragsmäßiges Zahlenfeld (min=0) als
 * EIN ggf. negatives Koeffizienten-Paar – dasselbe Muster wie dVzSelect/
 * eVzSelect in mountNormalformZuScheitelform (Funktionen-Modul). Runde 37
 * (Punkt 1, Nutzer-Rückmeldung): erlaubt, zwischen den Termen x²/x/1 selbst
 * zu entscheiden, ob dort ein "+" oder ein "−" stehen soll.
 */
function leseVorzeichenBetrag(el, vzId, betragId){
  const vz = el.querySelector(`#${vzId}`).value;
  const betrag = Number(el.querySelector(`#${betragId}`).value);
  return (vz==='-' ? -1 : 1) * Math.abs(betrag);
}

/** Unterkapitel "Linear": unverändert die ursprüngliche Form "a·x + b = c". */
export function mountLinearErklaerung(container){
  mountGleichungLoesungErklaerung(container, {
    intro: 'Gib eine Gleichung der Form „a·x + b = c" ein und lass dir Schritt für Schritt zeigen, wie man sie durch Äquivalenzumformungen (auf beiden Seiten zugleich) nach x auflöst. a darf auch negativ sein (nur a = 0 ist nicht erlaubt), und das Rechenzeichen vor b kannst du selbst wählen.',
    kettenTypen: TYPEN_OHNE_QUADRAT,
    formHtml: `
      <div class="feld"><label for="ge-lin-a">a</label><input id="ge-lin-a" type="number" value="1" step="1" required></div>
      <span class="gleichung-erklaerung-form__symbol">·x</span>
      <div class="feld"><label for="ge-lin-b-vz">Zeichen</label><select id="ge-lin-b-vz" aria-label="Rechenzeichen vor b"><option value="+">+</option><option value="-">−</option></select></div>
      <div class="feld"><label for="ge-lin-b">b</label><input id="ge-lin-b" type="number" value="3" step="1" min="0" required></div>
      <span class="gleichung-erklaerung-form__symbol">=</span>
      <div class="feld"><label for="ge-lin-c">c</label><input id="ge-lin-c" type="number" value="7" step="1" required></div>
    `,
    leseWerte: (el) => ({
      a: Number(el.querySelector('#ge-lin-a').value),
      b: leseVorzeichenBetrag(el, 'ge-lin-b-vz', 'ge-lin-b'),
      c: Number(el.querySelector('#ge-lin-c').value),
    }),
    werteGueltig: ({a,b,c}) => Number.isInteger(a) && a!==0 && Number.isInteger(b) && Number.isInteger(c),
    loese: ({a,b,c}) => planeGleichungsLoesung('x', a, b, c),
    fehlerText: (fehler, {a}) => fehlerTextLinearQuadratisch(fehler, a),
  });
}

/** "Quadratisch": drei Unterkapitel (Runde 22, Punkt 5) als eigene, verschachtelte Tab-Ebene. */
export function mountQuadratischErklaerungenBereich(container){
  erzeugeBereichsTabs(container, {
    titel: 'Quadratisch',
    tabsKlasse: 'ansicht-tabs',
    eintraege: [
      { id:'ax2-c', titel:'a·x² + c = 0', mount:(el)=>mountAxQuadratPlusCErklaerung(el) },
      { id:'ax2-bx', titel:'a·x² + b·x = 0', mount:(el)=>mountAusklammernErklaerung(el) },
      { id:'ax2-bx-c', titel:'a·x² + b·x + c = 0', mount:(el)=>mountQuadratischeErgaenzungGleichungErklaerung(el) },
    ],
  });
}

/** Unterkapitel 1: "a·x² + c = 0" – weiterhin über planeGleichungsLoesung (Wurzelziehen), b=0 fest (kein lineares Glied). */
export function mountAxQuadratPlusCErklaerung(container){
  mountGleichungLoesungErklaerung(container, {
    intro: 'Gib eine Gleichung der Form „a·x² + c = 0" ein und lass dir zeigen, wie man sie durch Äquivalenzumformungen und Wurzelziehen nach x auflöst. a darf auch negativ sein (nur a = 0 ist nicht erlaubt), und das Rechenzeichen vor c kannst du selbst wählen.',
    kettenTypen: undefined,
    formHtml: `
      <div class="feld"><label for="ge-q1-a">a</label><input id="ge-q1-a" type="number" value="2" step="1" required></div>
      <span class="gleichung-erklaerung-form__symbol">·x²</span>
      <div class="feld"><label for="ge-q1-c-vz">Zeichen</label><select id="ge-q1-c-vz" aria-label="Rechenzeichen vor c"><option value="+">+</option><option value="-" selected>−</option></select></div>
      <div class="feld"><label for="ge-q1-c">c</label><input id="ge-q1-c" type="number" value="8" step="1" min="0" required></div>
      <span class="gleichung-erklaerung-form__symbol">= 0</span>
    `,
    leseWerte: (el) => ({
      a: Number(el.querySelector('#ge-q1-a').value),
      c: leseVorzeichenBetrag(el, 'ge-q1-c-vz', 'ge-q1-c'),
    }),
    werteGueltig: ({a,c}) => Number.isInteger(a) && a!==0 && Number.isInteger(c),
    // "a·x² + c = 0" entspricht exakt planeGleichungsLoesung('x2', a, c, 0).
    loese: ({a,c}) => planeGleichungsLoesung('x2', a, c, 0),
    fehlerText: (fehler, {a}) => fehlerTextLinearQuadratisch(fehler, a),
  });
}

/** Unterkapitel 2 (NEU, Runde 22): "a·x² + b·x = 0" über Ausklammern + Nullprodukt. */
export function mountAusklammernErklaerung(container){
  mountGleichungLoesungErklaerung(container, {
    intro: 'Gib eine Gleichung der Form „a·x² + b·x = 0" ein (kein konstantes Glied) und lass dir zeigen, wie man sie durch AUSKLAMMERN von x und die Nullprodukt-Eigenschaft löst. a darf auch negativ sein (nur a = 0 ist nicht erlaubt), und das Rechenzeichen vor b kannst du selbst wählen.',
    kettenTypen: undefined,
    formHtml: `
      <div class="feld"><label for="ge-q2-a">a</label><input id="ge-q2-a" type="number" value="2" step="1" required></div>
      <span class="gleichung-erklaerung-form__symbol">·x²</span>
      <div class="feld"><label for="ge-q2-b-vz">Zeichen</label><select id="ge-q2-b-vz" aria-label="Rechenzeichen vor b"><option value="+">+</option><option value="-">−</option></select></div>
      <div class="feld"><label for="ge-q2-b">b</label><input id="ge-q2-b" type="number" value="6" step="1" min="0" required></div>
      <span class="gleichung-erklaerung-form__symbol">·x = 0</span>
    `,
    leseWerte: (el) => ({
      a: Number(el.querySelector('#ge-q2-a').value),
      b: leseVorzeichenBetrag(el, 'ge-q2-b-vz', 'ge-q2-b'),
    }),
    werteGueltig: ({a,b}) => Number.isInteger(a) && a!==0 && Number.isInteger(b),
    loese: ({a,b}) => planeAusklammernLoesung(a, b),
    fehlerText: (fehler, {a,b}) => {
      const aText = a===1 ? '' : a===-1 ? '−' : a<0 ? `−${Math.abs(a)}` : String(a);
      if(fehler==='a-ungueltig') return 'Bitte für a eine ganze Zahl ungleich 0 eingeben.';
      if(fehler==='b-ungueltig') return 'Bitte für b eine ganze Zahl eingeben.';
      if(fehler==='nicht-teilbar') return `Der zweite Faktor (${aText}x ${b>=0?'+':'−'} ${Math.abs(b)} = 0) lässt sich mit ganzzahligen Plättchen nicht ohne Rest lösen. Wähle andere Zahlen (b sollte ohne Rest durch a teilbar sein).`;
      return 'Bitte gültige ganze Zahlen eingeben.';
    },
  });
}

/** Unterkapitel 3 (NEU, Runde 22): "a·x² + b·x + c = 0" über quadratische Ergänzung (NICHT abc-/pq-Formel). */
export function mountQuadratischeErgaenzungGleichungErklaerung(container){
  mountGleichungLoesungErklaerung(container, {
    intro: 'Gib eine vollständige quadratische Gleichung der Form „a·x² + b·x + c = 0" ein und lass dir zeigen, wie man sie über QUADRATISCHE ERGÄNZUNG (nicht über die abc- oder pq-Formel) nach x auflöst. a darf auch negativ sein (nur a = 0 ist nicht erlaubt), die Rechenzeichen vor b und c kannst du selbst wählen. Wähle a und b so, dass b/a eine gerade Zahl ist, damit sich die Ergänzung mit ganzen Plättchen darstellen lässt.',
    kettenTypen: undefined,
    formHtml: `
      <div class="feld"><label for="ge-q3-a">a</label><input id="ge-q3-a" type="number" value="1" step="1" required></div>
      <span class="gleichung-erklaerung-form__symbol">·x²</span>
      <div class="feld"><label for="ge-q3-b-vz">Zeichen</label><select id="ge-q3-b-vz" aria-label="Rechenzeichen vor b"><option value="+">+</option><option value="-">−</option></select></div>
      <div class="feld"><label for="ge-q3-b">b</label><input id="ge-q3-b" type="number" value="4" step="1" min="0" required></div>
      <span class="gleichung-erklaerung-form__symbol">·x</span>
      <div class="feld"><label for="ge-q3-c-vz">Zeichen</label><select id="ge-q3-c-vz" aria-label="Rechenzeichen vor c"><option value="+">+</option><option value="-" selected>−</option></select></div>
      <div class="feld"><label for="ge-q3-c">c</label><input id="ge-q3-c" type="number" value="5" step="1" min="0" required></div>
      <span class="gleichung-erklaerung-form__symbol">= 0</span>
    `,
    leseWerte: (el) => ({
      a: Number(el.querySelector('#ge-q3-a').value),
      b: leseVorzeichenBetrag(el, 'ge-q3-b-vz', 'ge-q3-b'),
      c: leseVorzeichenBetrag(el, 'ge-q3-c-vz', 'ge-q3-c'),
    }),
    werteGueltig: ({a,b,c}) => Number.isInteger(a) && a!==0 && Number.isInteger(b) && Number.isInteger(c),
    loese: ({a,b,c}) => planeQuadratischeErgaenzungGleichungLoesung(a, b, c),
    fehlerText: (fehler) => {
      if(fehler==='nicht-teilbar-a') return 'b und c müssen sich beide ohne Rest durch a teilen lassen. Wähle andere Zahlen.';
      if(fehler==='p-ungerade') return 'Nach dem Teilen durch a wäre der x-Koeffizient ungerade – die Hälfte wäre kein ganzes Plättchen mehr. Wähle andere Zahlen (b/a sollte gerade sein).';
      if(fehler==='keine-loesung') return 'Diese Gleichung hat keine reelle Lösung. Wähle andere Zahlen.';
      if(fehler==='keine-ganzzahlige-wurzel') return 'Der Rest unter der Wurzel ist keine Quadratzahl – mit ganzen Plättchen lässt sich hier keine exakte Lösung darstellen. Wähle andere Zahlen.';
      return 'Bitte gültige ganze Zahlen eingeben (a ungleich 0).';
    },
  });
}

/** Gemeinsamer Fehlertext für die beiden über planeGleichungsLoesung laufenden Unterkapitel (Linear, "a·x² + c = 0"). */
export function fehlerTextLinearQuadratisch(fehler, a){
  if(fehler==='nicht-teilbar') return `Diese Gleichung lässt sich mit ganzzahligen Plättchen nicht ohne Rest lösen – wähle andere Zahlen (a = ${a}).`;
  if(fehler==='keine-ganzzahlige-wurzel') return 'Der Wert unter der Wurzel (x² = …) ist keine Quadratzahl – mit ganzen Plättchen lässt sich hier keine exakte Lösung darstellen. Wähle andere Zahlen.';
  if(fehler==='keine-loesung') return 'Diese Gleichung hat keine reelle Lösung, da x² dabei negativ werden müsste. Wähle andere Zahlen.';
  return 'Bitte für a eine ganze Zahl ungleich 0 eingeben.';
}

/**
 * Generischer, geführter, Schritt-für-Schritt erzählter Lösungsweg-Renderer
 * (Runde 19, seit Runde 22 aus dem ursprünglich kind-spezifischen
 * mountGleichungErklaerung verallgemeinert, damit alle vier Lösungswege –
 * linear, "a·x²+c=0", "a·x²+bx=0", "a·x²+bx+c=0" – dasselbe Formular-/
 * Frame-/"Nächster Schritt"-Grundgerüst nutzen können): opts.loese(werte)
 * liefert dieselbe {schritte, fehler}-Form wie planeGleichungsLoesung (jeder
 * Schritt entweder ein normales {links, rechts, label}-Paar oder, bei zwei
 * parallelen Lösungswegen, {zweige: [{label,links,rechts}, ...], label}).
 *
 * Jeder Frame zeigt ZWEI Tafeln nebeneinander (linke/rechte Seite der
 * Gleichung, getrennt durch ein "="). Nach der letzten Umformung bietet
 * "Frei ab hier weiterarbeiten" den Wechsel in die freie Gleichungs-Kette an.
 */
export function mountGleichungLoesungErklaerung(container, opts){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">${opts.intro}</p>
    <form class="rechnung-form gleichung-erklaerung-form" novalidate>
      ${opts.formHtml}
      <button type="submit" class="ueberpruefen-btn">Starten</button>
    </form>
    <p class="term-check-feedback" role="status" aria-live="polite"></p>
    <div class="arbeitsflaeche">
      <div class="tafel-wrapper">
        <h4>Gleichung</h4>
        <div class="gleichung-bereich ge-tafeln">
          <div class="gleichung-seite gleichung-seite--links ge-tafel-links"></div>
          <div class="gleichung-istgleich" aria-hidden="true">=</div>
          <div class="gleichung-seite gleichung-seite--rechts ge-tafel-rechts"></div>
        </div>
        <div class="ge-malkreuz-beleg" hidden>
          <p class="ge-malkreuz-beleg__hinweis"></p>
          <div class="malkreuz-host malkreuz-host--schmale-spalte ge-malkreuz-beleg__malkreuz"></div>
        </div>
        <div class="ge-wurzel-zweige" hidden>
          <div class="ge-wurzel-zweig ge-wurzel-zweig--plus">
            <h5 class="ge-wurzel-zweig__titel"></h5>
            <div class="gleichung-bereich">
              <div class="gleichung-seite gleichung-seite--links"></div>
              <div class="gleichung-istgleich" aria-hidden="true">=</div>
              <div class="gleichung-seite gleichung-seite--rechts"></div>
            </div>
            <p class="ge-wurzel-zweig__malkreuz-hinweis" hidden>Beleg am Malkreuz:</p>
            <div class="malkreuz-host malkreuz-host--schmale-spalte ge-wurzel-zweig__malkreuz" hidden></div>
          </div>
          <div class="ge-wurzel-zweig ge-wurzel-zweig--minus">
            <h5 class="ge-wurzel-zweig__titel"></h5>
            <div class="gleichung-bereich">
              <div class="gleichung-seite gleichung-seite--links"></div>
              <div class="gleichung-istgleich" aria-hidden="true">=</div>
              <div class="gleichung-seite gleichung-seite--rechts"></div>
            </div>
            <p class="ge-wurzel-zweig__malkreuz-hinweis" hidden>Beleg am Malkreuz:</p>
            <div class="malkreuz-host malkreuz-host--schmale-spalte ge-wurzel-zweig__malkreuz" hidden></div>
          </div>
        </div>
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

  const form = container.querySelector('.gleichung-erklaerung-form');
  const feedbackEl = container.querySelector('.term-check-feedback');
  const tafelnEl = container.querySelector('.ge-tafeln');
  const linksEl = container.querySelector('.ge-tafel-links');
  const rechtsEl = container.querySelector('.ge-tafel-rechts');
  const zweigeEl = container.querySelector('.ge-wurzel-zweige');
  const zweigPlusEl = container.querySelector('.ge-wurzel-zweig--plus');
  const zweigMinusEl = container.querySelector('.ge-wurzel-zweig--minus');
  const belegEl = container.querySelector('.ge-malkreuz-beleg');
  const belegHinweisEl = container.querySelector('.ge-malkreuz-beleg__hinweis');
  const belegMalkreuzEl = container.querySelector('.ge-malkreuz-beleg__malkreuz');
  const logEl = container.querySelector('.schritte-log');
  const weiterBtn = container.querySelector('.weiter-btn');
  const zurueckBtn = container.querySelector('.zurueck-btn');
  const freiBtn = container.querySelector('.frei-weiterarbeiten-btn');
  const freiHostEl = container.querySelector('.frei-weiterarbeiten-host');

  let frames = [];
  let index = 0;
  let freieKetteErstellt = false;

  function setzeFreieFortsetzungZurueck(){
    freieKetteErstellt = false;
    freiHostEl.hidden = true;
    freiHostEl.innerHTML = '';
  }

  freiBtn.addEventListener('click', () => {
    if(freieKetteErstellt || frames.length===0) return;
    freieKetteErstellt = true;
    const frame = frames[index];
    freiHostEl.hidden = false;
    erzeugeGleichungsKette(freiHostEl, {
      typen: opts.kettenTypen,
      initialLinks: frame.links.map((t) => ({ kind:t.kind, sign:t.sign })),
      initialRechts: frame.rechts.map((t) => ({ kind:t.kind, sign:t.sign })),
    });
  });

  /* Ein Frame mit `zweige` (Wurzelziehen ODER Nullprodukt) trägt zwei
     parallele {label, links, rechts} statt eines einzelnen links/rechts-
     Paars und wird ZWEISPALTIG dargestellt – die normale Ein-Gleichung-
     Ansicht wird dafür ausgeblendet, nicht ersetzt. "Frei ab hier
     weiterarbeiten" ergibt bei einer Verzweigung keinen eindeutigen
     Startzustand und bleibt dort verborgen. */
  function zeigeFrameBis(i){
    logEl.innerHTML = '';
    for(let j=0; j<=i; j+=1) appendLogEntry(logEl, frames[j].label, frames[j].isResult);
    const frame = frames[i];
    if(frame.zweige){
      tafelnEl.hidden = true;
      zweigeEl.hidden = false;
      renderZweig(zweigPlusEl, frame.zweige[0]);
      renderZweig(zweigMinusEl, frame.zweige[1]);
      freiBtn.hidden = true;
    } else {
      zweigeEl.hidden = true;
      tafelnEl.hidden = false;
      renderSeiteGleichungErklaerung(linksEl, frame.links);
      renderSeiteGleichungErklaerung(rechtsEl, frame.rechts);
      freiBtn.hidden = false;
    }
    // Runde 23 (Punkt 8, Nutzer-Rückmeldung): manche Einzel-Schritte (bislang
    // nur "wie das Quadrat zustande kommt" bei der quadratischen Ergänzung,
    // siehe planeQuadratischeErgaenzungGleichungLoesung) tragen zusätzlich
    // `malkreuzBeleg` – unabhängig davon, ob der Schritt die normale
    // Ein-Gleichung-Ansicht ODER die Zweige-Ansicht zeigt.
    // Runde 24 (Punkt 5, Nutzer-Rückmeldung: "lasse das Malkreuz für die
    // Erklärung stehen anstatt wieder wegzumachen"): einmal eingeführt,
    // bleibt dasselbe Malkreuz-Beleg für ALLE nachfolgenden Schritte
    // sichtbar – gesucht wird deshalb rückwärts ab dem aktuellen Schritt
    // nach dem zuletzt eingeführten Beleg, statt nur den direkt
    // zugehörigen Schritt zu prüfen. Geht man per "Zurück" vor den Schritt,
    // der den Beleg einführt, verschwindet er wieder (noch nicht erreicht).
    let belegQuelle = null;
    for(let j=i; j>=0; j-=1){ if(frames[j].malkreuzBeleg){ belegQuelle = frames[j].malkreuzBeleg; break; } }
    if(belegQuelle){
      belegEl.hidden = false;
      belegHinweisEl.textContent = belegQuelle.hinweis ?? 'Beleg am Malkreuz:';
      baueKleinesFaktorproduktMalkreuz(belegMalkreuzEl, belegQuelle);
    } else {
      belegEl.hidden = true;
      belegMalkreuzEl.innerHTML = '';
    }
  }

  function aktualisiereWeiterButton(){
    const fertig = index >= frames.length-1;
    weiterBtn.disabled = fertig;
    weiterBtn.textContent = fertig ? 'Fertig ✓' : 'Nächster Schritt →';
    zurueckBtn.disabled = frames.length===0 || index<=0;
  }

  function starte(werte){
    setzeFreieFortsetzungZurueck();
    const { schritte, fehler } = opts.loese(werte);
    if(fehler){
      frames = []; index = 0;
      feedbackEl.textContent = opts.fehlerText(fehler, werte);
      feedbackEl.classList.add('term-check-feedback--fehler');
      zeigeLeer(false);
      return;
    }
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('term-check-feedback--fehler');
    frames = schritte.map((s) => ({ links:s.links, rechts:s.rechts, zweige:s.zweige, malkreuzBeleg:s.malkreuzBeleg, label:s.label, isResult: s.typ==='ergebnis' || s.typ==='wurzel-ergebnis' || s.typ==='nullprodukt-ergebnis' }));
    index = 0;
    zeigeFrameBis(0);
    aktualisiereWeiterButton();
  }

  function zeigeLeer(mitReset=true){
    if(mitReset) setzeFreieFortsetzungZurueck();
    frames = []; index = 0;
    logEl.innerHTML = '';
    zweigeEl.hidden = true;
    tafelnEl.hidden = false;
    belegEl.hidden = true;
    belegMalkreuzEl.innerHTML = '';
    linksEl.innerHTML = '<p class="tafel-leer">Noch keine Gleichung dargestellt.</p>';
    rechtsEl.innerHTML = '<p class="tafel-leer">Noch keine Gleichung dargestellt.</p>';
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
    const werte = opts.leseWerte(container);
    if(!opts.werteGueltig(werte)){
      feedbackEl.textContent = 'Bitte gültige ganze Zahlen eingeben.';
      feedbackEl.classList.add('term-check-feedback--fehler');
      return;
    }
    starte(werte);
  });

  zeigeLeer();
}


/** Runde 21 (Punkt 1): zeigt EINEN der beiden parallelen Wurzelzieh-Lösungswege in seinem .ge-wurzel-zweig-Panel: Titel + eigene links/rechts-Gleichung.
    Runde 23 (Punkt 6, Nutzer-Rückmeldung): trägt ein Zweig beim Wurzelziehen
    zusätzlich `zweig.malkreuz` (siehe planeGleichungsLoesung/
    planeQuadratischeErgaenzungGleichungLoesung), wird darunter ein kleines,
    automatisch ausgefülltes Malkreuz eingeblendet, das BELEGT, dass sowohl
    (+Wurzel)·(+Wurzel) als auch (−Wurzel)·(−Wurzel) zum selben (positiven)
    Ergebnis führen – und die Gleichung deshalb zwei Lösungen hat.
    Runde 36 (Punkt 3, Nutzer-Rückmeldung): dieser Malkreuz-Beweis sitzt
    seit dieser Runde am Schritt 'wurzel-gezogen' (wenn die Wurzel gezogen
    wird), NICHT mehr erst am nachfolgenden 'wurzel-ergebnis' (wenn schon
    nach x umgestellt ist) – siehe planeQuadratischeErgaenzungGleichungLoesung.
    Runde 23 (Punkt 7, Nutzer-Rückmeldung): ein Zweig beim Ausklammern
    (seit Runde 36 am Schritt 'nullprodukt-gleichungen', siehe
    planeAusklammernLoesung) trägt stattdessen `zweig.faktorMalkreuz` –
    belegt dort, dass das Produkt-Raster leer (= 0) wird, GENAU WEIL eine
    ganze Achse (ein ganzer Faktor) leer bleibt. Beide Felder nutzen
    denselben Hinweis-/Host-Platz im Zweig-Panel (nie beide gleichzeitig
    gesetzt). */
export function renderZweig(zweigEl, zweig){
  zweigEl.querySelector('.ge-wurzel-zweig__titel').textContent = zweig.label;
  renderSeiteGleichungErklaerung(zweigEl.querySelector('.gleichung-seite--links'), zweig.links);
  renderSeiteGleichungErklaerung(zweigEl.querySelector('.gleichung-seite--rechts'), zweig.rechts);

  const hinweisEl = zweigEl.querySelector('.ge-wurzel-zweig__malkreuz-hinweis');
  const malkreuzHostEl = zweigEl.querySelector('.ge-wurzel-zweig__malkreuz');
  if(zweig.malkreuz && zweig.malkreuz.anzahl>0 && zweig.malkreuz.anzahl<=GE_WURZEL_MALKREUZ_MAX){
    hinweisEl.hidden = false;
    hinweisEl.textContent = 'Beleg am Malkreuz:';
    malkreuzHostEl.hidden = false;
    baueKleinesWurzelMalkreuz(malkreuzHostEl, zweig.malkreuz);
  } else if(zweig.faktorMalkreuz){
    hinweisEl.hidden = false;
    hinweisEl.textContent = 'Beleg am Malkreuz: eine ganze Achse bleibt leer, das Produkt-Raster wird leer (= 0).';
    malkreuzHostEl.hidden = false;
    baueKleinesFaktorproduktMalkreuz(malkreuzHostEl, zweig.faktorMalkreuz);
  } else {
    hinweisEl.hidden = true;
    malkreuzHostEl.hidden = true;
    malkreuzHostEl.innerHTML = '';
  }
}

/* Höchste noch sinnvoll als kleines Beleg-Malkreuz darstellbare Seitenlänge
   (bei größeren Wurzeln würde selbst das kleine Malkreuz unübersichtlich –
   in diesem Fall bleibt nur die textuelle Erklärung sichtbar). */
export const GE_WURZEL_MALKREUZ_MAX = 12;

/** Kleines, automatisch (nicht durch Ziehen) ausgefülltes Malkreuz: zeigt
    (±anzahl)·(±anzahl) = anzahl² – reine Veranschaulichung, siehe
    baueMalkreuzErklaerung in mountEinzelBeispiel für dasselbe Muster. */
export function baueKleinesWurzelMalkreuz(hostEl, {anzahl, sign}){
  hostEl.innerHTML = '';
  const faktorLabel = `${sign>0 ? '+' : '−'}${anzahl}`;
  const andock = createAndockRasterUI(hostEl, {
    zeilenLabel: faktorLabel,
    spaltenLabel: faktorLabel,
  });
  for(let i=0;i<anzahl;i+=1) andock.zeileHinzufuegen({kind:'zahl', sign});
  for(let j=0;j<anzahl;j+=1) andock.spalteHinzufuegen({kind:'zahl', sign});
  const raster = andock.getRaster();
  for(const zielEl of andock.getRasterEl().querySelectorAll('.mult-zelle--leer')){
    const i = Number(zielEl.dataset.zeile);
    const j = Number(zielEl.dataset.spalte);
    const zelle = raster.zellen[i][j];
    andock.versucheZelleFuellen(zielEl, {kind: zelle.erwarteteArt, sign: zelle.erwartetesVorzeichen});
  }
}

/** Kleines, automatisch (nicht durch Ziehen) ausgefülltes Malkreuz für ZWEI
    VERSCHIEDENE Faktor-Ketten (statt derselben Kette zweimal wie bei
    baueKleinesWurzelMalkreuz) – belegt beim Ausklammern (Runde 23, Punkt 7),
    dass eine KOMPLETT LEERE Achse (zeilenTiles bzw. spaltenTiles = []) das
    Produkt-Raster selbst leer (= 0) lässt: ohne Zeilen ODER ohne Spalten
    entstehen gar keine Produkt-Zellen, ganz gleich, was auf der anderen
    Achse steht. */
export function baueKleinesFaktorproduktMalkreuz(hostEl, {zeilenTiles, spaltenTiles, zeilenLabel, spaltenLabel}){
  hostEl.innerHTML = '';
  const andock = createAndockRasterUI(hostEl, { zeilenLabel, spaltenLabel });
  for(const tile of zeilenTiles) andock.zeileHinzufuegen(tile);
  for(const tile of spaltenTiles) andock.spalteHinzufuegen(tile);
  const raster = andock.getRaster();
  for(const zielEl of andock.getRasterEl().querySelectorAll('.mult-zelle--leer')){
    const i = Number(zielEl.dataset.zeile);
    const j = Number(zielEl.dataset.spalte);
    const zelle = raster.zellen[i][j];
    andock.versucheZelleFuellen(zielEl, {kind: zelle.erwarteteArt, sign: zelle.erwartetesVorzeichen});
  }
  // createAndockRasterUI zeigt seinen Standard-Hinweis ("Noch offen – ziehe
  // Plättchen …"), sobald eine Achse leer ist – hier aber ist genau das
  // ABSICHTLICH so (die leere Achse IST die Pointe) und nichts soll noch
  // gezogen werden, deshalb der passendere Hinweistext.
  const eigenerHinweisEl = hostEl.querySelector('.andock-raster__hinweis');
  if(eigenerHinweisEl) eigenerHinweisEl.textContent = 'Diese Achse bleibt absichtlich leer – deshalb hat das Produkt-Raster keine einzige Zelle und ist damit leer (= 0).';
}

/** Zeigt die Plättchen einer Gleichungsseite (nur anschaulich, ohne Ziehen) – wie die übrigen Erklär-Tafeln. */
export function renderSeiteGleichungErklaerung(container, tiles){
  container.innerHTML = '';
  if(tiles.length===0){
    const p = document.createElement('p');
    p.className = 'tafel-leer';
    p.textContent = '0';
    container.appendChild(p);
    return;
  }
  const listeEl = document.createElement('div');
  listeEl.className = 'plaettchen-tafel';
  for(const tile of tiles) listeEl.appendChild(createPlaettchenElement(tile.kind, tile.sign, {zeigeWert:true}));
  container.appendChild(listeEl);
}

export function mountErklaerungenBereich(container){
  erzeugeBereichsTabs(container, {
    titel: 'Erklärungen',
    eintraege: [
      {id:'addition-subtraktion', titel:'Addition & Subtraktion', mount:mountErklaerung},
      {id:'multiplikation-division', titel:'Multiplikation & Division', mount:mountMultiplikationDivisionErklaerung},
      {id:'klammern-multiplizieren', titel:'Multiplikation von Klammern/Das Malkreuz', mount:mountKlammernMultiplizierenErklaerung},
      {id:'quadratische-ergaenzung', titel:'Quadratische Ergänzung', mount:mountQuadratischeErgaenzungErklaerung},
      {id:'gleichungen', titel:'Gleichungen', mount:mountGleichungenErklaerungenBereich},
    ],
  });
}
