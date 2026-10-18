import { tilesAusKoeffizient } from '../engine/gleichungen.js';
import { berechneQuadratischeErgaenzung } from '../engine/rechnen.js';
import { formatiereKoeffizientenAlsTerm, zufaelligeGanzzahl } from '../engine/termParser.js';
import { TYPEN_OHNE_QUADRAT, erzeugeBereichsTabs } from '../shared/bereichsTabs.js';
import { erzeugeFreieFlaeche } from '../shared/freieFlaeche.js';
import { ALLE_TYPEN } from '../shared/palette.js';

/* ============================================================
   Bereich "Funktionen" (entspricht .../funktionen/module.js) – "Lineare
   Funktionen"/"Quadratische Funktionen" fachlich noch nicht umgesetzt, war
   nicht Teil des ursprünglichen Ablaufplans. Runde 21 (Punkt 10, Nutzer-
   Vorgabe: "Erstelle einen Reiter unter Funktionen: Parabeln") fügt
   "Parabeln" als dritten, bereits funktionsfähigen Unterpunkt hinzu –
   erzeugeBereichsTabs wählt automatisch den ersten Unterpunkt MIT
   mount-Funktion als Vorauswahl, das ist also "Parabeln".
   ============================================================ */
export function mountFunktionenBereich(container){
  erzeugeBereichsTabs(container, {
    titel: 'Funktionen',
    eintraege: [
      {id:'lineare-funktionen', titel:'Lineare Funktionen', mount:mountLineareFunktionen},
      {id:'quadratische-funktionen', titel:'Quadratische Funktionen', mount:mountQuadratischeFunktionen},
      // Runde 28 (Punkt 4): der bisherige Zwischen-Reiter "Parabeln" (ein
      // Tab-Umschalter mit nur einem einzigen Eintrag) entfällt ersatzlos –
      // "Normalform zu Scheitelform" steht seither direkt als dritter
      // Unterpunkt von "Funktionen", vgl. ehemalige Funktion mountParabeln.
      {id:'normalform-zu-scheitelform', titel:'Normalform zu Scheitelform', mount:mountNormalformZuScheitelform},
    ],
  });
}

/* Runde 21 (Punkt 10, Nutzer-Vorgabe: "Darunter mache einen Reiter
   'Normalform zu Scheitelform'. Hier soll eine Parabel der Form x²+bx+c in
   die Form (x-d)²+e gebracht werden durch quadratische Ergänzung."). Runde
   22 (Punkt 9) baut das zu einer Übung in DREI SCHRITTEN je zufällig
   generierter Parabel x² + bx + c aus:
   1. Eine BEARBEITUNGSFLÄCHE (dieselbe Komponente wie überall sonst,
      erzeugeFreieFlaeche) startet vorbefüllt mit genau den Plättchen, die
      x² + bx + c darstellen – hier darf selbst die quadratische Ergänzung
      durchgeführt werden (Nullpaare hinzufügen, umsortieren, …), bevor
      überhaupt eine Zahl abgefragt wird.
   2. Erst nach Klick auf "Weiter: Scheitelform eintragen" erscheint das
      Formular: d und e der Scheitelform (x − d)² + e, PLUS ein eigenes,
      dediziertes SCHEITELPUNKT-Eingabefeld S(x|y) – beide rechnerisch
      identisch zu d/e, aber bewusst getrennt abgefragt, weil Lernende
      erfahrungsgemäß genau HIER das Vorzeichen verwechseln (sie lesen aus
      "x − d" fälschlich den Scheitelpunkt "(−d | e)" ab).
   3. Erst nach vollständig richtiger Eingabe (Schritt 2) erscheint eine
      Transfer-Aufgabe: ein Koordinatensystem mit ZWEI Graphen zur Auswahl –
      der korrekte (Scheitelpunkt (d|e)) und ein Distraktor mit dem
      klassischen Vorzeichenfehler (Scheitelpunkt (−d|e)), Zuordnung zu
      Knopf A/B bei jeder Aufgabe neu ausgewürfelt.
   Rechnerisch reicht weiterhin berechneQuadratischeErgaenzung vollständig
   aus: x² + bx + c = (x + b/2)² + rest, mit d = −b/2 und e = rest. */
