import { GLEICHUNG_MAX_FAKTOR, formatiereOperation, planeGleichungsLoesung, planeQuadratischeErgaenzungGleichungLoesung, setzeXWertEin, tilesAusKoeffizient, wendeAufBeideSeitenAn } from '../engine/gleichungen.js';
import { erzeugeUndoSpeicher, ganzzahligeWurzel, termAusBoard } from '../engine/rechnen.js';
import { erzeugeZufaelligeGleichungKoeffizienten, formatiereBruch, nettoKoeffizienten } from '../engine/termParser.js';
import { createAndockRasterUI, createMalkreuzGruppe } from './andockRaster.js';
import { erzeugeFreieFlaeche, naechsteXWertUiId } from './freieFlaeche.js';
import { createFreieTafel, verdrahteTermToggle } from './freieTafel.js';
import { ALLE_TYPEN, createPalette } from './palette.js';

/* ============================================================
   Runde 19: "Gleichungs-Kette" (entspricht .../shared/gleichungsKette.js) –
   eine oder mehrere UNABHÄNGIGE Zeilen (linke Seite | "=" | rechte Seite),
   darunter "Auf beide Seiten anwenden". Anders als die gespiegelte
   Verkettung der freien Terme-Fläche (erzeugeFreieFlaeche, Runde 17) sind
   die Zeilen hier bewusst unabhängig – wie shared/zeilenkette.js: eine
   Umformung erzeugt eine NEUE Zeile mit dem transformierten Zustand, ohne
   die Zeile darüber zu verändern (Nutzer-Vorgabe: "Eine Änderung auf einer
   Seite soll nicht automatisch die andere Seite verändern" und "daraus
   entsteht eine neue Zeile"). Jede Zeile hat ihren eigenen Rückgängig-Knopf.
   ============================================================ */
