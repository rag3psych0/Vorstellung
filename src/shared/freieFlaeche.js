import { setzeXWertEin } from '../engine/gleichungen.js';
import { erzeugeUndoSpeicher, termAusBoard } from '../engine/rechnen.js';
import { createAndockRasterUI, createMalkreuzGruppe } from './andockRaster.js';
import { createFreieTafel, verdrahteTermToggle } from './freieTafel.js';
import { createPalette } from './palette.js';

/* ============================================================
   Wiederverwendbarer Baustein: Auswahl + freie Fläche + Term-Anzeige
   (entspricht src/shared/freieFlaeche.js) – von "Terme" einmal, von
   "Gleichungen" zweimal (links/rechts) verwendet.
   ============================================================ */
/* Runde 24 (Punkt 13): fortlaufender Zähler für eindeutige id/for-Paare des
   x-Wert-Schiebereglers, da auf derselben Seite theoretisch mehrere
   erzeugeFreieFlaeche-Instanzen gleichzeitig existieren könnten. */
let xWertUiZaehler = 0;
// Aufsteigender Zähler als Funktion statt direkt exportierter `let`-Bindung
// gekapselt (Projekt-Aufteilung in Module, Runde 35): Eine importierte
// `let`-Bindung ist in ES-Modulen read-only für das importierende Modul,
// daher kann `erzeugeGleichungsKette` (shared/gleichungsKette.js) den
// Zähler nicht per `++xWertUiZaehler` selbst erhöhen – das übernimmt diese
// Funktion innerhalb des deklarierenden Moduls.
export function naechsteXWertUiId(){ return ++xWertUiZaehler; }
/**
 * Runde 17 (Nutzer-Rückmeldung Punkt 2): "+ Neue Zeile darunter" erzeugt auf
 * der freien Kästchenfläche keine unabhängige Folgefläche mehr, sondern eine
 * mit der bestehenden Fläche GESPIEGELTE zweite Fläche – getrennt durch
 * einen schwarzen Balken, mit denselben Plättchen vorbefüllt. Beliebig viele
 * weitere Flächen lassen sich so anhängen; ALLE Flächen der Gruppe bleiben
 * danach dauerhaft gegenseitig synchron. Es gibt bewusst nur EINE Auswahl
 * und EINEN "Rückgängig"-Knopf für die ganze Gruppe. Das optionale Malkreuz
 * ist von dieser Spiegelung bewusst AUSGENOMMEN (Nutzer-Antwort: nur die
 * freie Kästchenfläche) und hängt weiterhin als einzelnes Werkzeug an der
 * ERSTEN Fläche, seit Runde 17 direkt unterhalb von "+ Neue Zeile darunter"
 * positioniert; "Rückgängig" steht seit Runde 17 rechts neben der
 * Überschrift statt darunter.
 */