export function mountNormalformZuScheitelform(container){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Bringe die Parabel x² + bx + c mittels quadratischer Ergänzung in die Scheitelform (x − d)² + e. Übe die Ergänzung zuerst selbst auf der Bearbeitungsfläche, trage danach d, e sowie den Scheitelpunkt ein und wähle zuletzt den passenden Graphen aus.</p>
    <button type="button" class="zufall-btn">Zufällige Parabel generieren</button>
    <p class="parabel-aufgabe">x² <span class="parabel-b"></span>x <span class="parabel-c"></span></p>

    <section class="scheitelform-arbeitsflaeche">
      <h3 class="rechen-beispiel__titel">Schritt 1: Quadratische Ergänzung selbst durchführen</h3>
      <div class="freie-flaeche"></div>
      <button type="button" class="scheitelform-weiter-btn">Weiter: Scheitelform eintragen</button>
    </section>

    <section class="scheitelform-formular-bereich" hidden>
      <h3 class="rechen-beispiel__titel">Schritt 2: Scheitelform und Scheitelpunkt eintragen</h3>
      <form class="scheitelform-form rechnung-form" novalidate>
        <span class="qe-form__symbol">(x</span>
        <div class="feld"><label for="scheitelform-feld-d-vz">Zeichen</label><select id="scheitelform-feld-d-vz" name="d-vz" aria-label="Rechenzeichen vor d"><option value="+">+</option><option value="-">−</option></select></div>
        <div class="feld"><label for="scheitelform-feld-d">d</label><input id="scheitelform-feld-d" type="number" name="d" step="1" min="0" required></div>
        <span class="qe-form__symbol">)²</span>
        <div class="feld"><label for="scheitelform-feld-e-vz">Zeichen</label><select id="scheitelform-feld-e-vz" name="e-vz" aria-label="Rechenzeichen vor e"><option value="+">+</option><option value="-">−</option></select></div>
        <div class="feld"><label for="scheitelform-feld-e">e</label><input id="scheitelform-feld-e" type="number" name="e" step="1" min="0" required></div>
        <span class="qe-form__symbol qe-form__symbol--scheitel">Scheitelpunkt S(</span>
        <div class="feld"><label for="scheitelform-feld-sx">x</label><input id="scheitelform-feld-sx" type="number" name="sx" step="1" required></div>
        <span class="qe-form__symbol">|</span>
        <div class="feld"><label for="scheitelform-feld-sy">y</label><input id="scheitelform-feld-sy" type="number" name="sy" step="1" required></div>
        <span class="qe-form__symbol">)</span>
        <button type="submit" class="ueberpruefen-btn">Überprüfen</button>
      </form>
      <p class="term-check-feedback" role="status" aria-live="polite"></p>
    </section>

    <section class="scheitelform-graph-bereich" hidden>
      <h3 class="rechen-beispiel__titel">Schritt 3: Welcher Graph zeigt diese Parabel richtig?</h3>
      <div class="scheitelform-graph-auswahl">
        <button type="button" class="scheitelform-graph-option" data-option="a">
          <span class="scheitelform-graph-option__host"></span>
          <span class="scheitelform-graph-option__label">Graph A</span>
        </button>
        <button type="button" class="scheitelform-graph-option" data-option="b">
          <span class="scheitelform-graph-option__host"></span>
          <span class="scheitelform-graph-option__label">Graph B</span>
        </button>
      </div>
      <p class="scheitelform-graph-feedback term-check-feedback" role="status" aria-live="polite"></p>
    </section>
  `);

  const bEl = container.querySelector('.parabel-b');
  const cEl = container.querySelector('.parabel-c');

  const flaecheHostEl = container.querySelector('.scheitelform-arbeitsflaeche .freie-flaeche');
  const weiterBtn = container.querySelector('.scheitelform-weiter-btn');

  const formularBereichEl = container.querySelector('.scheitelform-formular-bereich');
  const form = container.querySelector('.scheitelform-form');
  const dVzSelect = container.querySelector('#scheitelform-feld-d-vz');
  const eVzSelect = container.querySelector('#scheitelform-feld-e-vz');
  const dInput = container.querySelector('#scheitelform-feld-d');
  const eInput = container.querySelector('#scheitelform-feld-e');
  const sxInput = container.querySelector('#scheitelform-feld-sx');
  const syInput = container.querySelector('#scheitelform-feld-sy');
  const feedbackEl = container.querySelector('.scheitelform-formular-bereich .term-check-feedback');

  const graphBereichEl = container.querySelector('.scheitelform-graph-bereich');
  const graphOptionBtns = [...container.querySelectorAll('.scheitelform-graph-option')];
  const graphFeedbackEl = container.querySelector('.scheitelform-graph-feedback');

  const zufallBtn = container.querySelector('.zufall-btn');

  let aktuellesB = 0, aktuellesC = 0;
  let erwartetD = 0, erwartetE = 0, erwartetDFormel = 0;
  let korrekteGraphOption = null;

  function zufaelligeGanzzahl(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
  /* Gerade Zahl ungleich 0 (Bereich −10 bis 10) – Pflicht für berechneQuadratischeErgaenzung. */
  function zufaelligesB(){ let b = 0; while(b===0) b = 2*zufaelligeGanzzahl(-5,5); return b; }
  function formatiereKoeffizient(wert){ return `${wert>=0 ? '+' : '−'} ${Math.abs(wert)}`; }
  function setzeFeedback(el, text, klasse){
    el.textContent = text;
    el.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
    if(klasse) el.classList.add(klasse);
  }

  /** Baut die Plättchen für x² + bx + c (ein x²-Plättchen, |b| x-Plättchen, |c| Zahl-Plättchen). */
  function baueTilesFuerParabel(b, c){
    const tiles = [{ kind:'x2', sign:1 }];
    const bVorzeichen = b>0 ? 1 : -1;
    for(let i=0;i<Math.abs(b);i+=1) tiles.push({ kind:'x', sign:bVorzeichen });
    if(c!==0){
      const cVorzeichen = c>0 ? 1 : -1;
      for(let i=0;i<Math.abs(c);i+=1) tiles.push({ kind:'zahl', sign:cVorzeichen });
    }
    return tiles;
  }

  function versteckeSchritte23(){
    formularBereichEl.hidden = true;
    graphBereichEl.hidden = true;
    dInput.value = ''; eInput.value = ''; sxInput.value = ''; syInput.value = '';
    dVzSelect.value = '+'; eVzSelect.value = '+';
    setzeFeedback(feedbackEl, '', null);
    setzeFeedback(graphFeedbackEl, '', null);
    for(const btn of graphOptionBtns){
      btn.querySelector('.scheitelform-graph-option__host').innerHTML = '';
      btn.disabled = true;
      btn.classList.remove('scheitelform-graph-option--richtig', 'scheitelform-graph-option--falsch');
    }
  }

  function neueAufgabe(){
    aktuellesB = zufaelligesB();
    aktuellesC = zufaelligeGanzzahl(-10, 10);
    bEl.textContent = formatiereKoeffizient(aktuellesB);
    cEl.textContent = formatiereKoeffizient(aktuellesC);

    const { rest } = berechneQuadratischeErgaenzung(aktuellesB, aktuellesC);
    // Runde 37 (Punkt 6, Nutzer-Rückmeldung mit Gegenbeispiel: x² + 2x − 7
    // wurde als (x−1)²−8 fälschlich bestätigt, richtig ist (x+1)²−8):
    // erwartetD ist der SCHEITELPUNKT (x−Koordinate) der Parabel – für
    // x² + bx + c = (x + b/2)² + rest liegt der Scheitelpunkt bei x = −b/2,
    // das bleibt für den Scheitelpunkt-Check (scheitelRichtig) und das
    // Zeichnen des Graphen weiterhin korrekt. Seit Runde 27 (Punkt 1) wird
    // das Rechenzeichen vor d im FORMULAR aber selbst ausgewählt (dVzSelect)
    // statt fest auf "−" vorgegeben zu sein – die eingegebene Formel ergibt
    // dadurch den WERT "x [gewähltes Zeichen] d" = x + dWert, und dieser muss
    // mit dem tatsächlichen +b/2 übereinstimmen, NICHT mit dem (vorzeichen-
    // verkehrten) Scheitelpunkt −b/2. Bislang wurde fälschlich derselbe Wert
    // erwartetD für beide Vergleiche benutzt, wodurch genau die Lösung mit
    // dem jeweils VERTAUSCHTEN Vorzeichen als richtig durchging.
    erwartetDFormel = aktuellesB/2;
    erwartetD = -(aktuellesB/2);
    erwartetE = rest;

    // Schritt 1: Bearbeitungsfläche komplett neu aufbauen, vorbefüllt mit den
    // zur aktuellen Parabel passenden Plättchen.
    flaecheHostEl.innerHTML = '';
    erzeugeFreieFlaeche(flaecheHostEl, {
      flaechenTitel: 'x² + bx + c',
      typen: ALLE_TYPEN,
      initialTiles: baueTilesFuerParabel(aktuellesB, aktuellesC),
    });

    versteckeSchritte23();
  }

  weiterBtn.addEventListener('click', () => { formularBereichEl.hidden = false; });

  /** Zufällig erzeugte Koordinatensystem-Darstellung EINER Parabel y=(x−vx)²+vy als Inline-SVG. */
  function erzeugeParabelSvgMarkup(vx, vy){
    const groesse = 180;
    const xMin = Math.min(0, vx) - 4;
    const xMax = Math.max(0, vx) + 4;
    const yMin = Math.min(0, vy) - 2;
    const yMax = Math.max(0, vy) + 9;
    const breiteWert = xMax - xMin;
    const hoeheWert = yMax - yMin;
    const skalaX = groesse / breiteWert;
    const skalaY = groesse / hoeheWert;
    const svgX = (x) => (x - xMin) * skalaX;
    const svgY = (y) => groesse - (y - yMin) * skalaY;

    const schritte = 60;
    const punkte = [];
    for(let i=0;i<=schritte;i+=1){
      const x = xMin + (i/schritte)*breiteWert;
      const y = (x - vx)**2 + vy;
      if(y <= yMax+1) punkte.push(`${svgX(x).toFixed(1)},${svgY(Math.min(y, yMax+1)).toFixed(1)}`);
    }
    const pfad = punkte.length>1 ? `M ${punkte.join(' L ')}` : '';

    return `
      <svg class="parabel-svg" viewBox="0 0 ${groesse} ${groesse}" width="${groesse}" height="${groesse}" role="img" aria-label="Koordinatensystem mit einer Parabel">
        <line x1="0" y1="${svgY(0).toFixed(1)}" x2="${groesse}" y2="${svgY(0).toFixed(1)}" class="parabel-svg__achse" />
        <line x1="${svgX(0).toFixed(1)}" y1="0" x2="${svgX(0).toFixed(1)}" y2="${groesse}" class="parabel-svg__achse" />
        <path d="${pfad}" class="parabel-svg__kurve" />
        <circle cx="${svgX(vx).toFixed(1)}" cy="${svgY(vy).toFixed(1)}" r="4" class="parabel-svg__scheitel" />
      </svg>
    `;
  }

  function zeigeGraphAuswahl(){
    graphBereichEl.hidden = false;
    korrekteGraphOption = Math.random()<0.5 ? 'a' : 'b';
    for(const btn of graphOptionBtns){
      const istKorrekt = btn.dataset.option===korrekteGraphOption;
      // Distraktor: klassischer Vorzeichenfehler, Scheitelpunkt bei (−d|e)
      // statt (d|e) – entspricht der Formel (x+d)²+e statt (x−d)²+e.
      const vx = istKorrekt ? erwartetD : -erwartetD;
      btn.querySelector('.scheitelform-graph-option__host').innerHTML = erzeugeParabelSvgMarkup(vx, erwartetE);
      btn.disabled = false;
      btn.classList.remove('scheitelform-graph-option--richtig', 'scheitelform-graph-option--falsch');
    }
    setzeFeedback(graphFeedbackEl, '', null);
  }

  for(const btn of graphOptionBtns){
    btn.addEventListener('click', () => {
      if(btn.disabled) return;
      for(const b of graphOptionBtns) b.disabled = true;
      const richtig = btn.dataset.option===korrekteGraphOption;
      btn.classList.add(richtig ? 'scheitelform-graph-option--richtig' : 'scheitelform-graph-option--falsch');
      if(!richtig){
        const korrekterBtn = graphOptionBtns.find((b) => b.dataset.option===korrekteGraphOption);
        korrekterBtn.classList.add('scheitelform-graph-option--richtig');
      }
      setzeFeedback(
        graphFeedbackEl,
        richtig ? 'Richtig! Das ist der passende Graph.' : 'Leider falsch – der richtige Graph ist jetzt markiert.',
        richtig ? 'term-check-feedback--richtig' : 'term-check-feedback--falsch',
      );
    });
  }

  zufallBtn.addEventListener('click', neueAufgabe);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if([dInput, eInput, sxInput, syInput].some((el) => el.value.trim()==='')){
      setzeFeedback(feedbackEl, 'Bitte d, e und den Scheitelpunkt S(x|y) vollständig eintragen.', 'term-check-feedback--fehler');
      return;
    }
    const dVorzeichen = dVzSelect.value==='-' ? -1 : 1;
    const eVorzeichen = eVzSelect.value==='-' ? -1 : 1;
    const dBetrag = Number(dInput.value), eBetrag = Number(eInput.value);
    const sxWert = Number(sxInput.value), syWert = Number(syInput.value);
    if([dBetrag, eBetrag, sxWert, syWert].some((w) => !Number.isFinite(w))){
      setzeFeedback(feedbackEl, 'Bitte für alle Felder eine Zahl eintragen.', 'term-check-feedback--fehler');
      return;
    }
    // Runde 27 (Punkt 1): Das Rechenzeichen vor d/e wird jetzt selbst ausgewählt
    // (statt im Formular-Text fest vorgegeben) – d/e-Eingabefelder sind reine
    // Beträge, das gewählte Vorzeichen wird hier mit dem Betrag verrechnet.
    const dWert = dVorzeichen * Math.abs(dBetrag), eWert = eVorzeichen * Math.abs(eBetrag);

    const formelRichtig = dWert===erwartetDFormel && eWert===erwartetE;
    // Runde 37 (Punkt 6): Der Scheitelpunkt liegt dort, wo die Klammer null
    // wird – bei "(x [gewähltes Zeichen] d)²" also bei x = −(gewähltes
    // Zeichen · d), NICHT bei denselben Werten wie d/e (das galt nur, als
    // das Rechenzeichen vor Runde 27 noch fest auf "−" stand). sy bleibt
    // weiterhin exakt gleich e, da e ganz normal addiert wird.
    const scheitelRichtig = sxWert===erwartetD && syWert===erwartetE;

    if(formelRichtig && scheitelRichtig){
      setzeFeedback(feedbackEl, 'Richtig!', 'term-check-feedback--richtig');
      zeigeGraphAuswahl();
    } else if(!formelRichtig){
      setzeFeedback(feedbackEl, 'Die Scheitelform (x … d)² … e stimmt noch nicht – versuch es noch einmal.', 'term-check-feedback--falsch');
    } else {
      setzeFeedback(feedbackEl, 'Die Scheitelform stimmt schon, aber der Scheitelpunkt S(x|y) noch nicht – sein x-Wert hat das ENTGEGENGESETZTE Vorzeichen von dem, was du vor d gewählt hast (die Klammer wird ja genau dort null), sein y-Wert ist wie e.', 'term-check-feedback--falsch');
    }
  });

  neueAufgabe();
}
/* ============================================================
   Runde 27 (Punkt 2): "Lineare Funktionen" / "Quadratische Funktionen" –
   bislang deaktivierte Platzhalter-Unterpunkte unter "Funktionen". Beide
   teilen sich dieselbe Struktur (Funktion eingeben/zufällig generieren →
   Term auf die Bearbeitungsfläche → Wertetabelle mit Schieberegler
   ausfüllen → Punkte in ein beschriftetes Koordinatensystem einzeichnen →
   zu einer Geraden/Parabel verbinden), daher ein gemeinsamer Baustein
   `mountFunktionModul`, parametrisiert über `grad` (1=linear, 2=quadratisch).
   ============================================================ */

/** Beschriftetes Koordinatensystem (x/y-Achsen MIT Zahlen) als Inline-SVG –
    im Unterschied zu erzeugeParabelSvgMarkup (Normalform zu Scheitelform,
    ohne Beschriftung) hier mit sichtbaren Achsen-Zahlen, da der Nutzer das
    für die Wertetabelle-Module explizit gefordert hat. `punkte`=[{x,y}];
    wird `funktion` übergeben UND `verbinden` ist true, zeichnet sie
    zusätzlich die Kurve (Gerade bei grad 1, Parabel bei grad 2). */
export function erzeugeBeschrifteteKoordinatenSvg(punkte, { xMin, xMax, yMin, yMax, funktion=null, verbinden=false }){
  const groesse = 260;
  const pad = 22;
  const breiteWert = xMax - xMin;
  const hoeheWert = yMax - yMin;
  const skalaX = (groesse - 2*pad) / breiteWert;
  const skalaY = (groesse - 2*pad) / hoeheWert;
  const svgX = (x) => pad + (x - xMin) * skalaX;
  const svgY = (y) => groesse - pad - (y - yMin) * skalaY;
  const nullX = svgX(Math.min(Math.max(0, xMin), xMax));
  const nullY = svgY(Math.min(Math.max(0, yMin), yMax));

  const tickXMarkup = [];
  for(let x=Math.ceil(xMin); x<=Math.floor(xMax); x+=1){
    if(x===0) continue;
    const px = svgX(x);
    tickXMarkup.push(`<line x1="${px.toFixed(1)}" y1="${(nullY-3).toFixed(1)}" x2="${px.toFixed(1)}" y2="${(nullY+3).toFixed(1)}" class="koordsys-svg__tick" />`);
    tickXMarkup.push(`<text x="${px.toFixed(1)}" y="${(nullY+14).toFixed(1)}" class="koordsys-svg__zahl" text-anchor="middle">${x}</text>`);
  }
  const tickYMarkup = [];
  for(let y=Math.ceil(yMin); y<=Math.floor(yMax); y+=1){
    if(y===0) continue;
    const py = svgY(y);
    tickYMarkup.push(`<line x1="${(nullX-3).toFixed(1)}" y1="${py.toFixed(1)}" x2="${(nullX+3).toFixed(1)}" y2="${py.toFixed(1)}" class="koordsys-svg__tick" />`);
    tickYMarkup.push(`<text x="${(nullX-6).toFixed(1)}" y="${(py+3).toFixed(1)}" class="koordsys-svg__zahl" text-anchor="end">${y}</text>`);
  }

  let kurveMarkup = '';
  if(verbinden && funktion){
    const schritte = 60;
    const kpunkte = [];
    for(let i=0;i<=schritte;i+=1){
      const x = xMin + (i/schritte)*breiteWert;
      const y = funktion(x);
      if(y>=yMin-0.001 && y<=yMax+0.001) kpunkte.push(`${svgX(x).toFixed(1)},${svgY(y).toFixed(1)}`);
    }
    if(kpunkte.length>1) kurveMarkup = `<path d="M ${kpunkte.join(' L ')}" class="koordsys-svg__kurve" />`;
  }

  const punkteMarkup = punkte.map((p) => `<circle cx="${svgX(p.x).toFixed(1)}" cy="${svgY(p.y).toFixed(1)}" r="4" class="koordsys-svg__punkt" />`).join('');

  return `
    <svg class="koordsys-svg" viewBox="0 0 ${groesse} ${groesse}" width="${groesse}" height="${groesse}" role="img" aria-label="Koordinatensystem mit den eingezeichneten Punkten">
      <line x1="${pad}" y1="${nullY.toFixed(1)}" x2="${groesse-pad}" y2="${nullY.toFixed(1)}" class="koordsys-svg__achse" />
      <line x1="${nullX.toFixed(1)}" y1="${pad}" x2="${nullX.toFixed(1)}" y2="${groesse-pad}" class="koordsys-svg__achse" />
      <text x="${groesse-pad}" y="${(nullY-6).toFixed(1)}" class="koordsys-svg__achsenlabel" text-anchor="end">x</text>
      <text x="${(nullX+6).toFixed(1)}" y="${pad+8}" class="koordsys-svg__achsenlabel">y</text>
      ${tickXMarkup.join('')}
      ${tickYMarkup.join('')}
      ${kurveMarkup}
      ${punkteMarkup}
    </svg>
  `;
}

export const FUNKTION_X_WERTE = [-3, -2, -1, 0, 1, 2, 3];

export function mountFunktionModul(container, { grad }){
  container.innerHTML = '';
  const istLinear = grad===1;
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">${istLinear
      ? 'Gib eine lineare Funktion y = mx + b selbst ein oder lass dir eine zufällig erzeugen, trage ihren Term auf die Bearbeitungsfläche, fülle die Wertetabelle aus und verbinde die Punkte zu einer Geraden.'
      : 'Gib eine quadratische Funktion y = ax² + bx + c selbst ein oder lass dir eine zufällig erzeugen, trage ihren Term auf die Bearbeitungsfläche, fülle die Wertetabelle aus und verbinde die Punkte zu einer Parabel.'}</p>

    <form class="funktion-eingabe-form rechnung-form" novalidate>
      <div class="funktion-term-formular" role="group" aria-label="Funktionsgleichung eingeben">
        <span class="funktion-term-formular__text">y =</span>
        ${istLinear ? `
          <input id="funktion-feld-m" class="funktion-blank" type="number" name="m" step="1" aria-label="Koeffizient vor x" required>
          <span class="funktion-term-formular__text">x +</span>
          <input id="funktion-feld-b" class="funktion-blank" type="number" name="b" step="1" aria-label="Absolutglied" required>
        ` : `
          <input id="funktion-feld-a" class="funktion-blank" type="number" name="a" step="1" aria-label="Koeffizient vor x²" required>
          <span class="funktion-term-formular__text">x² +</span>
          <input id="funktion-feld-b" class="funktion-blank" type="number" name="b" step="1" aria-label="Koeffizient vor x" required>
          <span class="funktion-term-formular__text">x +</span>
          <input id="funktion-feld-c" class="funktion-blank" type="number" name="c" step="1" aria-label="Absolutglied" required>
        `}
      </div>
      <button type="submit">Übernehmen</button>
    </form>
    <button type="button" class="zufall-btn">Zufällige Funktion generieren</button>
    <p class="funktion-term-anzeige">y = <span class="funktion-term-wert">–</span></p>
    <p class="term-check-feedback funktion-eingabe-feedback" role="status" aria-live="polite"></p>

    <section class="funktion-bereich-abschnitt funktion-bearbeitungsflaeche-bereich">
      <h3 class="rechen-beispiel__titel">Term auf der Bearbeitungsfläche</h3>
      <div class="freie-flaeche"></div>
    </section>

    <section class="funktion-bereich-abschnitt funktion-wertetabelle-bereich">
      <h3 class="rechen-beispiel__titel">Wertetabelle ausfüllen</h3>
      <table class="wertetabelle">
        <thead>
          <tr><th>x</th>${FUNKTION_X_WERTE.map((x) => `<th>${x}</th>`).join('')}</tr>
        </thead>
        <tbody>
          <tr>
            <th>y</th>
            ${FUNKTION_X_WERTE.map((x) => `<td><input type="number" step="1" class="wertetabelle-eingabe" data-x="${x}" aria-label="Funktionswert bei x=${x}"></td>`).join('')}
          </tr>
        </tbody>
      </table>
      <p class="term-check-feedback wertetabelle-feedback" role="status" aria-live="polite"></p>
      <button type="button" class="punkte-einzeichnen-btn" disabled>Punkte einzeichnen</button>
    </section>

    <section class="funktion-bereich-abschnitt funktion-graph-bereich" hidden>
      <h3 class="rechen-beispiel__titel">Koordinatensystem</h3>
      <div class="funktion-graph-host"></div>
      <button type="button" class="verbinden-btn">${istLinear ? 'Zu einer Geraden verbinden' : 'Zu einer Parabel verbinden'}</button>
    </section>
  `);

  const form = container.querySelector('.funktion-eingabe-form');
  const eingabeFeedbackEl = container.querySelector('.funktion-eingabe-feedback');
  const zufallBtn = container.querySelector('.zufall-btn');
  const termWertEl = container.querySelector('.funktion-term-wert');
  const flaecheHostEl = container.querySelector('.funktion-bearbeitungsflaeche-bereich .freie-flaeche');

  const tabellenFeedbackEl = container.querySelector('.wertetabelle-feedback');
  const tabellenEingaben = [...container.querySelectorAll('.wertetabelle-eingabe')];
  const punkteBtn = container.querySelector('.punkte-einzeichnen-btn');

  const graphBereichEl = container.querySelector('.funktion-graph-bereich');
  const graphHostEl = container.querySelector('.funktion-graph-host');
  const verbindenBtn = container.querySelector('.verbinden-btn');

  let koeffizienten = istLinear ? { m:1, b:0 } : { a:1, b:0, c:0 };

  function setzeFeedback(el, text, klasse){
    el.textContent = text;
    el.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
    if(klasse) el.classList.add(klasse);
  }

  function berechneWert(x){
    return istLinear ? koeffizienten.m*x + koeffizienten.b : koeffizienten.a*x*x + koeffizienten.b*x + koeffizienten.c;
  }

  function koeffizientenAlsTermObjekt(){
    return istLinear
      ? { x2:0, x:koeffizienten.m, zahl:koeffizienten.b }
      : { x2:koeffizienten.a, x:koeffizienten.b, zahl:koeffizienten.c };
  }

  function baueInitialTiles(){
    const k = koeffizientenAlsTermObjekt();
    return [...tilesAusKoeffizient(k.x2, 'x2'), ...tilesAusKoeffizient(k.x, 'x'), ...tilesAusKoeffizient(k.zahl, 'zahl')];
  }

  /* Setzt Wertetabelle, Schieberegler, Graph-Bereich zurück – immer wenn
     eine (neue oder geänderte) Funktion übernommen wird. */
  function setzeUebungZurueck(){
    for(const input of tabellenEingaben){
      input.value = '';
      input.classList.remove('wertetabelle-eingabe--richtig', 'wertetabelle-eingabe--falsch');
    }
    setzeFeedback(tabellenFeedbackEl, '', null);
    punkteBtn.disabled = true;
    graphBereichEl.hidden = true;
    verbindenBtn.disabled = false;
  }

  function uebernehmeFunktion(){
    termWertEl.textContent = formatiereKoeffizientenAlsTerm(koeffizientenAlsTermObjekt());
    flaecheHostEl.innerHTML = '';
    erzeugeFreieFlaeche(flaecheHostEl, {
      flaechenTitel: 'y',
      typen: istLinear ? TYPEN_OHNE_QUADRAT : ALLE_TYPEN,
      initialTiles: baueInitialTiles(),
    });
    setzeUebungZurueck();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if(istLinear){
      const m = Number(container.querySelector('#funktion-feld-m').value);
      const b = Number(container.querySelector('#funktion-feld-b').value);
      if(![m,b].every(Number.isFinite) || m===0){
        setzeFeedback(eingabeFeedbackEl, m===0 ? 'm darf nicht 0 sein (sonst ist die Funktion nicht linear).' : 'Bitte für m und b jeweils eine Zahl eintragen.', 'term-check-feedback--fehler');
        return;
      }
      koeffizienten = { m, b };
    } else {
      const a = Number(container.querySelector('#funktion-feld-a').value);
      const b = Number(container.querySelector('#funktion-feld-b').value);
      const c = Number(container.querySelector('#funktion-feld-c').value);
      if(![a,b,c].every(Number.isFinite) || a===0){
        setzeFeedback(eingabeFeedbackEl, a===0 ? 'a darf nicht 0 sein (sonst ist die Funktion nicht quadratisch).' : 'Bitte für a, b und c jeweils eine Zahl eintragen.', 'term-check-feedback--fehler');
        return;
      }
      koeffizienten = { a, b, c };
    }
    setzeFeedback(eingabeFeedbackEl, '', null);
    uebernehmeFunktion();
  });

  zufallBtn.addEventListener('click', () => {
    if(istLinear){
      let m = 0; while(m===0) m = zufaelligeGanzzahl(-5,5);
      const b = zufaelligeGanzzahl(-5,5);
      koeffizienten = { m, b };
      container.querySelector('#funktion-feld-m').value = String(m);
      container.querySelector('#funktion-feld-b').value = String(b);
    } else {
      let a = 0; while(a===0) a = zufaelligeGanzzahl(-3,3);
      const b = zufaelligeGanzzahl(-5,5);
      const c = zufaelligeGanzzahl(-5,5);
      koeffizienten = { a, b, c };
      container.querySelector('#funktion-feld-a').value = String(a);
      container.querySelector('#funktion-feld-b').value = String(b);
      container.querySelector('#funktion-feld-c').value = String(c);
    }
    setzeFeedback(eingabeFeedbackEl, '', null);
    uebernehmeFunktion();
  });

  function aktualisiereTabellenStatus(){
    let alleAusgefuellt = true;
    let alleRichtig = true;
    for(const input of tabellenEingaben){
      const x = Number(input.dataset.x);
      if(input.value.trim()===''){
        alleAusgefuellt = false;
        input.classList.remove('wertetabelle-eingabe--richtig', 'wertetabelle-eingabe--falsch');
        continue;
      }
      const eingabeWert = Number(input.value);
      const richtig = Number.isFinite(eingabeWert) && eingabeWert===berechneWert(x);
      input.classList.toggle('wertetabelle-eingabe--richtig', richtig);
      input.classList.toggle('wertetabelle-eingabe--falsch', !richtig);
      if(!richtig) alleRichtig = false;
    }
    if(!alleAusgefuellt){
      setzeFeedback(tabellenFeedbackEl, '', null);
      punkteBtn.disabled = true;
    } else if(alleRichtig){
      setzeFeedback(tabellenFeedbackEl, 'Alle Funktionswerte sind richtig! Du kannst die Punkte jetzt einzeichnen.', 'term-check-feedback--richtig');
      punkteBtn.disabled = false;
    } else {
      setzeFeedback(tabellenFeedbackEl, 'Noch nicht alle Werte sind richtig – die markierten Felder stimmen noch nicht.', 'term-check-feedback--falsch');
      punkteBtn.disabled = true;
    }
  }
  for(const input of tabellenEingaben) input.addEventListener('input', aktualisiereTabellenStatus);

  function graphGrenzen(){
    const xMin = FUNKTION_X_WERTE[0]-1, xMax = FUNKTION_X_WERTE[FUNKTION_X_WERTE.length-1]+1;
    const werte = [];
    for(let x=xMin; x<=xMax; x+=1) werte.push(berechneWert(x));
    let yMin = Math.min(0, ...werte) - 1;
    let yMax = Math.max(0, ...werte) + 1;
    return { xMin, xMax, yMin, yMax };
  }

  punkteBtn.addEventListener('click', () => {
    const punkte = FUNKTION_X_WERTE.map((x) => ({ x, y: berechneWert(x) }));
    graphBereichEl.hidden = false;
    verbindenBtn.disabled = false;
    graphHostEl.innerHTML = erzeugeBeschrifteteKoordinatenSvg(punkte, { ...graphGrenzen(), verbinden:false });
  });

  verbindenBtn.addEventListener('click', () => {
    const punkte = FUNKTION_X_WERTE.map((x) => ({ x, y: berechneWert(x) }));
    verbindenBtn.disabled = true;
    graphHostEl.innerHTML = erzeugeBeschrifteteKoordinatenSvg(punkte, { ...graphGrenzen(), funktion:berechneWert, verbinden:true });
  });

  uebernehmeFunktion();
}

export function mountLineareFunktionen(container){ mountFunktionModul(container, { grad:1 }); }
export function mountQuadratischeFunktionen(container){ mountFunktionModul(container, { grad:2 }); }