export function erzeugeGleichungsKette(container, opts={}){
  const typen = opts.typen ?? ALLE_TYPEN;
  const mitQuadrat = typen.some((t) => t.kind==='x2');
  const xWertUiId = naechsteXWertUiId();

  container.innerHTML = '';
  container.classList.add('bearbeiten-layout', 'gleichungs-kette-layout');
  // Runde 21 (Nutzer-Rückmeldung Punkt 5): der Auslöse-Knopf "Malkreuz
  // anzeigen" steht seither in der schmalen Auswahl-Spalte direkt unter
  // "Nullpaar erzeugen" statt am Ende der breiten Gleichungs-Kette-Spalte.
  // Der eigentliche Panel-Host (.gk-malkreuz-host) bleibt an seiner
  // bisherigen Position in der breiten Spalte (Platz für die
  // Kreuz-Geometrie, vgl. dieselbe Abwägung in erzeugeFreieFlaeche).
  container.insertAdjacentHTML('beforeend', `
    <div class="palette-spalte">
      <h3>Auswahl</h3>
      <div class="palette"></div>
      <button type="button" class="hinzufuegen-btn">Plättchen hinzufügen</button>
      <button type="button" class="nullpaar-btn">Nullpaar erzeugen</button>
      <button type="button" class="malkreuz-toggle-btn malkreuz-toggle-btn--klein gk-malkreuz-toggle-btn" aria-expanded="false">Malkreuz anzeigen</button>
      <div class="malkreuz-host malkreuz-host--schmale-spalte gk-malkreuz-host" hidden></div>
      <button type="button" class="leeren-btn">Fläche leeren</button>
      <div class="x-wert-einsetzen" role="group" aria-label="Konkreten x-Wert einsetzen">
        <label for="x-wert-slider-${xWertUiId}">x = <span class="x-wert-anzeige">0</span></label>
        <input type="range" id="x-wert-slider-${xWertUiId}" class="x-wert-slider" min="-5" max="5" step="1" value="0">
        <button type="button" class="x-wert-anwenden-btn">x-Wert einsetzen</button>
      </div>
    </div>
    <div class="gleichungs-kette-spalte">
      <div class="gleichungs-kette__zeilen"></div>
      <div class="gleichungs-kette__umformung">
        <h3>Auf beide Seiten anwenden</h3>
        <p class="gleichungs-kette__umformung-hinweis-text">Wähle eine oder mehrere Umformungen aus – sie reihen sich unten in die Warteschlange ein. "Jetzt anwenden" führt alle wartenden Umformungen gemeinsam aus und erzeugt eine neue Zeile darunter.</p>
        <div class="gleichungs-kette__umformung-addieren"></div>
        <div class="gleichungs-kette__umformung-faktor">
          <label for="gk-faktor">Faktor</label>
          <input id="gk-faktor" type="number" class="gk-faktor-input" value="2" min="2" max="${GLEICHUNG_MAX_FAKTOR}" step="1">
          <button type="button" class="gk-mult-btn">· multiplizieren</button>
          <button type="button" class="gk-div-btn">: dividieren</button>
          <button type="button" class="gk-mal-minus-eins-btn" title="Alle Vorzeichen auf beiden Seiten umdrehen">× (−1)</button>
        </div>
        <div class="gk-warteschlange-bereich">
          <p class="gk-warteschlange-hinweis">Noch keine Umformung ausgewählt.</p>
          <ul class="gk-warteschlange"></ul>
          <button type="button" class="gk-anwenden-btn" disabled>Jetzt anwenden</button>
        </div>
        <div class="gleichungs-kette__umformung-wurzel">
          <p class="gk-wurzel-hinweis-text">Wurzel ziehen wirkt sofort (nicht über die Warteschlange) und braucht auf einer Seite ausschließlich x² mit Faktor 1, auf der anderen ausschließlich eine Zahl – nur bei ganzzahligem Ergebnis entstehen daraus zwei neue Zeilen (Lösungsweg 1/2).</p>
          <button type="button" class="gk-wurzel-btn">√ Wurzel ziehen</button>
        </div>
        <p class="gk-umformung-hinweis" role="status" aria-live="polite"></p>
      </div>
    </div>
  `);

  const zeilenEl = container.querySelector('.gleichungs-kette__zeilen');
  const hinweisEl = container.querySelector('.gk-umformung-hinweis');
  const faktorInput = container.querySelector('.gk-faktor-input');
  const warteschlangeListeEl = container.querySelector('.gk-warteschlange');
  const warteschlangeHinweisEl = container.querySelector('.gk-warteschlange-hinweis');
  const anwendenBtn = container.querySelector('.gk-anwenden-btn');

  const zeilen = [];
  let aktiveSeite = null;
  // Runde 21 (Nutzer-Rückmeldung Punkt 11): "Bei mehreren Bearbeitungsflächen
  // sollen neu hinzugefügte Auswahlplättchen auf einer Fläche auch auf den
  // entsprechenden anderen Flächen erscheinen – auf Nachfrage ausdrücklich
  // auch bei der Gleichungs-Kette." Anders als bei erzeugeFreieFlaeche (dort
  // sind ALLE Flächen einer Gruppe IMMER wertgleich) bleiben die Zeilen hier
  // aber weiterhin eigenständige Rechenschritte – synchronisiert wird
  // deshalb NICHT der komplette Zustand, sondern nur die Geste "frei
  // hinzugefügtes Plättchen" (Palette-Knopf oder Ziehen): sie wird auf
  // dieselbe Seite (links↔links, rechts↔rechts) ALLER ANDEREN Zeilen
  // übertragen. Zwei Ausnahmen bewusst NICHT synchronisiert: (a) eine rein
  // lokale Nullpaar-Bildung/-Auflösung oder Stapel-Umsortierung
  // (details.sync===false) bleibt lokal, dieselbe Ausnahme wie bei
  // erzeugeFreieFlaeche; (b) die INITIALE Befüllung einer Zeile beim Aufbau
  // (Start-Zeile ODER das per "Jetzt anwenden" berechnete Ergebnis) ist kein
  // Nutzer-"Hinzufügen"-Schritt und darf ältere Zeilen nicht nachträglich
  // verändern – dafür sorgt der Wächter `zeilenAufbauAktiv`.
  // `istAmZeilenSynchronisieren` verhindert wie bei `synchronisiereMitGruppe`
  // eine Endlosschleife, da das render() einer Zielseite wiederum deren
  // onChange auslöst.
  let zeilenAufbauAktiv = false;
  let istAmZeilenSynchronisieren = false;

  function markiereAktiveSeite(){
    for(const zeile of zeilen){
      zeile.links.seiteEl.classList.toggle('gleichungs-kette__seite--aktiv', aktiveSeite?.zeile===zeile && aktiveSeite?.seite==='links');
      zeile.rechts.seiteEl.classList.toggle('gleichungs-kette__seite--aktiv', aktiveSeite?.zeile===zeile && aktiveSeite?.seite==='rechts');
    }
  }
  function setzeAktiveSeite(zeile, seite){ aktiveSeite = { zeile, seite }; markiereAktiveSeite(); }
  function aktiveTafel(){ return aktiveSeite ? aktiveSeite.zeile[aktiveSeite.seite] : null; }

  /* Überträgt `neueKacheln` (roh, OHNE eigenen Undo-Eintrag – das Spiegeln
     selbst ist kein zusätzlicher Nutzer-Schritt) auf DIESELBE Seite aller
     ÜBRIGEN Zeilen. Anders als synchronisiereMitGruppe (erzeugeFreieFlaeche)
     wird NICHT der komplette Zustand der Quelle gespiegelt – das würde die
     eigenständigen Zeilen-Inhalte der übrigen Zeilen überschreiben, die ja
     (anders als dort) bewusst UNTERSCHIEDLICH bleiben dürfen/sollen.
     Stattdessen wird NUR die tatsächlich neu hinzugekommene Kachel-Menge
     zusätzlich auf die übrigen Zeilen aufgelegt. */
  function synchronisiereNeueKacheln(quellZeile, quellSeiteName, neueKacheln){
    if(istAmZeilenSynchronisieren || neueKacheln.length===0) return;
    istAmZeilenSynchronisieren = true;
    try {
      for(const zeile of zeilen){
        if(zeile===quellZeile) continue;
        const zielEintrag = zeile[quellSeiteName];
        for(const t of neueKacheln) zielEintrag.tafel.board.add(t.kind, t.sign, 1);
        zielEintrag.tafel.render();
      }
    } finally { istAmZeilenSynchronisieren = false; }
  }

  function baueSeite(zeileWrapperEl, seiteName, titel, onTermChange, undo){
    const seiteEl = document.createElement('div');
    seiteEl.className = `gleichung-seite gleichung-seite--${seiteName} gleichungs-kette__seite`;
    seiteEl.insertAdjacentHTML('beforeend', `<h4>${titel}</h4><div class="freie-tafel"></div>`);
    zeileWrapperEl.appendChild(seiteEl);

    const tafelEl = seiteEl.querySelector('.freie-tafel');
    const hinweisPEl = document.createElement('p');
    hinweisPEl.className = 'freie-tafel__hinweis';
    hinweisPEl.textContent = 'Noch keine Plättchen – über die Auswahl hinzufügen.';
    tafelEl.appendChild(hinweisPEl);

    const eintrag = { seiteEl, tafelEl };
    // Runde 21 (Punkt 11): welche Kacheln (per Id) VOR dem jeweils letzten
    // onChange bereits vorhanden waren – der Vergleich mit dem aktuellen
    // Bestand liefert genau die NEU hinzugekommenen Kacheln. Wird bei JEDEM
    // onChange aktualisiert, auch wenn dabei nichts synchronisiert wird
    // (z. B. während zeilenAufbauAktiv), damit die nächste Differenzbildung
    // wieder korrekt ist.
    let vorherigeIds = new Set();
    const tafel = createFreieTafel(tafelEl, {
      undo,
      onChange(board, details){
        hinweisPEl.style.display = board.tiles.length===0 ? '' : 'none';
        if(details?.sync !== false && !zeilenAufbauAktiv && !istAmZeilenSynchronisieren){
          const neueKacheln = board.tiles.filter((t) => !vorherigeIds.has(t.id));
          synchronisiereNeueKacheln(zeile, seiteName, neueKacheln.map((t) => ({ kind:t.kind, sign:t.sign })));
        }
        vorherigeIds = new Set(board.tiles.map((t) => t.id));
        // Runde 25 (Punkt 9): analog zu erzeugeFreieFlaeche – `einsetzInfo`
        // kommt NUR vom "x-Wert einsetzen"-Knopf dieser Seite und wird von
        // jeder anderen Änderung automatisch wieder verworfen.
        // Runde 30 (Punkt 1): zusätzlich die Netto-Koeffizienten dieser
        // Seite mitgeben – aktualisiereGesamt prüft daraus, ob die aktuell
        // dargestellte (von der Lernperson selbst gelegte) Gleichung
        // überhaupt noch eine ganzzahlige Lösung hat.
        onTermChange(termAusBoard(board.tiles), details?.einsetzInfo ?? null, nettoKoeffizienten(board.tiles));
      },
    });
    eintrag.tafel = tafel;
    Object.defineProperty(eintrag, 'board', { get: () => tafel.board });
    eintrag.addTile = (...args) => tafel.addTile(...args);
    eintrag.addTiles = (...args) => tafel.addTiles(...args);
    eintrag.addZeroPair = (...args) => tafel.addZeroPair(...args);
    eintrag.clear = (...args) => tafel.clear(...args);
    eintrag.render = (...args) => tafel.render(...args);
    eintrag.ersetzeAlleTiles = (...args) => tafel.ersetzeAlleTiles(...args);

    let zeile;
    eintrag.bindeZeile = (z) => { zeile = z; };
    seiteEl.addEventListener('pointerdown', () => setzeAktiveSeite(zeile, seiteName), { capture:true });

    return eintrag;
  }

  // `umformungsInfo` ist entweder `null` (Start-Zeile) oder `{text, mehrere}`
  // – `mehrere` steuert nur die Grammatik ("Umformung" vs. "Umformungen"),
  // wenn `jetztAnwenden` (Runde 20, Punkt 6a) mehrere wartende Operationen
  // zu EINER Zeile kombiniert hat. Runde 22 (Punkt 13): jede Zeile trägt
  // zusätzlich ein eigenes "+ Neue Zeile darunter" (kopiert ihren aktuellen
  // Zustand in eine neue, unabhängige Zeile unmittelbar darunter) sowie
  // (Punkt 6) links davon ein "Zeile löschen" – mindestens eine Zeile bleibt
  // dabei immer bestehen. `nachZeile` (optional) setzt die neue Zeile direkt
  // hinter eine bestehende Zeile statt ans Ende.
  function baueZeile(linksStart, rechtsStart, umformungsInfo, nachZeile){
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'gleichungs-kette__zeile-wrapper';

    if(umformungsInfo){
      const labelEl = document.createElement('div');
      labelEl.className = 'gleichungs-kette__umformung-label';
      labelEl.textContent = `Umformung${umformungsInfo.mehrere ? 'en' : ''}: ${umformungsInfo.text} auf beiden Seiten angewendet`;
      wrapperEl.appendChild(labelEl);
    }

    const kopfEl = document.createElement('div');
    kopfEl.className = 'freie-flaeche__kopf gleichungs-kette__zeile-kopf';
    kopfEl.insertAdjacentHTML('beforeend', '<h4 class="gleichungs-kette__zeile-titel">Gleichung</h4><div class="freie-flaeche__zoom" role="group" aria-label="Zoom dieser Gleichungszeile"><button type="button" class="zoom-btn zoom-btn--raus" aria-label="Kästchen verkleinern" title="Kästchen verkleinern">−</button><button type="button" class="zoom-btn zoom-btn--rein" aria-label="Kästchen vergrößern" title="Kästchen vergrößern">+</button></div><button type="button" class="rueckgaengig-btn" disabled>↶ Rückgängig</button>');
    const zeileLoeschenBtn = document.createElement('button');
    zeileLoeschenBtn.type = 'button';
    zeileLoeschenBtn.className = 'gleichungs-kette__zeile-loeschen-btn';
    zeileLoeschenBtn.textContent = 'Zeile löschen';
    kopfEl.appendChild(zeileLoeschenBtn);
    const neueZeileBtn = document.createElement('button');
    neueZeileBtn.type = 'button';
    neueZeileBtn.className = 'gleichungs-kette__neue-zeile-btn';
    neueZeileBtn.textContent = '+ Neue Zeile darunter';
    kopfEl.appendChild(neueZeileBtn);
    wrapperEl.appendChild(kopfEl);

    // .gleichung-bereich: dieselbe vertikale Stapel-Anordnung wie schon vor
    // Runde 19 – erfüllt die Nutzer-Vorgabe ("räumlich getrennt, '=' zentriert
    // dazwischen") bereits.
    const zeileEl = document.createElement('div');
    zeileEl.className = 'gleichung-bereich gleichungs-kette__zeile';
    wrapperEl.appendChild(zeileEl);

    const rueckgaengigBtn = kopfEl.querySelector('.rueckgaengig-btn');
    const undo = erzeugeUndoSpeicher({ onChange: (n) => { rueckgaengigBtn.disabled = n===0; } });
    rueckgaengigBtn.addEventListener('click', () => undo.rueckgaengig());

    let linksTerm = '0', rechtsTerm = '0';
    // Runde 25 (Punkt 9): wenn BEIDE Seiten frisch (im selben Schritt, mit
    // demselben x-Wert) per "x-Wert einsetzen" befüllt wurden, zeigt die
    // Gesamt-Gleichung weiterhin die symbolische Form (mit x) UND – als
    // Ergebnis – die eingesetzten Zahlen, statt die Herkunft "mit x" durch
    // die reinen Zahlen zu verschleiern. Wurde DANACH nur eine der beiden
    // Seiten unabhängig weiter verändert (die andere also "stehen
    // gelassen"), gilt das gemeinsame "für x = …" nicht mehr für beide
    // Seiten gleichermaßen – dann fällt die Gesamt-Anzeige auf die schlichte
    // Form zurück.
    let linksEinsetzInfo = null, rechtsEinsetzInfo = null;
    // Runde 30 (Punkt 1, Nutzer-Rückmeldung: "Falls selbst Aufgaben erstellt
    // werden, soll darauf hingewiesen werden dass x keine ganzzahlige Zahl
    // ist"): die Netto-Koeffizienten beider Seiten (unabhängig vom gerade
    // angezeigten Term-TEXT) erlauben zu prüfen, ob die von der Lernperson
    // selbst gelegte Gleichung überhaupt noch eine ganzzahlige Lösung hat –
    // anders als bei den Zufallsgeneratoren (siehe
    // erzeugeZufaelligeGleichungKoeffizienten) kann hier nichts "vorab"
    // erzwungen werden, da die Lernperson jederzeit frei weiterlegt.
    let linksNetto = {x2:0,x:0,zahl:0}, rechtsNetto = {x2:0,x:0,zahl:0};
    function aktualisiereGesamt(){
      if(linksEinsetzInfo && rechtsEinsetzInfo && linksEinsetzInfo.wert===rechtsEinsetzInfo.wert){
        gesamtEl.textContent = `${linksEinsetzInfo.symbolVorher} = ${rechtsEinsetzInfo.symbolVorher}  →  ${linksTerm} = ${rechtsTerm}  (für x = ${linksEinsetzInfo.wert})`;
      } else {
        gesamtEl.textContent = `${linksTerm} = ${rechtsTerm}`;
      }
      // Nur für den einfachen, linearen Fall (kein Netto-x² mehr offen und
      // mindestens ein Netto-x vorhanden) lässt sich x direkt ausrechnen;
      // ein echtes x² lässt sich ohne Wurzelziehen/quadratische Ergänzung
      // ohnehin nicht als einzelner x-Wert angeben, daher bleibt der Hinweis
      // dort bewusst aus.
      const netX2 = linksNetto.x2-rechtsNetto.x2, netX = linksNetto.x-rechtsNetto.x, netZahl = linksNetto.zahl-rechtsNetto.zahl;
      const nichtGanzzahlig = netX2===0 && netX!==0 && (netZahl%netX!==0);
      ganzzahlHinweisEl.hidden = !nichtGanzzahlig;
      // Runde 32 (Punkt 2, Nutzer-Rückmeldung: "Der Hinweis soll nur sagen
      // dass x keine ganze Zahl ist. Nicht welche Zahl sie ist."): bewusst
      // OHNE den konkreten (Bruch-)Wert von x, siehe formatiereBruch oben,
      // die jetzt nur noch hier (ungenutzt für die Anzeige) stehen bleibt.
      if(nichtGanzzahlig) ganzzahlHinweisEl.textContent = `Hinweis: Für diese Gleichung ist x keine ganze Zahl.`;
    }

    const links = baueSeite(zeileEl, 'links', 'Linke Seite', (term, einsetzInfo, netto) => { linksTerm = term; linksEinsetzInfo = einsetzInfo; linksNetto = netto ?? linksNetto; aktualisiereGesamt(); }, undo);

    const gleichEl = document.createElement('span');
    gleichEl.className = 'gleichung-istgleich gleichungs-kette__gleich';
    gleichEl.textContent = '=';
    gleichEl.setAttribute('aria-hidden', 'true');
    zeileEl.appendChild(gleichEl);

    const rechts = baueSeite(zeileEl, 'rechts', 'Rechte Seite', (term, einsetzInfo, netto) => { rechtsTerm = term; rechtsEinsetzInfo = einsetzInfo; rechtsNetto = netto ?? rechtsNetto; aktualisiereGesamt(); }, undo);

    // Runde 30 (Punkt 1): immer sichtbar (anders als die zusammenklappbare
    // "Dargestellte Gleichung" weiter unten) – eine Lernperson, die eine
    // eigene Gleichung ohne ganzzahlige Lösung zusammenstellt, soll das ohne
    // einen weiteren Klick sehen.
    const ganzzahlHinweisEl = document.createElement('p');
    ganzzahlHinweisEl.className = 'gk-ganzzahl-hinweis';
    ganzzahlHinweisEl.hidden = true;
    wrapperEl.appendChild(ganzzahlHinweisEl);

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'term-toggle-btn gleichung-toggle-btn';
    wrapperEl.appendChild(toggleBtn);
    const anzeigeEl = document.createElement('div');
    anzeigeEl.className = 'term-anzeige term-anzeige--gleichung';
    anzeigeEl.insertAdjacentHTML('beforeend', '<span class="term-anzeige__label">Dargestellte Gleichung</span> <span class="term-anzeige__wert gleichung-gesamt">0 = 0</span>');
    wrapperEl.appendChild(anzeigeEl);
    const gesamtEl = anzeigeEl.querySelector('.gleichung-gesamt');
    verdrahteTermToggle(toggleBtn, anzeigeEl, { textAnzeigen:'Gleichung anzeigen', textVerbergen:'Gleichung verbergen' });

    if(nachZeile){ nachZeile.wrapperEl.after(wrapperEl); } else { zeilenEl.appendChild(wrapperEl); }

    // `undo` wird zusätzlich am Zeile-Objekt selbst hinterlegt (Runde 20):
    // das Malkreuz-Werkzeug der Kette bindet seine Rückgängig-Schritte
    // dynamisch an die Zeile der GERADE AKTIVEN Seite.
    const zeile = { wrapperEl, links, rechts, undo, zeileLoeschenBtn };
    links.bindeZeile(zeile);
    rechts.bindeZeile(zeile);

    // Runde 24 (Punkt 12): Zoom wirkt auf BEIDE Seiten dieser Zeile
    // gleichzeitig (eine Gleichung soll links/rechts stets gleich groß
    // bleiben), unabhängig von anderen Zeilen der Kette.
    const zoomRausBtn = kopfEl.querySelector('.zoom-btn--raus');
    const zoomReinBtn = kopfEl.querySelector('.zoom-btn--rein');
    function aktualisiereZeilenZoomButtons(){
      zoomRausBtn.disabled = !links.tafel.kannHerauszoomen();
      zoomReinBtn.disabled = !links.tafel.kannHineinzoomen();
    }
    zoomRausBtn.addEventListener('click', () => { links.tafel.zoomen(-1); rechts.tafel.zoomen(-1); aktualisiereZeilenZoomButtons(); });
    zoomReinBtn.addEventListener('click', () => { links.tafel.zoomen(1); rechts.tafel.zoomen(1); aktualisiereZeilenZoomButtons(); });
    aktualisiereZeilenZoomButtons();

    // Runde 21 (Punkt 11): die INITIALE Befüllung dieser Zeile (Start-Zeile
    // ODER das per "Jetzt anwenden" berechnete Umformungs-Ergebnis) ist kein
    // Nutzer-"Hinzufügen"-Schritt und darf NICHT auf die (zu diesem
    // Zeitpunkt bereits bestehenden) älteren Zeilen übertragen werden.
    zeilenAufbauAktiv = true;
    try {
      if(linksStart?.length) links.addTiles(linksStart);
      if(rechtsStart?.length) rechts.addTiles(rechtsStart);
    } finally { zeilenAufbauAktiv = false; }
    undo.leeren();

    if(nachZeile){
      zeilen.splice(zeilen.indexOf(nachZeile)+1, 0, zeile);
    } else {
      zeilen.push(zeile);
    }
    setzeAktiveSeite(zeile, 'links');
    aktualisiereZeilenLoeschenButtons();

    neueZeileBtn.addEventListener('click', () => {
      baueZeile(
        zeile.links.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign })),
        zeile.rechts.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign })),
        null,
        zeile,
      );
    });

    zeileLoeschenBtn.addEventListener('click', () => {
      if(zeilen.length<=1) return;
      const warAktiveZeile = aktiveSeite?.zeile===zeile;
      const idx = zeilen.indexOf(zeile);
      zeile.wrapperEl.remove();
      zeilen.splice(idx, 1);
      if(warAktiveZeile){
        const neueAktive = zeilen[Math.max(0, idx-1)];
        setzeAktiveSeite(neueAktive, 'links');
      }
      aktualisiereZeilenLoeschenButtons();
    });

    return zeile;
  }

  /** Deaktiviert "Zeile löschen" auf ALLEN Zeilen, solange nur eine einzige übrig ist. */
  function aktualisiereZeilenLoeschenButtons(){
    const gesperrt = zeilen.length<=1;
    for(const z of zeilen) z.zeileLoeschenBtn.disabled = gesperrt;
  }

  // --- Malkreuz (Runde 20, Punkt 6b): EIN Werkzeug für die ganze Kette,
  // gebunden an die jeweils AKTIVE Seite. Der Undo-"Speicher" ist ein
  // dünner Weiterleiter statt eines festen Speichers: er liest `aktiveSeite`
  // erst im Moment jeder Malkreuz-Aktion aus, nicht beim Erzeugen – so
  // landen Rückgängig-Schritte immer im Undo-Speicher der Zeile, die zu
  // diesem Zeitpunkt aktiv ist.
  // Runde 21 (Punkt 8/9): createMalkreuzGruppe statt eines einzelnen
  // createAndockRasterUI – siehe oben und erzeugeFreieFlaeche für dieselbe
  // Umstellung. "Anwenden" überträgt die Produkt-Plättchen auf die AKTIVE
  // Seite (dieselbe Bindung wie beim Rückgängig-Speicher).
  const malkreuzToggleBtn = container.querySelector('.gk-malkreuz-toggle-btn');
  const malkreuzHostEl = container.querySelector('.gk-malkreuz-host');
  let malkreuzGruppe = null;
  malkreuzToggleBtn.addEventListener('click', () => {
    const sichtbar = malkreuzHostEl.hidden;
    if(sichtbar && !malkreuzGruppe){
      malkreuzGruppe = createMalkreuzGruppe(malkreuzHostEl, {
        zeilenLabel: 'ein Faktor',
        spaltenLabel: 'anderer Faktor',
        undo: { aufzeichnen: (wiederherstellen) => aktiveSeite?.zeile.undo.aufzeichnen(wiederherstellen) },
        aufAnwenden(tiles){ aktiveTafel()?.addTiles(tiles); },
      });
    }
    malkreuzHostEl.hidden = !sichtbar;
    malkreuzToggleBtn.textContent = sichtbar ? 'Malkreuz verbergen' : 'Malkreuz anzeigen';
    malkreuzToggleBtn.setAttribute('aria-expanded', String(sichtbar));
  });

  const palette = createPalette(container.querySelector('.palette'), {
    typen,
    onDrop(typ, punkt){
      // Ist das Malkreuz eingeblendet, entscheidet zuerst der Ablagepunkt,
      // ob eine seiner Zonen/Zellen getroffen wurde (dieselbe Reihenfolge
      // wie in erzeugeFreieFlaeche).
      if(malkreuzGruppe && !malkreuzHostEl.hidden && malkreuzGruppe.versucheAblegen(typ, punkt)) return;
      for(const zeile of zeilen){
        for(const seiteName of ['links','rechts']){
          const eintrag = zeile[seiteName];
          const rect = eintrag.tafelEl.getBoundingClientRect();
          const innerhalb = punkt.clientX>=rect.left && punkt.clientX<=rect.right && punkt.clientY>=rect.top && punkt.clientY<=rect.bottom;
          if(!innerhalb) continue;
          setzeAktiveSeite(zeile, seiteName);
          // Runde 20 (Punkt 2): Ablagepunkt relativ zur Tafel mitgeben.
          eintrag.addTile(typ.kind, typ.sign, { punktRelativ: { x: punkt.clientX-rect.left, y: punkt.clientY-rect.top } });
          return;
        }
      }
    },
  });

  container.querySelector('.hinzufuegen-btn').addEventListener('click', () => {
    const typ = palette.getAusgewaehlt();
    aktiveTafel()?.addTile(typ.kind, typ.sign);
  });
  container.querySelector('.nullpaar-btn').addEventListener('click', () => {
    aktiveTafel()?.addZeroPair(palette.getAusgewaehlt().kind);
  });
  // Runde 22 Punkt 13: "Fläche leeren" stellt seither den GESAMTEN
  // Anfangszustand der Kette wieder her, nicht nur die Plättchen der aktiven
  // Seite: alle Zeilen außer der ersten verschwinden vollständig, die erste
  // Zeile wird auf beiden Seiten geleert, eine noch nicht angewendete
  // Warteschlange wird verworfen, und ein geöffnetes Malkreuz verschwindet
  // ebenfalls wieder komplett.
  container.querySelector('.leeren-btn').addEventListener('click', () => {
    for(const zeile of [...zeilen].reverse()){
      if(zeile===zeilen[0]) continue;
      zeile.wrapperEl.remove();
      zeilen.splice(zeilen.indexOf(zeile), 1);
    }
    const erste = zeilen[0];
    erste.links.clear();
    erste.rechts.clear();
    setzeAktiveSeite(erste, 'links');
    aktualisiereZeilenLoeschenButtons();
    warteschlange = [];
    zeigeHinweis('');
    aktualisiereWarteschlangeAnzeige();
    if(malkreuzGruppe){
      malkreuzGruppe = null;
      malkreuzHostEl.innerHTML = '';
      malkreuzHostEl.hidden = true;
      malkreuzToggleBtn.textContent = 'Malkreuz anzeigen';
      malkreuzToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Runde 24 (Punkt 13): Schieberegler -5..+5 unterhalb von "Fläche leeren" –
  // "Anwenden" ersetzte auf JEDER Zeile BEIDE Seiten durch den eingesetzten
  // Wert (setzeXWertEin). Runde 26 (Punkt 1, Nutzer-Rückmeldung: "Wenn man
  // den x-Wert einsetzt, soll zuerst eine neue Zeile entstehen, und nur in
  // der neuen Zeile soll der x-Wert eingesetzt werden"): statt JEDE
  // bestehende Zeile selbst zu überschreiben, entsteht für jede bestehende
  // Zeile zuerst eine neue Zeile UNMITTELBAR DARUNTER – exakt wie "+ Neue
  // Zeile darunter" (baueZeile mit `nachZeile`) – und der x-Wert wird DANACH
  // nur noch in dieser neuen Zeile eingesetzt (sync:false, da die neue Zeile
  // bereits für sich steht; die sonst übliche Spiegelung einzelner neu
  // hinzugefügter Plättchen auf andere Zeilen, siehe baueSeite, würde hier
  // nur stören). Die ursprünglichen Zeilen bleiben dadurch mit ihren
  // x/x²-Plättchen vollständig unverändert stehen. `quellZeilen` ist eine
  // Momentaufnahme VOR der Schleife, damit die neu erzeugten Zeilen selbst
  // nicht noch einmal durchlaufen werden.
  const gkXWertSlider = container.querySelector('.x-wert-slider');
  const gkXWertAnzeigeEl = container.querySelector('.x-wert-anzeige');
  gkXWertSlider.addEventListener('input', () => { gkXWertAnzeigeEl.textContent = gkXWertSlider.value; });
  container.querySelector('.x-wert-anwenden-btn').addEventListener('click', () => {
    const wert = Number(gkXWertSlider.value);
    const quellZeilen = [...zeilen];
    for(const zeile of quellZeilen){
      const linksVorherTiles = zeile.links.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign, stapel:t.stapel }));
      const rechtsVorherTiles = zeile.rechts.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign, stapel:t.stapel }));
      // Runde 25 (Punkt 9): der symbolische Term VOR dem Einsetzen wird
      // mitgegeben, damit die Gleichung danach weiterhin "mit x" betitelt
      // bleibt (siehe baueSeite/aktualisiereGesamt).
      const linksSymbolVorher = termAusBoard(linksVorherTiles);
      const rechtsSymbolVorher = termAusBoard(rechtsVorherTiles);
      const neueLinks = setzeXWertEin(linksVorherTiles, wert);
      const neueRechts = setzeXWertEin(rechtsVorherTiles, wert);
      const neueZeile = baueZeile(
        zeile.links.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign })),
        zeile.rechts.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign })),
        null,
        zeile,
      );
      neueZeile.links.ersetzeAlleTiles(neueLinks, { sync:false, einsetzInfo: { symbolVorher: linksSymbolVorher, wert } });
      neueZeile.rechts.ersetzeAlleTiles(neueRechts, { sync:false, einsetzInfo: { symbolVorher: rechtsSymbolVorher, wert } });
    }
  });

  const addierenEl = container.querySelector('.gleichungs-kette__umformung-addieren');
  const ADDIEREN_TYPEN = mitQuadrat
    ? [{kind:'x2',sign:1},{kind:'x2',sign:-1},{kind:'x',sign:1},{kind:'x',sign:-1},{kind:'zahl',sign:1},{kind:'zahl',sign:-1}]
    : [{kind:'x',sign:1},{kind:'x',sign:-1},{kind:'zahl',sign:1},{kind:'zahl',sign:-1}];
  for(const typ of ADDIEREN_TYPEN){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gk-addieren-btn';
    btn.textContent = formatiereOperation({ typ:'addieren', ...typ, anzahl:1 });
    btn.addEventListener('click', () => fuegeZurWarteschlangeHinzu({ typ:'addieren', ...typ, anzahl:1 }));
    addierenEl.appendChild(btn);
  }

  function liesFaktor(){
    const faktor = Math.round(Number(faktorInput.value));
    if(!Number.isInteger(faktor) || faktor<2 || faktor>GLEICHUNG_MAX_FAKTOR) return null;
    return faktor;
  }

  container.querySelector('.gk-mult-btn').addEventListener('click', () => {
    const faktor = liesFaktor();
    if(faktor===null){ zeigeHinweis(`Bitte eine ganze Zahl zwischen 2 und ${GLEICHUNG_MAX_FAKTOR} als Faktor wählen.`); return; }
    fuegeZurWarteschlangeHinzu({ typ:'multiplizieren', faktor });
  });
  container.querySelector('.gk-div-btn').addEventListener('click', () => {
    const faktor = liesFaktor();
    if(faktor===null){ zeigeHinweis(`Bitte eine ganze Zahl zwischen 2 und ${GLEICHUNG_MAX_FAKTOR} als Faktor wählen.`); return; }
    fuegeZurWarteschlangeHinzu({ typ:'dividieren', faktor });
  });
  // Runde 24 (Punkt 7): braucht keinen Faktor aus dem Eingabefeld – reiht
  // sich genauso in die Warteschlange ein wie Malnehmen/Teilen.
  container.querySelector('.gk-mal-minus-eins-btn').addEventListener('click', () => {
    fuegeZurWarteschlangeHinzu({ typ:'vorzeichenUmkehren' });
  });

  /* Runde 29 (Punkt 4, Nutzer-Rückmeldung: "Bei den Äquivalenzumformungen
     muss auch die Möglichkeit einer Wurzelumformung geben. Sie muss dann
     aber auch, wie bei den Erklärungen, 2 Lösungen anbieten"): wirkt NICHT
     über die Warteschlange (anders als Addieren/Malnehmen/Teilen/×(−1)), da
     das Ergebnis u. U. in ZWEI neue, unabhängige Zeilen verzweigt
     (Lösungsweg 1/2) statt in eine einzige – dasselbe Verzweigungsmuster wie
     bereits bei den geführten Erklärungen (planeGleichungsLoesung/
     planeQuadratischeErgaenzungGleichungLoesung, `zweige`). Voraussetzung:
     eine Seite der aktuellen (letzten) Zeile besteht nach
     `nettoKoeffizienten` AUSSCHLIESSLICH aus x² mit Koeffizient genau 1, die
     andere ausschließlich aus einer Zahl – andernfalls Fehlermeldung statt
     automatischer Vorbereitung (die Lernperson muss zuvor selbst mit den
     bestehenden Umformungen bis zu dieser Form gelangen). Runde 29 (Punkt 1,
     "nur ganzzahlige Lösungen"): eine negative Zahl oder eine Zahl ohne
     ganzzahlige Wurzel bricht mit Fehlermeldung ab, statt eine
     irrationale/keine Lösung anzuzeigen. */
  function wurzelZiehenAnwenden(){
    const letzte = zeilen[zeilen.length-1];
    const linksTiles = letzte.links.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign }));
    const rechtsTiles = letzte.rechts.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign }));
    const linksNetto = nettoKoeffizienten(linksTiles);
    const rechtsNetto = nettoKoeffizienten(rechtsTiles);
    const istReinesX2 = (netto) => netto.x2===1 && netto.x===0;
    const istReineZahl = (netto) => netto.x2===0 && netto.x===0;

    let xSeite = null, zahlWert = null;
    if(istReinesX2(linksNetto) && istReineZahl(rechtsNetto)){ xSeite='links'; zahlWert=rechtsNetto.zahl; }
    else if(istReinesX2(rechtsNetto) && istReineZahl(linksNetto)){ xSeite='rechts'; zahlWert=linksNetto.zahl; }
    else {
      zeigeHinweis('Wurzelziehen ist nur möglich, wenn auf einer Seite ausschließlich x² mit Faktor 1 und auf der anderen Seite ausschließlich eine Zahl steht. Forme zuerst mit den bestehenden Umformungen dorthin um.');
      return;
    }

    if(zahlWert<0){
      zeigeHinweis(`Keine Lösung: Eine negative Zahl (${zahlWert}) hat keine Quadratwurzel.`);
      return;
    }
    const wurzel = ganzzahligeWurzel(zahlWert);
    if(wurzel===null){
      zeigeHinweis(`${zahlWert} hat keine ganzzahlige Wurzel – in dieser Lernumgebung sind nur Lösungen mit ganzzahligem x vorgesehen.`);
      return;
    }
    zeigeHinweis('');

    function seitenTiles(xTiles, zahlTiles){
      return xSeite==='links' ? { links:xTiles, rechts:zahlTiles } : { links:zahlTiles, rechts:xTiles };
    }
    if(wurzel===0){
      const { links, rechts } = seitenTiles([{kind:'x', sign:1}], []);
      const neueZeile = baueZeile(links, rechts, { text:'Wurzel ziehen (x² = 0 → x = 0, einzige Lösung, da √0 = 0)', mehrere:false }, letzte);
      neueZeile.wrapperEl.scrollIntoView({ behavior:'smooth', block:'nearest' });
      return;
    }
    const weg1 = seitenTiles([{kind:'x', sign:1}], tilesAusKoeffizient(wurzel, 'zahl'));
    const weg2 = seitenTiles([{kind:'x', sign:1}], tilesAusKoeffizient(-wurzel, 'zahl'));
    const neueZeile1 = baueZeile(weg1.links, weg1.rechts, { text:`Wurzel ziehen – Lösungsweg 1: x = +√${zahlWert} = +${wurzel}`, mehrere:false }, letzte);
    const neueZeile2 = baueZeile(weg2.links, weg2.rechts, { text:`Wurzel ziehen – Lösungsweg 2: x = −√${zahlWert} = −${wurzel}`, mehrere:false }, neueZeile1);
    neueZeile2.wrapperEl.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
  container.querySelector('.gk-wurzel-btn').addEventListener('click', wurzelZiehenAnwenden);

  function zeigeHinweis(text){
    hinweisEl.textContent = text;
    hinweisEl.classList.toggle('gk-umformung-hinweis--fehler', Boolean(text));
  }

  // --- Runde 20 (Punkt 6a): Warteschlange statt Sofort-Anwendung ---
  let warteschlange = []; // { operation, label }

  function aktualisiereWarteschlangeAnzeige(){
    warteschlangeListeEl.innerHTML = '';
    warteschlange.forEach((eintrag, i) => {
      const li = document.createElement('li');
      li.className = 'gk-warteschlange__eintrag';
      const textEl = document.createElement('span');
      textEl.textContent = eintrag.label;
      li.appendChild(textEl);
      const entfernenBtn = document.createElement('button');
      entfernenBtn.type = 'button';
      entfernenBtn.className = 'gk-warteschlange__entfernen-btn';
      entfernenBtn.setAttribute('aria-label', `"${eintrag.label}" aus der Warteschlange entfernen`);
      entfernenBtn.textContent = '×';
      entfernenBtn.addEventListener('click', () => { warteschlange.splice(i,1); aktualisiereWarteschlangeAnzeige(); });
      li.appendChild(entfernenBtn);
      warteschlangeListeEl.appendChild(li);
    });
    warteschlangeHinweisEl.hidden = warteschlange.length>0;
    anwendenBtn.disabled = warteschlange.length===0;
  }

  /** Reiht eine Umformung in die Warteschlange ein, statt sie sofort anzuwenden. */
  function fuegeZurWarteschlangeHinzu(operation){
    warteschlange.push({ operation, label: formatiereOperation(operation) });
    zeigeHinweis('');
    aktualisiereWarteschlangeAnzeige();
  }

  /** Führt ALLE wartenden Umformungen nacheinander aus und erzeugt bei
      vollständigem Erfolg GENAU EINE neue Zeile mit dem kombinierten
      Endergebnis. Scheitert eine Umformung, bleibt die komplette
      Warteschlange zur Korrektur erhalten – es entsteht keine neue Zeile. */
  function jetztAnwenden(){
    if(warteschlange.length===0) return;
    const letzte = zeilen[zeilen.length-1];
    let linksTiles = letzte.links.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign }));
    let rechtsTiles = letzte.rechts.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign }));
    const angewandteLabels = [];
    for(const eintrag of warteschlange){
      const ergebnis = wendeAufBeideSeitenAn(linksTiles, rechtsTiles, eintrag.operation);
      if(ergebnis.fehler){
        zeigeHinweis(ergebnis.hinweis ?? `Die Umformung "${eintrag.label}" lässt sich auf die aktuelle Zeile nicht anwenden.`);
        return;
      }
      linksTiles = ergebnis.links;
      rechtsTiles = ergebnis.rechts;
      angewandteLabels.push(eintrag.label);
    }
    zeigeHinweis('');
    const neueZeile = baueZeile(linksTiles, rechtsTiles, { text: angewandteLabels.join(', '), mehrere: angewandteLabels.length>1 });
    neueZeile.wrapperEl.scrollIntoView({ behavior:'smooth', block:'nearest' });
    warteschlange = [];
    aktualisiereWarteschlangeAnzeige();
  }

  anwendenBtn.addEventListener('click', jetztAnwenden);
  aktualisiereWarteschlangeAnzeige();

  baueZeile(opts.initialLinks ?? [], opts.initialRechts ?? [], null);

  return { getZeilen: () => zeilen };
}