export function erzeugeFreieFlaeche(container, opts={}){
  const flaechenTitel = opts.flaechenTitel ?? 'Fläche';
  const xWertUiId = naechsteXWertUiId();
  container.classList.add('bearbeiten-layout');
  container.insertAdjacentHTML('beforeend', `
    <div class="palette-spalte">
      <h3>Auswahl</h3>
      <div class="palette"></div>
      <button type="button" class="hinzufuegen-btn">Plättchen hinzufügen</button>
      <button type="button" class="nullpaar-btn">Nullpaar erzeugen</button>
      <button type="button" class="leeren-btn">Fläche leeren</button>
      <div class="x-wert-einsetzen" role="group" aria-label="Konkreten x-Wert einsetzen">
        <label for="x-wert-slider-${xWertUiId}">x = <span class="x-wert-anzeige">0</span></label>
        <input type="range" id="x-wert-slider-${xWertUiId}" class="x-wert-slider" min="-5" max="5" step="1" value="0">
        <button type="button" class="x-wert-anwenden-btn">x-Wert einsetzen</button>
      </div>
    </div>
    <div class="tafel-spalte">
      <div class="freie-flaeche__kopf">
        <h3>${flaechenTitel}</h3>
        <div class="freie-flaeche__zoom" role="group" aria-label="Zoom der Bearbeitungsfläche">
          <button type="button" class="zoom-btn zoom-btn--raus" aria-label="Kästchen verkleinern" title="Kästchen verkleinern">−</button>
          <button type="button" class="zoom-btn zoom-btn--rein" aria-label="Kästchen vergrößern" title="Kästchen vergrößern">+</button>
        </div>
        <button type="button" class="rueckgaengig-btn" disabled>↶ Rückgängig</button>
      </div>
      <div class="freie-flaeche__liste"></div>
      <button type="button" class="term-toggle-btn">Term anzeigen</button>
      <div class="term-anzeige">
        <span class="term-anzeige__label">Dargestellter Term</span>
        <span class="term-anzeige__wert">0</span>
      </div>
    </div>
  `);

  const listeEl = container.querySelector('.freie-flaeche__liste');
  const termEl = container.querySelector('.term-anzeige__wert');
  const rueckgaengigBtn = container.querySelector('.rueckgaengig-btn');
  // Runde 24 (Punkt 12): EIN Zoom-Regler für die ganze Gruppe – wirkt beim
  // Klick auf jede gespiegelte Fläche der Gruppe gleichzeitig, damit alle
  // weiterhin gleich groß dargestellt bleiben.
  const zoomRausBtn = container.querySelector('.zoom-btn--raus');
  const zoomReinBtn = container.querySelector('.zoom-btn--rein');
  function aktualisiereZoomButtons(){
    if(gruppe.length===0) return;
    zoomRausBtn.disabled = !gruppe[0].tafel.kannHerauszoomen();
    zoomReinBtn.disabled = !gruppe[0].tafel.kannHineinzoomen();
  }
  zoomRausBtn.addEventListener('click', () => { for(const eintrag of gruppe) eintrag.tafel.zoomen(-1); aktualisiereZoomButtons(); });
  zoomReinBtn.addEventListener('click', () => { for(const eintrag of gruppe) eintrag.tafel.zoomen(1); aktualisiereZoomButtons(); });

  verdrahteTermToggle(container.querySelector('.term-toggle-btn'), container.querySelector('.term-anzeige'));

  // EIN gemeinsamer Undo-Speicher für die ganze Gruppe (alle gespiegelten
  // Flächen UND das optionale Malkreuz).
  const undo = erzeugeUndoSpeicher({ onChange: (n) => { rueckgaengigBtn.disabled = n===0; } });
  rueckgaengigBtn.addEventListener('click', () => undo.rueckgaengig());

  const gruppe = []; // { wrapperEl, tafelEl, hinweisEl, tafel, neueZeileBtn }
  let aktiverEintrag = null;
  let istAmSynchronisieren = false;
  // Runde 25 (Punkt 9, Nutzer-Rückmeldung: "selbst wenn man eine Zahl für x
  // eingesetzt hat, soll der dargestellte Term/Gleichung immernoch mit x
  // betitelt werden"): hält fest, mit welchem symbolischen Term (z.B.
  // "+x² +2x") und welchem x-Wert die AKTIVE Fläche zuletzt per "x-Wert
  // einsetzen" befüllt wurde – null, solange kein Einsetzen "frisch" ist.
  // Wird NUR vom "x-Wert einsetzen"-Knopf gesetzt und von JEDER anderen
  // Änderung der aktiven Fläche (Plättchen hinzufügen/entfernen/ziehen,
  // Rückgängig, Fläche leeren, …) automatisch wieder auf null gesetzt –
  // siehe onChange in baueEintrag, das `details?.einsetzInfo` durchreicht.
  let letzterEinsetzInfo = null;

  function markiereAktivenEintrag(){
    for(const eintrag of gruppe){ eintrag.wrapperEl.classList.toggle('freie-flaeche__eintrag--aktiv', eintrag===aktiverEintrag); }
  }
  function setzeAktiv(eintrag){
    if(aktiverEintrag===eintrag) return;
    aktiverEintrag = eintrag;
    // Ein Wechsel der aktiven Fläche macht den zuletzt eingesetzten x-Wert
    // nicht ungültig, aber "frisch eingesetzt" bezieht sich bewusst auf
    // genau die Fläche, bei der "x-Wert einsetzen" geklickt wurde – beim
    // Wechsel zeigt die Anzeige daher wieder den schlichten Term/die Zahl.
    letzterEinsetzInfo = null;
    markiereAktivenEintrag();
    // Runde 18 (Punkt 6): der Term bezieht sich seither auf die AKTIVE
    // Fläche statt fest auf die erste – ein bloßer Wechsel der aktiven
    // Fläche löst selbst kein onChange aus und muss die Anzeige deshalb hier
    // explizit auffrischen (sonst bliebe der Term der vorherigen Fläche
    // stehen).
    aktualisiereTermAnzeige();
  }

  // Überträgt die Plättchen von `quelle` (roh, ohne eigenen Undo-Eintrag) auf
  // alle übrigen Flächen der Gruppe. `istAmSynchronisieren` verhindert eine
  // Endlosschleife, da `render()` einer Zielfläche wiederum deren `onChange`
  // auslöst.
  function synchronisiereMitGruppe(quelle){
    if(istAmSynchronisieren) return;
    istAmSynchronisieren = true;
    try{
      // Runde 20: `stapel` (mehrere nebeneinander liegende Stapel derselben
      // Sorte, siehe createFreieTafel) muss mitgespiegelt werden.
      const kopie = quelle.tafel.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign, stapel:t.stapel ?? 0 }));
      for(const eintrag of gruppe){
        if(eintrag===quelle) continue;
        eintrag.tafel.board.clear();
        for(const t of kopie){
          const [neu] = eintrag.tafel.board.add(t.kind, t.sign, 1);
          neu.stapel = t.stapel;
        }
        eintrag.tafel.render();
      }
    } finally { istAmSynchronisieren = false; }
  }

  /* Runde 18 (Punkt 6): zeigt den Term DER AKTIVEN Fläche (nicht mehr fest
     der ersten) – Flächen können sich seither durch eine lokal gebliebene
     Nullpaar-Vereinfachung in ihrer rohen Plättchen-Anzahl unterscheiden. */
  function aktualisiereTermAnzeige(){
    const tiles = aktiverEintrag.tafel.board.tiles;
    const term = termAusBoard(tiles);
    // Runde 25 (Punkt 9): nach frischem "x-Wert einsetzen" bleibt der
    // URSPRÜNGLICHE, x-haltige Term als Titel stehen ("+x² +2x = 15 (für
    // x = 3)") statt nur noch die ausgerechnete Zahl zu zeigen – die
    // eigentlichen Plättchen sind (für Punkt 6) echte Zahl-Plättchen, nur
    // die TEXT-Anzeige hält den Bezug zu x fest.
    termEl.textContent = letzterEinsetzInfo
      ? `${letzterEinsetzInfo.symbolVorher} = ${term}  (für x = ${letzterEinsetzInfo.wert})`
      : term;
    opts.onChange?.(term, aktiverEintrag.tafel.board);
  }

  function baueEintrag(nachEintrag){
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'freie-flaeche__eintrag';
    if(nachEintrag){
      const trennerEl = document.createElement('div');
      trennerEl.className = 'freie-flaeche__trenner';
      wrapperEl.appendChild(trennerEl);
    }
    const tafelEl = document.createElement('div');
    tafelEl.className = 'freie-tafel';
    const hinweisEl = document.createElement('p');
    hinweisEl.className = 'freie-tafel__hinweis';
    hinweisEl.textContent = 'Noch keine Plättchen – über die Auswahl hinzufügen.';
    tafelEl.appendChild(hinweisEl);
    wrapperEl.appendChild(tafelEl);

    // Runde 22 Punkt 6: "Zeile löschen" steht LINKS neben "+ Neue Zeile
    // darunter" – beide in einem eigenen Reihen-Container, damit sie
    // nebeneinander statt untereinander erscheinen.
    const zeileAktionenEl = document.createElement('div');
    zeileAktionenEl.className = 'freie-flaeche__zeile-aktionen';
    wrapperEl.appendChild(zeileAktionenEl);

    const loeschenBtn = document.createElement('button');
    loeschenBtn.type = 'button';
    loeschenBtn.className = 'freie-flaeche__zeile-loeschen-btn';
    loeschenBtn.textContent = 'Zeile löschen';
    zeileAktionenEl.appendChild(loeschenBtn);

    const neueZeileBtn = document.createElement('button');
    neueZeileBtn.type = 'button';
    neueZeileBtn.className = 'freie-flaeche__neue-zeile-btn';
    neueZeileBtn.textContent = '+ Neue Zeile darunter';
    zeileAktionenEl.appendChild(neueZeileBtn);

    if(nachEintrag){ nachEintrag.wrapperEl.after(wrapperEl); } else { listeEl.appendChild(wrapperEl); }

    const eintrag = { wrapperEl, tafelEl, hinweisEl, neueZeileBtn, loeschenBtn, tafel:null };
    const tafel = createFreieTafel(tafelEl, {
      undo,
      // Runde 18 (Punkt 6): `details.sync===false` markiert eine reine
      // Nullpaar-Bildung/-Auflösung – die bleibt lokal auf DIESER Fläche,
      // die Gruppe wird dafür NICHT synchronisiert. Jede andere Änderung
      // (details.sync ist true oder fehlt) verhält sich wie gehabt.
      onChange(board, details){
        hinweisEl.style.display = board.tiles.length===0 ? '' : 'none';
        if(details?.sync !== false) synchronisiereMitGruppe(eintrag);
        // Runde 25 (Punkt 9): nur EIN frisches "x-Wert einsetzen" auf der
        // AKTIVEN Fläche setzt letzterEinsetzInfo – jede andere Änderung
        // dieser Fläche (details ohne einsetzInfo) setzt ihn automatisch
        // wieder auf null zurück, eine Änderung an einer ANDEREN Fläche der
        // Gruppe lässt ihn unangetastet.
        if(eintrag===aktiverEintrag) letzterEinsetzInfo = details?.einsetzInfo ?? null;
        aktualisiereTermAnzeige();
      },
    });
    eintrag.tafel = tafel;

    if(nachEintrag){
      const idx = gruppe.indexOf(nachEintrag);
      gruppe.splice(idx+1, 0, eintrag);
    } else { gruppe.push(eintrag); }

    // Aktivieren per Klick (Runde 17, Punkt 5). Capture-Phase, damit das
    // eigentliche Ziehen/Rechteck-Auswählen von freieTafel.js unverändert
    // funktioniert.
    wrapperEl.addEventListener('pointerdown', () => setzeAktiv(eintrag), { capture:true });

    neueZeileBtn.addEventListener('click', () => {
      const neuerEintrag = baueEintrag(eintrag);
      // Duplizieren (Punkt 4) ergibt sich allein daraus, dass jede Änderung
      // in der Gruppe auf alle übrigen Flächen übertragen wird –
      // `synchronisiereMitGruppe` rendert dabei jede ANDERE Fläche (auch die
      // gerade neu erzeugte) bereits selbst mit. Ein vorheriges eigenes
      // `render()` der noch leeren neuen Fläche würde über deren `onChange`
      // fälschlich eine Synchronisation AUSGEHEND von der leeren Fläche
      // auslösen und damit die Ursprungsfläche wieder leeren.
      synchronisiereMitGruppe(eintrag);
      setzeAktiv(neuerEintrag);
      aktualisiereLoeschenButtons();
    });

    loeschenBtn.addEventListener('click', () => {
      if(gruppe.length<=1) return;
      const idx = gruppe.indexOf(eintrag);
      // War dies die erste Fläche, verliert die neue erste ihren Trenner
      // (der Trenner gehört zur Fläche DANACH, nicht davor).
      if(idx===0) gruppe[1].wrapperEl.querySelector('.freie-flaeche__trenner')?.remove();
      const warAktiv = aktiverEintrag===eintrag;
      eintrag.wrapperEl.remove();
      gruppe.splice(idx, 1);
      if(warAktiv) setzeAktiv(gruppe[Math.max(0, idx-1)]);
      aktualisiereLoeschenButtons();
    });

    return eintrag;
  }

  /** Deaktiviert "Zeile löschen" auf ALLEN Flächen der Gruppe, solange nur eine einzige übrig ist. */
  function aktualisiereLoeschenButtons(){
    const gesperrt = gruppe.length<=1;
    for(const e of gruppe) e.loeschenBtn.disabled = gesperrt;
  }

  const ersterEintrag = baueEintrag(null);
  // Runde 18: `aktiverEintrag` muss VOR dem ersten render() gesetzt sein, da
  // aktualisiereTermAnzeige() (über onChange ausgelöst) seit Runde 18
  // (Punkt 6) von der aktiven statt immer von der ersten Fläche liest.
  setzeAktiv(ersterEintrag);
  ersterEintrag.tafel.render();
  aktualisiereLoeschenButtons();
  aktualisiereZoomButtons();

  // --- Malkreuz: NICHT gespiegeltes Werkzeug an der ersten Fläche ---
  // Runde 20 (Punkt 5) stellte Auslöser und Panel als unmittelbare Nachbarn
  // in der breiteren Tafel-Spalte zusammen. Runde 21 (Nutzer-Rückmeldung
  // Punkt 5) verlangt nun ausdrücklich eine dritte Position für den
  // AUSLÖSER: direkt unterhalb von "Nullpaar erzeugen" in der schmalen
  // Auswahl-Spalte. Das Malkreuz-Panel selbst bräuchte dort mehr
  // horizontale Breite, als die schmale Spalte hergibt (vgl.
  // .bearbeiten-layout) – es bleibt deshalb weiterhin in der breiteren
  // Tafel-Spalte, dort nun an deren Anfang (direkt nach dem Kopf-Bereich).
  const malkreuzToggleBtn = document.createElement('button');
  malkreuzToggleBtn.type = 'button';
  malkreuzToggleBtn.className = 'malkreuz-toggle-btn malkreuz-toggle-btn--klein';
  malkreuzToggleBtn.setAttribute('aria-expanded', 'false');
  malkreuzToggleBtn.textContent = 'Malkreuz anzeigen';
  const malkreuzHostEl = document.createElement('div');
  // Runde 22 Punkt 12: das Panel steht seither direkt im Anschluss an den
  // Knopf in der (dafür verbreiterten) Auswahl-Spalte, statt wie zuvor in der
  // breiten Tafel-Spalte – per `zoom` verkleinert dargestellt.
  malkreuzHostEl.className = 'malkreuz-host malkreuz-host--schmale-spalte';
  malkreuzHostEl.hidden = true;
  container.querySelector('.nullpaar-btn').after(malkreuzToggleBtn);
  malkreuzToggleBtn.after(malkreuzHostEl);

  // Runde 21 (Punkt 8/9): createMalkreuzGruppe statt eines einzelnen
  // createAndockRasterUI – verwaltet beliebig viele, untereinander
  // unabhängige Malkreuze samt je eigenem "Anwenden"-Knopf (siehe oben).
  // "Anwenden" überträgt die Produkt-Plättchen DIESES Malkreuzes auf die
  // AKTIVE Fläche der Gruppe – wie beim "Plättchen hinzufügen"-Knopf.
  let malkreuzGruppe = null;
  malkreuzToggleBtn.addEventListener('click', () => {
    const sichtbar = malkreuzHostEl.hidden;
    if(sichtbar && !malkreuzGruppe){
      malkreuzGruppe = createMalkreuzGruppe(malkreuzHostEl, {
        zeilenLabel: 'ein Faktor', spaltenLabel: 'anderer Faktor', undo,
        aufAnwenden(tiles){ aktiverEintrag.tafel.addTiles(tiles); },
      });
    }
    malkreuzHostEl.hidden = !sichtbar;
    malkreuzToggleBtn.textContent = sichtbar ? 'Malkreuz verbergen' : 'Malkreuz anzeigen';
    malkreuzToggleBtn.setAttribute('aria-expanded', String(sichtbar));
  });

  // Ziehen aus der Auswahl bleibt als schnelle Alternative zu den Knöpfen
  // möglich. Ist das Malkreuz eingeblendet, entscheidet zuerst der
  // Ablagepunkt, ob eine seiner Zonen/Zellen getroffen wurde; ansonsten
  // entscheidet der Ablagepunkt, auf welcher Fläche der Gruppe abgelegt
  // wurde.
  const palette = createPalette(container.querySelector('.palette'), {
    typen: opts.typen,
    onDrop(typ, punkt){
      if(malkreuzGruppe && !malkreuzHostEl.hidden && malkreuzGruppe.versucheAblegen(typ, punkt)) return;
      for(const eintrag of gruppe){
        const rect = eintrag.tafelEl.getBoundingClientRect();
        const innerhalb = punkt.clientX>=rect.left && punkt.clientX<=rect.right && punkt.clientY>=rect.top && punkt.clientY<=rect.bottom;
        if(!innerhalb) continue;
        setzeAktiv(eintrag);
        // Runde 20 (Punkt 2): Ablagepunkt relativ zur Tafel mitgeben, damit
        // createFreieTafel entscheiden kann, ob ein bestehender Stapel
        // fortgesetzt oder ein neuer, danebenliegender Stapel eröffnet wird.
        eintrag.tafel.addTile(typ.kind, typ.sign, { punktRelativ: { x: punkt.clientX-rect.left, y: punkt.clientY-rect.top } });
        return;
      }
    },
  });

  container.querySelector('.hinzufuegen-btn').addEventListener('click', () => {
    const typ = palette.getAusgewaehlt();
    aktiverEintrag.tafel.addTile(typ.kind, typ.sign);
  });
  container.querySelector('.nullpaar-btn').addEventListener('click', () => aktiverEintrag.tafel.addZeroPair(palette.getAusgewaehlt().kind));
  // Runde 22 Punkt 13: "Fläche leeren" stellt seither den GESAMTEN
  // Anfangszustand wieder her – zusätzlich verschwinden alle gespiegelten
  // Flächen außer der ersten sowie ein geöffnetes Malkreuz vollständig.
  container.querySelector('.leeren-btn').addEventListener('click', () => {
    aktiverEintrag.tafel.clear();
    for(const eintrag of [...gruppe].reverse()){
      if(eintrag===ersterEintrag) continue;
      eintrag.wrapperEl.remove();
      gruppe.splice(gruppe.indexOf(eintrag), 1);
    }
    setzeAktiv(ersterEintrag);
    aktualisiereLoeschenButtons();
    if(malkreuzGruppe){
      malkreuzGruppe = null;
      malkreuzHostEl.innerHTML = '';
      malkreuzHostEl.hidden = true;
      malkreuzToggleBtn.textContent = 'Malkreuz anzeigen';
      malkreuzToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Runde 24 (Punkt 13): Schieberegler -5..+5 unterhalb von "Fläche leeren" –
  // "Anwenden" ersetzt die AKTIVE Fläche durch den eingesetzten Wert
  // (setzeXWertEin); da alle Flächen der Gruppe stets wertgleich bleiben
  // sollen, bleibt sync bei seinem Default (true) – die normale
  // Gruppen-Spiegelung (synchronisiereMitGruppe) übernimmt den Rest.
  const xWertSlider = container.querySelector('.x-wert-slider');
  const xWertAnzeigeEl = container.querySelector('.x-wert-anzeige');
  xWertSlider.addEventListener('input', () => { xWertAnzeigeEl.textContent = xWertSlider.value; });
  container.querySelector('.x-wert-anwenden-btn').addEventListener('click', () => {
    const wert = Number(xWertSlider.value);
    const quellEintrag = aktiverEintrag;
    const vorherTiles = quellEintrag.tafel.board.tiles.map((t) => ({ kind:t.kind, sign:t.sign, stapel:t.stapel }));
    // Runde 25 (Punkt 9): den symbolischen (x-haltigen) Term VOR dem
    // Einsetzen festhalten – die Plättchen selbst werden gleich komplett
    // durch Zahl-Plättchen ersetzt, nur die Text-Anzeige soll ihn behalten.
    const symbolVorher = termAusBoard(vorherTiles);
    const neueTiles = setzeXWertEin(vorherTiles, wert);
    // Runde 26 (Punkt 1, Nutzer-Rückmeldung: "Wenn man den x-Wert einsetzt,
    // soll zuerst eine neue Zeile entstehen, und nur in der neuen Zeile soll
    // der x-Wert eingesetzt werden"): "x-Wert einsetzen" erzeugt seither
    // zuerst eine neue, mit der aktiven Fläche gespiegelte Fläche – exakt
    // wie "+ Neue Zeile darunter" (baueEintrag + synchronisiereMitGruppe) –
    // und setzt den x-Wert DANACH nur noch in dieser neuen Fläche ein
    // (sync:false, damit die Substitution nicht auf die übrige Gruppe und
    // damit auch nicht auf die ursprüngliche, x-haltige Fläche zurückwirkt).
    // Alle bereits bestehenden Flächen der Gruppe sind ohnehin stets
    // wertgleich (siehe synchronisiereMitGruppe) – es reicht daher, genau
    // EINE neue Fläche zu erzeugen statt für jede bestehende eine eigene.
    const neuerEintrag = baueEintrag(quellEintrag);
    synchronisiereMitGruppe(quellEintrag);
    setzeAktiv(neuerEintrag);
    neuerEintrag.tafel.ersetzeAlleTiles(neueTiles, { sync:false, einsetzInfo: { symbolVorher, wert } });
    aktualisiereLoeschenButtons();
  });

  if(opts.initialTiles?.length){
    ersterEintrag.tafel.addTiles(opts.initialTiles);
    undo.leeren();
  }

  return {
    tafel: {
      get board(){ return aktiverEintrag.tafel.board; },
      addTile: (...args) => aktiverEintrag.tafel.addTile(...args),
      addTiles: (...args) => aktiverEintrag.tafel.addTiles(...args),
      addZeroPair: (...args) => aktiverEintrag.tafel.addZeroPair(...args),
      clear: (...args) => aktiverEintrag.tafel.clear(...args),
      render: (...args) => aktiverEintrag.tafel.render(...args),
    },
    palette,
    getTerm: () => termAusBoard(aktiverEintrag.tafel.board.tiles),
    kopiereZustand: () => aktiverEintrag.tafel.board.tiles.map((t) => ({ kind: t.kind, sign: t.sign })),
  };
}

/**
 * "Zeilenkette" (Runde 15): vertikal gestapelte Liste gleichwertiger
 * Bearbeitungsflächen-Zeilen – siehe shared/zeilenkette.js im Repo für die
 * ausführliche Begründung. Jede Zeile trägt einen eigenen "+ Neue Zeile
 * darunter"-Button; ein Klick komprimiert die aktuelle Zeile (per CSS
 * transform:scale, das getBoundingClientRect()-basierte Trefferprüfungen
 * korrekt mitskaliert) und hängt eine neue, identisch aufgebaute Zeile an.
 */
export const ZEILENKETTE_KOMPAKT_FAKTOR = 0.55;
export function erzeugeZeilenkette(container, opts={}){
  const { mountZeile, neueZeileLabel = '+ Neue Zeile darunter' } = opts;
  container.innerHTML = '';
  container.classList.add('zeilenkette');
  const zeilen = [];

  function kompaktSchalten(eintrag){
    if(eintrag.kompakt) return;
    eintrag.kompakt = true;
    const rect = eintrag.inhaltEl.getBoundingClientRect();
    eintrag.inhaltEl.style.width = `${rect.width}px`;
    eintrag.inhaltEl.style.height = `${rect.height}px`;
    eintrag.rahmenEl.style.width = `${rect.width * ZEILENKETTE_KOMPAKT_FAKTOR}px`;
    eintrag.rahmenEl.style.height = `${rect.height * ZEILENKETTE_KOMPAKT_FAKTOR}px`;
    eintrag.el.classList.add('zeilenkette__zeile--kompakt');
  }

  function baueZeile(vorherigerZustand, istErste){
    const zeileEl = document.createElement('div');
    zeileEl.className = 'zeilenkette__zeile';
    if(!istErste){
      const gleichEl = document.createElement('span');
      gleichEl.className = 'zeilenkette__gleich';
      gleichEl.textContent = '=';
      gleichEl.setAttribute('aria-hidden', 'true');
      zeileEl.appendChild(gleichEl);
    }
    const rahmenEl = document.createElement('div');
    rahmenEl.className = 'zeilenkette__inhalt-rahmen';
    const inhaltEl = document.createElement('div');
    inhaltEl.className = 'zeilenkette__inhalt';
    rahmenEl.appendChild(inhaltEl);
    zeileEl.appendChild(rahmenEl);

    const toolbarEl = document.createElement('div');
    toolbarEl.className = 'zeilenkette__toolbar';
    const neueZeileBtn = document.createElement('button');
    neueZeileBtn.type = 'button';
    neueZeileBtn.className = 'zeilenkette__neue-zeile-btn';
    neueZeileBtn.textContent = neueZeileLabel;
    toolbarEl.appendChild(neueZeileBtn);
    zeileEl.appendChild(toolbarEl);

    container.appendChild(zeileEl);
    const api = mountZeile(inhaltEl, { istErste, vorherigerZustand: vorherigerZustand ?? null }) ?? {};
    const eintrag = { el: zeileEl, rahmenEl, inhaltEl, api, kompakt: false };

    neueZeileBtn.addEventListener('click', () => {
      kompaktSchalten(eintrag);
      const zustand = typeof api.kopiereZustand === 'function' ? api.kopiereZustand() : null;
      const neuerEintrag = baueZeile(zustand, false);
      zeileEl.after(neuerEintrag.el);
      const idx = zeilen.indexOf(eintrag);
      zeilen.splice(idx + 1, 0, neuerEintrag);
    });
    return eintrag;
  }

  const erste = baueZeile(null, true);
  zeilen.push(erste);
  return { getZeilen: () => zeilen.map((z) => z.api) };
}
