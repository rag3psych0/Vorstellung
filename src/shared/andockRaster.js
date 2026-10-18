import { berechneVorlaeufigeGitterGeometrie, bestimmeVorlaeufigeAusrichtung, bestimmeVorlaeufigenIndex, entferneLetzteSpalte, entferneLetzteZeile, erzeugeLeeresRaster, fuegeSpalteHinzu, fuegeZeileHinzu, konfliktMitAusstehenden, loeseAchsenArt, plaettchenAusRaster, rasterVollstaendig, spaltenBreite, zeilenHoehe, zellGeometrie, zellePasstZuKachel } from '../engine/multiplikationRaster.js';
import { mountUebungKM } from '../erklaerungen/klammern-multiplizieren.js';
import { erzeugeFreieFlaeche } from './freieFlaeche.js';
import { erzeugeGleichungsKette } from './gleichungsKette.js';
import { createPlaettchenElement } from './renderPlaettchen.js';
import { TILE_UNIT, tileDimensions } from './theme.js';

/* ============================================================
   Runde 13: gemeinsamer Baustein der "Andock-Geste" (entspricht
   .../shared/andockRaster.js) für "Klammern multiplizieren" UND
   "Division/Faktorisieren" – siehe README "Wie die Andock-Geste
   funktioniert". Ersetzt die frühere Klammer-Fach+Button-Lösung.
   ============================================================ */
export const ANDOCK_PAD = 10;
export function createAndockRasterUI(container, opts={}){
  const zeilenLabel = opts.zeilenLabel ?? 'ein Faktor';
  const spaltenLabel = opts.spaltenLabel ?? 'anderer Faktor';
  const GHOST = TILE_UNIT;
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <div class="malkreuz">
      <div class="malkreuz__linie malkreuz__linie--waagerecht"></div>
      <div class="malkreuz__linie malkreuz__linie--senkrecht"></div>
      <div class="malkreuz__mal">×</div>
      <span class="malkreuz__label malkreuz__label--unten-links">${zeilenLabel}</span>
      <span class="malkreuz__label malkreuz__label--oben-rechts">${spaltenLabel}</span>
      <div class="malkreuz__kette malkreuz__kette--unten-links"></div>
      <div class="malkreuz__kette malkreuz__kette--oben-rechts"></div>
      <div class="malkreuz__hitzone malkreuz__hitzone--unten-links" data-zone="zeilen"></div>
      <div class="malkreuz__hitzone malkreuz__hitzone--oben-rechts" data-zone="spalten"></div>
      <div class="malkreuz__hitzone malkreuz__hitzone--produkt" data-zone="produkt"></div>
      <p class="andock-raster__hinweis">Noch offen – ziehe Plättchen an die gestrichelten Platzhalter-Felder am Kreuz.</p>
      <div class="andock-raster" hidden></div>
      <div class="andock-raster__vormerkung" hidden></div>
    </div>
    <div class="andock-raster__ausstehend" hidden></div>
  `);
  const malkreuzEl = container.querySelector('.malkreuz');
  const waagerechtEl = container.querySelector('.malkreuz__linie--waagerecht');
  const senkrechtEl = container.querySelector('.malkreuz__linie--senkrecht');
  const malEl = container.querySelector('.malkreuz__mal');
  // Runde 25 (Punkt 2): zeilenKetteEl/zeilenHitEl = Faktor A, jetzt unten
  // links; spaltenKetteEl/spaltenHitEl = Faktor B, jetzt oben rechts (vormals
  // umgekehrt – siehe Kommentar oben bei .malkreuz).
  const zeilenKetteEl = container.querySelector('.malkreuz__kette--unten-links');
  const spaltenKetteEl = container.querySelector('.malkreuz__kette--oben-rechts');
  const zeilenHitEl = container.querySelector('.malkreuz__hitzone--unten-links');
  const spaltenHitEl = container.querySelector('.malkreuz__hitzone--oben-rechts');
  // Runde 24 (Punkt 3): Trefferzone über dem (bis zur ersten Befüllung noch
  // leeren bzw. unsichtbaren) Produktfeld-Quadranten – ermöglicht, dort
  // schon VOR jeder Achse ein Plättchen abzulegen (siehe
  // versucheErstbefuellung weiter unten).
  const produktHitEl = container.querySelector('.malkreuz__hitzone--produkt');
  const hinweisEl = container.querySelector('.andock-raster__hinweis');
  const ausstehendEl = container.querySelector('.andock-raster__ausstehend');
  const rasterEl = container.querySelector('.andock-raster');
  // Runde 31 (Nutzer-Rückmeldung: "Kannst du mich es auch direkt in das
  // Produktfeld reinlegen lassen ohne dass es bisher die Faktoren gibt und
  // ich baue dann die richtigen Faktoren selbst auf? Im Moment legst du es
  // beiseite..."): zeigt ausstehende Produktfeld-Plättchen, solange NOCH
  // KEINE Achse existiert, direkt IM Produktfeld-Quadranten selbst (gleiche
  // Fläche, auf der später das Raster erscheint) statt in einem separaten
  // Bereich unterhalb des Malkreuzes. Siehe renderRaster weiter unten.
  const vormerkungEl = container.querySelector('.andock-raster__vormerkung');

  /* Runde 23 (Nutzer-Rückmeldung: "Mache das Innere des Malkreuzes größer
     sodass sie bis zur Umrandung geht"): liefert die tatsächlich verfügbare
     Innenbreite von `container` bis zu dessen eigenem Rand/Innenabstand. */
  function verfuegbareInnenbreite(){
    if(!container.clientWidth) return 0;
    const stil = window.getComputedStyle(container);
    const polster = (parseFloat(stil.paddingLeft)||0) + (parseFloat(stil.paddingRight)||0);
    return Math.max(0, container.clientWidth - polster);
  }

  let raster = erzeugeLeeresRaster();
  let naechsteZellId = 0;
  const zellTiles = new Map();
  // Runde 30 (Punkt 3, Nutzer-Rückmeldung: "Jetzt kann ich das Produktfeld
  // gar nicht mehr als erstes ausfüllen! Ich will das Produktfeld ausfüllen
  // dürfen! Du sollst mich aber die passenden Faktoren dafür selbst
  // ausfüllen lassen und nicht automatisiert!"): Plättchen, die im
  // Produktfeld abgelegt wurden, BEVOR beide Achsen existieren – warten hier
  // auf die passenden Faktoren, statt (wie bis Runde 29) abgelehnt oder (wie
  // bis Runde 28) automatisch mit einer geratenen Vorzeichen-Zerlegung in
  // eine Zelle verwandelt zu werden. Siehe versucheErstbefuellung und
  // verbrauchePendingFuerZellen weiter unten.
  let ausstehendeProdukte = [];

  /* Runde 16 ("Rückgängig button" / Herausziehen): Momentaufnahme des
     GESAMTEN internen Zustands bzw. deren Wiederherstellung. */
  function tiefeKopie(wert){ return typeof structuredClone==='function' ? structuredClone(wert) : JSON.parse(JSON.stringify(wert)); }
  function zustandKlonen(){
    return { raster: tiefeKopie(raster), zellTiles: new Map(zellTiles), naechsteZellId, ausstehendeProdukte: tiefeKopie(ausstehendeProdukte) };
  }
  function stelleZustandWieder(zustand){
    raster = zustand.raster;
    zellTiles.clear();
    for(const [k,v] of zustand.zellTiles) zellTiles.set(k,v);
    naechsteZellId = zustand.naechsteZellId;
    ausstehendeProdukte = zustand.ausstehendeProdukte ?? [];
    render();
  }
  function mitUndo(aktion){
    if(!opts.undo){ aktion(); return; }
    const vorher = zustandKlonen();
    aktion();
    opts.undo.aufzeichnen(() => stelleZustandWieder(vorher));
  }

  function berechneLayout(){
    const spaltenBreiten = raster.spalten.map((s) => spaltenBreite(s.kind));
    const zeilenHoehen = raster.zeilen.map((z) => zeilenHoehe(z.kind));
    const spaltenSumme = spaltenBreiten.reduce((a,b) => a+b, 0);
    const zeilenSumme = zeilenHoehen.reduce((a,b) => a+b, 0);

    // Runde 25 (Punkt 2): Spalte 1 (links, fest) bleibt Faktor A; Zeile OBEN
    // ist jetzt die FESTE (Malzeichen + Faktor B), Zeile UNTEN die VARIABLE
    // (Faktor A + Produkt) – vertikal gespiegelt gegenüber Runde 13-24.
    const col1Breite = TILE_UNIT + ANDOCK_PAD*2;
    const rowObenHoehe = TILE_UNIT + ANDOCK_PAD*2;
    const col2BreiteInhalt = Math.max(spaltenSumme + GHOST + ANDOCK_PAD*2, 190);
    const rowUntenHoehe = Math.max(zeilenSumme + GHOST + ANDOCK_PAD*2, 170);
    // Runde 23: Spalte 2 füllt zusätzlich die verfügbare Breite der
    // Umrandung; der Inhaltswert bleibt Untergrenze (schmale/eingezoomte
    // Auswahl-Spalte).
    const verfuegbareBreite = verfuegbareInnenbreite();
    const col2Breite = verfuegbareBreite > 0
      ? Math.max(col2BreiteInhalt, verfuegbareBreite - col1Breite)
      : col2BreiteInhalt;

    const cx = col1Breite, cy = rowObenHoehe;

    // Spalten-Kette (Faktor B) wächst ab der Kreuzlinie nach RECHTS (oben).
    const colLefts = []; let x = cx + ANDOCK_PAD;
    for(const b of spaltenBreiten){ colLefts.push(x); x += b; }
    const spaltenGhostLeft = x;

    // Zeilen-Kette (Faktor A) wächst ab der Kreuzlinie nach UNTEN (links).
    const rowTops = []; let laufendeHoehe = 0;
    for(const h of zeilenHoehen){ rowTops.push(cy + ANDOCK_PAD + laufendeHoehe); laufendeHoehe += h; }
    const zeilenGhostTop = cy + ANDOCK_PAD + zeilenSumme;

    const breite = col1Breite+col2Breite, hoehe = rowObenHoehe+rowUntenHoehe;
    // Runde 23: Skalierung nur, wenn selbst die inhaltsbasierte
    // Mindestbreite nicht in die verfügbare Breite passt – ersetzt den
    // vormals fest codierten zoom:0.6 auf dem gesamten Host (der auch die
    // Bedienknöpfe mit verkleinerte). Wird unten NUR auf .malkreuz selbst
    // angewendet.
    const skalierung = verfuegbareBreite > 0 ? Math.min(1, verfuegbareBreite / breite) : 1;

    return {
      breite, hoehe, skalierung,
      cx, cy, col1Breite, col2Breite, rowObenHoehe, rowUntenHoehe,
      colLefts, rowTops, spaltenGhostLeft, zeilenGhostTop,
    };
  }

  function renderKreuz(layout){
    malkreuzEl.style.width = `${layout.breite}px`;
    malkreuzEl.style.height = `${layout.hoehe}px`;
    malkreuzEl.style.zoom = layout.skalierung;
    waagerechtEl.style.top = `${layout.cy}px`;
    waagerechtEl.style.width = `${layout.breite}px`;
    senkrechtEl.style.left = `${layout.cx}px`;
    senkrechtEl.style.height = `${layout.hoehe}px`;
    // Runde 25 (Punkt 2): Malzeichen jetzt oben links.
    malEl.style.left = `${layout.cx/2}px`;
    malEl.style.top = `${layout.cy/2}px`;

    // Faktor A (Zeilen-Kette) – jetzt UNTEN LINKS, wächst ab der Kreuzlinie nach unten.
    // Runde 43 (Nutzer-Rückmeldung bei der quadratischen Ergänzung: "Lasse
    // die Faktordarstellung weg z.B. (x+3). Die Faktorplättchen [...] sollen
    // erst dann platziert werden, wenn das Produkt als Quadrat gelegt
    // wurde."): eine neue, standardmäßig immer wahre Option
    // `achsenPlaettchenSichtbar()` steuert, ob die Achsen-Plättchen (Faktor-
    // Plättchen) überhaupt sichtbar gerendert werden – die zugrunde liegende
    // Geometrie (`raster.zeilen`/`raster.spalten`, `berechneLayout()`) bleibt
    // davon unberührt, sodass das Produktfeld unabhängig von der Achsen-
    // Sichtbarkeit immer an derselben Stelle und in derselben Größe steht.
    // Andere Aufrufer (Klammern multiplizieren, freie Malkreuze) übergeben
    // diese Option nicht und sehen dadurch unverändert immer die Achsen.
    const achsenSichtbar = opts.achsenPlaettchenSichtbar?.() ?? true;
    zeilenKetteEl.innerHTML = '';
    if(achsenSichtbar){
      raster.zeilen.forEach((zeile, i) => {
        const el = createPlaettchenElement(zeile.kind, zeile.sign, {scale:1, zeigeWert:true, vertical:true});
        el.classList.add('malkreuz__kachel');
        el.style.left = `${layout.cx - ANDOCK_PAD - TILE_UNIT}px`;
        el.style.top = `${layout.rowTops[i]}px`;
        // Runde 16: nur das LETZTE Kettenglied lässt sich herausziehen (LIFO), nur wenn nicht gesperrt.
        if(i===raster.zeilen.length-1 && !opts.zeilenGesperrt?.()){
          el.classList.add('malkreuz__kachel--ziehbar');
          el.style.touchAction = 'none';
          el.addEventListener('pointerdown', (event) => starteKettenTeilDrag(event, 'zeilen'));
        }
        zeilenKetteEl.appendChild(el);
      });
      const zeilenGhost = document.createElement('div');
      zeilenGhost.className = 'malkreuz__ghost malkreuz__ghost--unten-links';
      zeilenGhost.style.left = `${layout.cx - ANDOCK_PAD - TILE_UNIT}px`;
      zeilenGhost.style.top = `${layout.zeilenGhostTop}px`;
      zeilenGhost.style.width = `${TILE_UNIT}px`;
      zeilenGhost.style.height = `${GHOST}px`;
      zeilenKetteEl.appendChild(zeilenGhost);
    }

    // Runde 15: volle Quadranten-Trefferzone statt eines TILE_UNIT-Streifens
    // (siehe andockRaster.js im Repo für die ausführliche Begründung).
    zeilenHitEl.style.left = '0px';
    zeilenHitEl.style.top = `${layout.cy}px`;
    zeilenHitEl.style.width = `${layout.cx}px`;
    zeilenHitEl.style.height = `${layout.hoehe - layout.cy}px`;

    // Faktor B (Spalten-Kette) – jetzt OBEN RECHTS, wächst ab der Kreuzlinie nach rechts.
    spaltenKetteEl.innerHTML = '';
    if(achsenSichtbar){
      raster.spalten.forEach((spalte, j) => {
        const el = createPlaettchenElement(spalte.kind, spalte.sign, {scale:1, zeigeWert:true, vertical:false});
        el.classList.add('malkreuz__kachel');
        el.style.left = `${layout.colLefts[j]}px`;
        el.style.top = `${ANDOCK_PAD}px`;
        if(j===raster.spalten.length-1 && !opts.spaltenGesperrt?.()){
          el.classList.add('malkreuz__kachel--ziehbar');
          el.style.touchAction = 'none';
          el.addEventListener('pointerdown', (event) => starteKettenTeilDrag(event, 'spalten'));
        }
        spaltenKetteEl.appendChild(el);
      });
      const spaltenGhost = document.createElement('div');
      spaltenGhost.className = 'malkreuz__ghost malkreuz__ghost--oben-rechts';
      spaltenGhost.style.left = `${layout.spaltenGhostLeft}px`;
      spaltenGhost.style.top = `${ANDOCK_PAD}px`;
      spaltenGhost.style.width = `${GHOST}px`;
      spaltenGhost.style.height = `${TILE_UNIT}px`;
      spaltenKetteEl.appendChild(spaltenGhost);
    }

    spaltenHitEl.style.left = `${layout.cx}px`;
    spaltenHitEl.style.top = '0px';
    spaltenHitEl.style.width = `${layout.breite - layout.cx}px`;
    spaltenHitEl.style.height = `${layout.cy}px`;

    // Runde 24 (Punkt 3), Runde 25 (Punkt 2): derselbe Quadrant, in dem
    // später das Produkt-Raster erscheint (jetzt unten rechts) – unabhängig
    // davon, ob schon eine Zelle existiert.
    produktHitEl.style.left = `${layout.cx}px`;
    produktHitEl.style.top = `${layout.cy}px`;
    produktHitEl.style.width = `${layout.breite - layout.cx}px`;
    produktHitEl.style.height = `${layout.hoehe - layout.cy}px`;
  }

  function renderRaster(layout){
    const offen = raster.zeilen.length>0 && raster.spalten.length>0;
    // Runde 33 (Nutzer-Rückmeldung: "Ich kann dem Malkreuz Produktkärtchen
    // hinzufügen, genauso wie ich Faktorkärtchen hinzufügen kann. Sie
    // springen auf ein passendes Feld und ich muss am Ende die Passenden
    // Faktorkärtchen hinzufügen."): ersetzt die Runde-30/31/32-Vormerkungs-
    // Mechanismen vollständig. Ein ohne Achsen abgelegtes Produktfeld-
    // Plättchen bekommt beim Ablegen einen festen (vorläufigen) Zeilen-/
    // Spalten-Index im Datenfeld selbst (siehe versucheErstbefuellung) und
    // wird hier GENAU an dieser Gitterposition gerendert – als normal
    // aussehendes Plättchen, direkt im Produktfeld-Quadranten (vormerkungEl)
    // und bewusst UNABHÄNGIG davon, ob inzwischen schon eine oder beide
    // echten Achsen stehen: Jede neu entstehende echte Zeile/Spalte
    // "verbraucht" (siehe verbrauchePendingFuerZellen) nur die vorläufigen
    // Einträge, deren Index tatsächlich in ihren Bereich fällt – alle
    // anderen bleiben unverändert an ihrer vorläufigen Gitterposition
    // sichtbar, bis auch sie erreicht werden. Passt ein inzwischen
    // erreichter Eintrag NICHT zur tatsächlich gelegten Achsen-Kombination
    // (Art/Vorzeichen stimmen nicht), wird er als `mismatch` markiert und
    // wandert in den separaten Bereich unterhalb des Malkreuzes
    // (ausstehendEl) – dort kann er nie mehr verbraucht werden, bleibt aber
    // sichtbar, statt kommentarlos zu verschwinden.
    const vorlaeufig = ausstehendeProdukte.filter((p) => !p.mismatch);
    const mismatchEintraege = ausstehendeProdukte.filter((p) => p.mismatch);

    hinweisEl.hidden = offen || vorlaeufig.length>0;
    hinweisEl.style.left = `${layout.cx + ANDOCK_PAD}px`;
    hinweisEl.style.top = `${layout.cy + ANDOCK_PAD}px`;

    vormerkungEl.hidden = vorlaeufig.length===0;
    vormerkungEl.innerHTML = '';
    if(vorlaeufig.length>0){
      vormerkungEl.style.left = `${layout.cx}px`;
      vormerkungEl.style.top = `${layout.cy}px`;
      vormerkungEl.style.width = `${layout.breite - layout.cx}px`;
      vormerkungEl.style.height = `${layout.hoehe - layout.cy}px`;
      const geom = berechneVorlaeufigeGitterGeometrie(ausstehendeProdukte, raster);
      for(const p of vorlaeufig){
        // Runde 34: Ausrichtung (stehend/liegend) eines x-Produktplättchens
        // wird hier aus bereits vorhandener Information abgeleitet (siehe
        // bestimmeVorlaeufigeAusrichtung) statt stets liegend zu rendern.
        const vertical = bestimmeVorlaeufigeAusrichtung(p, ausstehendeProdukte, raster);
        const el = createPlaettchenElement(p.kind, p.sign, { scale:1, zeigeWert:true, vertical });
        el.classList.add('andock-raster__vormerkung-kachel');
        el.style.left = `${ANDOCK_PAD + geom.spaltenLeftArr[p.spalte]}px`;
        el.style.top = `${ANDOCK_PAD + geom.zeilenTopArr[p.zeile]}px`;
        vormerkungEl.appendChild(el);
      }
    }

    // Bereich unterhalb des Malkreuzes: ausschließlich für Einträge, die
    // inzwischen eine echte Zeile UND Spalte erreicht haben, deren Art/
    // Vorzeichen aber nicht zur dort tatsächlich gelegten Achsen-Kombination
    // passt (siehe verbrauchePendingFuerZellen) – kann nie mehr verbraucht
    // werden, soll aber nicht kommentarlos verschwinden.
    ausstehendEl.hidden = mismatchEintraege.length===0;
    ausstehendEl.innerHTML = '';
    if(mismatchEintraege.length>0){
      const hinweisP = document.createElement('p');
      hinweisP.className = 'andock-raster__ausstehend-hinweis';
      hinweisP.textContent = mismatchEintraege.length===1
        ? 'Ein vorläufig platziertes Plättchen passt nicht zu den inzwischen gelegten Faktoren und bleibt offen.'
        : `${mismatchEintraege.length} vorläufig platzierte Plättchen passen nicht zu den inzwischen gelegten Faktoren und bleiben offen.`;
      ausstehendEl.appendChild(hinweisP);
      const reiheEl = document.createElement('div');
      reiheEl.className = 'andock-raster__ausstehend-reihe';
      for(const p of mismatchEintraege){
        const el = createPlaettchenElement(p.kind, p.sign, { scale:1, zeigeWert:true });
        el.classList.add('andock-raster__ausstehend-kachel');
        reiheEl.appendChild(el);
      }
      ausstehendEl.appendChild(reiheEl);
    }
    rasterEl.hidden = !offen;
    rasterEl.innerHTML = '';
    if(!offen) return;
    // Runde 25 (Punkt 2): Produkt-Raster jetzt unten rechts (statt oben
    // rechts) – rasterEl beginnt daher erst ab der Kreuzlinie cy, und die
    // Zell-Positionen werden relativ dazu (rowTops[i]-cy) gesetzt.
    rasterEl.style.left = `${layout.cx}px`;
    rasterEl.style.top = `${layout.cy}px`;
    rasterEl.style.width = `${layout.col2Breite - GHOST - ANDOCK_PAD}px`;
    rasterEl.style.height = `${layout.rowUntenHoehe - ANDOCK_PAD}px`;
    raster.zellen.forEach((reihe, i) => {
      reihe.forEach((zelle, j) => {
        const geometrie = zellGeometrie(raster.zeilen[i].kind, raster.spalten[j].kind);
        const left = layout.colLefts[j] - layout.cx, top = layout.rowTops[i] - layout.cy;
        if(zelle.gefuellt){
          const el = createPlaettchenElement(zelle.erwarteteArt, zelle.erwartetesVorzeichen, {
            vertical: geometrie.vertical, id: zellTiles.get(`${i},${j}`), zeigeWert:true,
          });
          el.style.position = 'absolute'; el.style.left = `${left}px`; el.style.top = `${top}px`;
          rasterEl.appendChild(el);
        } else {
          const platzhalter = document.createElement('div');
          platzhalter.className = 'mult-zelle mult-zelle--leer';
          platzhalter.dataset.zeile = String(i);
          platzhalter.dataset.spalte = String(j);
          platzhalter.style.left = `${left}px`;
          platzhalter.style.top = `${top}px`;
          platzhalter.style.width = `${geometrie.w}px`;
          platzhalter.style.height = `${geometrie.h}px`;
          rasterEl.appendChild(platzhalter);
        }
      });
    });
  }

  function render(meldeOnChange=true){
    const layout = berechneLayout();
    renderKreuz(layout);
    renderRaster(layout);
    if(meldeOnChange) opts.onChange?.(raster);
  }
  render(false);

  // Runde 23: fängt sowohl anfangs unsichtbar angelegte Container (z. B.
  // hinter einem "anzeigen"-Knopf, `clientWidth` beim Erst-Rendering noch 0)
  // als auch spätere Größenänderungen der Umrandung ab.
  if(typeof ResizeObserver === 'function'){
    const groessenBeobachter = new ResizeObserver(() => render(false));
    groessenBeobachter.observe(container);
  }

  function punktInRect(rectEl, punkt){
    const rect = rectEl.getBoundingClientRect();
    return punkt.clientX>=rect.left && punkt.clientX<=rect.right && punkt.clientY>=rect.top && punkt.clientY<=rect.bottom;
  }
  function kurzeFehlermarkierung(zoneEl){
    zoneEl.classList.add('malkreuz__hitzone--fehler');
    window.setTimeout(() => zoneEl.classList.remove('malkreuz__hitzone--fehler'), 500);
  }

  /* Runde 16: zieht das jeweils letzte Ketten-Plättchen; beim Loslassen
     AUSSERHALB des gesamten Malkreuz-Elements wird es entfernt (LIFO). */
  function starteKettenTeilDrag(event, achse){
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget;
    const startLeft = parseFloat(el.style.left), startTop = parseFloat(el.style.top);
    const startX = event.clientX, startY = event.clientY;
    el.classList.add('malkreuz__kachel--dragging');
    function onMove(moveEvent){
      el.style.left = `${startLeft + (moveEvent.clientX-startX)}px`;
      el.style.top = `${startTop + (moveEvent.clientY-startY)}px`;
    }
    function onUp(upEvent){
      window.removeEventListener('pointermove', onMove);
      const rect = malkreuzEl.getBoundingClientRect();
      const ausserhalb = upEvent.clientX<rect.left || upEvent.clientX>rect.right || upEvent.clientY<rect.top || upEvent.clientY>rect.bottom;
      if(ausserhalb){
        mitUndo(() => { if(achse==='zeilen') entferneLetzteZeile(raster); else entferneLetzteSpalte(raster); });
      }
      render();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once:true });
  }

  /* Runde 25 (Punkt 8): füllt – wie die Batch-Füllung in versucheZelleFuellen
     – ALLE noch offenen Zellen, deren Art+Vorzeichen zu `typ` passen. Eigene
     Funktion, da sowohl versucheZelleFuellen als auch versucheRasterErweitern
     (neue Zeile/Spalte + sofortiges Füllen) sie brauchen. */
  function fuelleAllePassendenZellen(typ){
    for(const reihe of raster.zellen){
      for(const z of reihe){
        if(z.gefuellt) continue;
        if(z.erwarteteArt!==typ.kind || z.erwartetesVorzeichen!==typ.sign) continue;
        z.gefuellt = true;
        naechsteZellId += 1;
        zellTiles.set(`${z.zeile},${z.spalte}`, `andock-zelle-${naechsteZellId}`);
      }
    }
  }

  /* Runde 30 (Punkt 3), neu gefasst in Runde 33: sobald eine neue Zeile ODER
     Spalte entsteht (von der Lernperson SELBST über die Zeilen-/Spalten-Zone
     angelegt, siehe zeileHinzufuegen/spalteHinzufuegen), prüft diese Funktion
     die dadurch neu entstandenen Zellen gegen die Liste der noch
     „vorläufigen" Produktfeld-Plättchen (siehe versucheErstbefuellung) –
     seit Runde 33 nicht mehr nach Art+Vorzeichen (irgendein passender
     Eintrag), sondern GENAU nach der vorläufigen Gitterposition (Zeile UND
     Spalte-Index), die die Lernperson beim Ablegen selbst gewählt hat: Nur
     ein Eintrag an EXAKT dieser Position kann diese Zelle verbrauchen. Passt
     die Art/das Vorzeichen des dort liegenden Eintrags zur tatsächlich
     gelegten Achsen-Kombination, wird er verbraucht und die Zelle gefüllt;
     passt er nicht, kann er nie mehr verbraucht werden (diese Gitterposition
     ist nun endgültig anders belegt) und wird dauerhaft als `mismatch`
     markiert, statt weiter als vorläufig zu gelten. Anders als
     fuelleAllePassendenZellen wird hier NICHTS aus einem einzelnen Typ
     abgeleitet oder geraten: die Faktoren (Zeile UND Spalte) hat die
     Lernperson in jedem Fall bereits selbst gelegt. */
  function verbrauchePendingFuerZellen(zellen){
    for(const zelle of zellen){
      if(!zelle || zelle.gefuellt) continue;
      const eintrag = ausstehendeProdukte.find((p) => !p.mismatch && p.zeile===zelle.zeile && p.spalte===zelle.spalte);
      if(!eintrag) continue;
      if(eintrag.kind===zelle.erwarteteArt && eintrag.sign===zelle.erwartetesVorzeichen){
        ausstehendeProdukte.splice(ausstehendeProdukte.indexOf(eintrag), 1);
        zelle.gefuellt = true;
        naechsteZellId += 1;
        zellTiles.set(`${zelle.zeile},${zelle.spalte}`, `andock-zelle-${naechsteZellId}`);
      } else {
        eintrag.mismatch = true;
      }
    }
  }

  /* Runde 25 (Punkt 8): Treffer im leeren Rand des bereits offenen
     Produktfeldes (unterhalb der letzten Zeile bzw. rechts der letzten
     Spalte) dockt automatisch eine neue, zu `typ` passende Zeile ODER
     Spalte an – abgeleitet aus einer der bestehenden Achsen derselben Art
     via loeseAchsenArt – und füllt sofort alle dazu passenden Zellen.
     Liefert `false`, wenn der Punkt weder unterhalb noch rechts des
     bestehenden Rasters liegt, oder keine bestehende Achse eine gültige
     Zerlegung erlaubt (z. B. x² ohne jede x-Achse). */
  function versucheRasterErweitern(typ, punkt){
    const layout = berechneLayout();
    const rasterRect = rasterEl.getBoundingClientRect();
    if(!rasterRect.width || !rasterRect.height) return false;
    const skalierung = layout.skalierung || 1;
    const localX = (punkt.clientX - rasterRect.left) / skalierung;
    const localY = (punkt.clientY - rasterRect.top) / skalierung;
    if(localX<0 || localY<0) return false;

    const letzteSpalte = raster.spalten[raster.spalten.length-1];
    const letzteZeile = raster.zeilen[raster.zeilen.length-1];
    const spaltenRand = (layout.colLefts[layout.colLefts.length-1] - layout.cx) + spaltenBreite(letzteSpalte.kind);
    const zeilenRand = (layout.rowTops[layout.rowTops.length-1] - layout.cy) + zeilenHoehe(letzteZeile.kind);
    const unterhalbRaster = localY > zeilenRand;
    const rechtsVomRaster = localX > spaltenRand;
    if(!unterhalbRaster && !rechtsVomRaster) return false;
    // Liegt der Punkt in BEIDEN Rand-Streifen (diagonal unten-rechts von der
    // letzten Zelle), entscheidet, welcher Abstand kleiner ist – näher dran
    // gewinnt.
    const alsNeueZeile = unterhalbRaster && (!rechtsVomRaster || (localY-zeilenRand) <= (localX-spaltenRand));

    if(alsNeueZeile){
      for(const spalte of raster.spalten){
        const zeilenKind = loeseAchsenArt(typ.kind, spalte.kind);
        if(!zeilenKind) continue;
        if(opts.zeilenGesperrt?.()){ kurzeFehlermarkierung(zeilenHitEl); return false; }
        const zeilenSign = typ.sign * spalte.sign;
        mitUndo(() => {
          fuegeZeileHinzu(raster, {kind:zeilenKind, sign:zeilenSign});
          fuelleAllePassendenZellen(typ);
        });
        render();
        return true;
      }
      return false;
    }
    for(const zeile of raster.zeilen){
      const spaltenKind = loeseAchsenArt(typ.kind, zeile.kind);
      if(!spaltenKind) continue;
      if(opts.spaltenGesperrt?.()){ kurzeFehlermarkierung(spaltenHitEl); return false; }
      const spaltenSign = typ.sign * zeile.sign;
      mitUndo(() => {
        fuegeSpalteHinzu(raster, {kind:spaltenKind, sign:spaltenSign});
        fuelleAllePassendenZellen(typ);
      });
      render();
      return true;
    }
    return false;
  }

  return {
    getRaster: () => raster,
    getSpaltenZoneEl: () => spaltenHitEl,
    getZeilenZoneEl: () => zeilenHitEl,
    getRasterEl: () => rasterEl,
    render: () => render(),
    zustandKlonen,
    stelleZustandWieder,
    punktTrifftZone(zoneEl, punkt){ return punktInRect(zoneEl, punkt); },
    findeZelleAnPunkt(punkt){
      const zellen = rasterEl.querySelectorAll('.mult-zelle--leer');
      for(const zielEl of zellen) if(punktInRect(zielEl, punkt)) return zielEl;
      return null;
    },
    spalteHinzufuegen(typ){
      if(typ.kind==='x2'){ kurzeFehlermarkierung(spaltenHitEl); return false; }
      if(opts.spaltenGesperrt?.()){ kurzeFehlermarkierung(spaltenHitEl); return false; }
      // Runde 34 (Nutzer-Rückmeldung: "Ausserdem soll nicht ein Produkt-
      // plättchen rausgeschmissen werden wenn ich die Faktoren falsch
      // einsetze, sondern man muss den passenden letzten Faktor einsetzen,
      // der falsche wird nicht akzeptiert."): Würde diese neue Spalte
      // zusammen mit einer bereits bestehenden Zeile eine Zelle ergeben, die
      // einem bereits im Produktfeld liegenden Plättchen widerspricht, wird
      // der gesamte Faktor abgewiesen, BEVOR irgendetwas entsteht – statt
      // ihn anzulegen und das widersprechende Plättchen anschließend (wie
      // bis Runde 33) dauerhaft als mismatch zu markieren.
      if(konfliktMitAusstehenden(typ, false, ausstehendeProdukte, raster)){
        kurzeFehlermarkierung(spaltenHitEl);
        return false;
      }
      mitUndo(() => {
        fuegeSpalteHinzu(raster, {kind:typ.kind, sign:typ.sign});
        // Runde 30 (Punkt 3): diese neu angelegte Spalte kann zusammen mit
        // jeder bereits bestehenden Zeile eine neue Zelle ergeben – prüft,
        // ob eine davon zu einem noch ausstehenden Produktfeld-Plättchen passt.
        const j = raster.spalten.length-1;
        verbrauchePendingFuerZellen(raster.zeilen.map((_, i) => raster.zellen[i][j]));
      });
      render();
      return true;
    },
    zeileHinzufuegen(typ){
      if(typ.kind==='x2'){ kurzeFehlermarkierung(zeilenHitEl); return false; }
      if(opts.zeilenGesperrt?.()){ kurzeFehlermarkierung(zeilenHitEl); return false; }
      // Runde 34: siehe Kommentar in spalteHinzufuegen – spiegelbildlich für
      // eine neue Zeile.
      if(konfliktMitAusstehenden(typ, true, ausstehendeProdukte, raster)){
        kurzeFehlermarkierung(zeilenHitEl);
        return false;
      }
      mitUndo(() => {
        fuegeZeileHinzu(raster, {kind:typ.kind, sign:typ.sign});
        verbrauchePendingFuerZellen(raster.zellen[raster.zellen.length-1]);
      });
      render();
      return true;
    },
    versucheZelleFuellen(zielEl, typ){
      const i = Number(zielEl.dataset.zeile), j = Number(zielEl.dataset.spalte);
      const zelle = raster.zellen[i]?.[j];
      if(!zelle || zelle.gefuellt) return false;
      if(zellePasstZuKachel(zelle, typ)){
        // Runde 24 (Punkt 4): sobald die Achsen (Faktoren) stehen, füllt ein
        // einzelnes richtig gezogenes Plättchen automatisch ALLE noch
        // offenen Zellen derselben Produkt-Art (Art + Vorzeichen) mit – nicht
        // nur die eine getroffene Zelle (siehe fuelleAllePassendenZellen).
        mitUndo(() => { fuelleAllePassendenZellen(typ); });
        render();
        return true;
      }
      zielEl.classList.add('mult-zelle--fehler');
      window.setTimeout(() => zielEl.classList.remove('mult-zelle--fehler'), 500);
      return false;
    },
    // Runde 24 (Punkt 3, inzwischen per Runde 29 Punkt 3 eingeschränkt, siehe
    // unten): sobald bereits eine Achse existiert, dockt ein Treffer im
    // leeren Rand des Produktfeldes (unterhalb der letzten Zeile bzw.
    // rechts der letzten Spalte) automatisch eine neue, passende Zeile ODER
    // Spalte an (abgeleitet aus einer bereits bestehenden Achse derselben
    // Art, siehe loeseAchsenArt) und füllt wie gewohnt alle dazu passenden
    // Zellen (Runde 25, Punkt 8). Das ist KEINE Vorzeichen-Ratung, da das
    // Vorzeichen der neuen Achse aus der bereits bestehenden, bewusst vom
    // Nutzer selbst gelegten Achse errechnet wird.
    //
    // Runde 29 (Punkt 3, Nutzer-Rückmeldung: "Wenn beim Malkreuz zuerst das
    // Produktfeld ausgefüllt wird, fülle NICHT automatisch die Faktoren aus.
    // Es kann ja auch -&- sein!"): die zuvor hier behandelte Sonderregel bei
    // VOLLSTÄNDIG leerem Raster (weder Zeile noch Spalte vorhanden) entschied
    // sich bei einem Treffer im leeren Produktfeld-Quadranten STETS für GENAU
    // EINE von mehreren gleichwertigen Vorzeichen-Zerlegungen (z. B. bei
    // einem einzelnen +1-Plättchen für "+1 · +1" statt ebenso gültig
    // "−1 · −1") – und verschleierte damit genau die Mehrdeutigkeit, die am
    // Malkreuz selbst erkannt werden soll.
    //
    // Runde 30 (Punkt 3, Nutzer-Rückmeldung: "Jetzt kann ich das Produktfeld
    // gar nicht mehr als erstes ausfüllen! Ich will das Produktfeld ausfüllen
    // dürfen! Du sollst mich aber die passenden Faktoren dafür selbst
    // ausfüllen lassen und nicht automatisiert!"): die in Runde 29 daraus
    // gezogene Konsequenz – ein Treffer im Produktfeld bleibt wirkungslos,
    // bevor nicht BEIDE Achsen stehen – ging zu weit und nahm der Lernperson
    // genau die Möglichkeit, die sie ausdrücklich wollte: zuerst das Produkt
    // zu legen. Seither wird ein solcher Treffer NICHT mehr abgelehnt,
    // sondern als „ausstehendes" Plättchen vorgemerkt (ausstehendeProdukte) –
    // ohne jede Vorzeichen-Zerlegung zu raten. Es wird einer Zelle erst
    // zugeordnet, sobald die Lernperson SELBST (über die Zeilen-/Spalten-Zone,
    // niemals automatisch) beide passenden Achsen anlegt – siehe
    // verbrauchePendingFuerZellen in zeileHinzufuegen/spalteHinzufuegen oben.
    // Existiert dagegen bereits mindestens eine Achse, bleibt die bisherige,
    // unambige Erweiterung (versucheRasterErweitern) unverändert zuständig.
    versucheErstbefuellung(typ, punkt){
      if(!punkt){ kurzeFehlermarkierung(produktHitEl); return false; }
      if(raster.zeilen.length===0 || raster.spalten.length===0){
        // Runde 33 (Nutzer-Rückmeldung: "Ich kann dem Malkreuz Produkt-
        // kärtchen hinzufügen, genauso wie ich Faktorkärtchen hinzufügen
        // kann. Sie springen auf ein passendes Feld und ich muss am Ende
        // die Passenden Faktorkärtchen hinzufügen."): Ablegepunkt in die
        // lokalen Koordinaten des Produktfeld-Quadranten umrechnen (gleiche
        // Basis wie produktHitEl/vormerkungEl) und daraus über
        // bestimmeVorlaeufigenIndex einen (vorläufigen) Zeilen- UND Spalten-
        // Index bestimmen – trifft der Punkt eine bereits bestehende Zeile/
        // Spalte (vorläufig oder bereits real), springt das Plättchen genau
        // dorthin (wie das Anhängen an eine Faktor-Kette); liegt er klar
        // dahinter, entsteht ein neuer, unmittelbar anschließender Index.
        // KEINE Vorzeichen-/Faktor-Zerlegung wird dabei je erraten – die
        // Lernperson bestimmt die Position selbst durch die Ablage.
        const layout = berechneLayout();
        const zoneRect = produktHitEl.getBoundingClientRect();
        const skalierung = layout.skalierung || 1;
        const lokalX = (punkt.clientX - zoneRect.left)/skalierung - ANDOCK_PAD;
        const lokalY = (punkt.clientY - zoneRect.top)/skalierung - ANDOCK_PAD;

        const geom = berechneVorlaeufigeGitterGeometrie(ausstehendeProdukte, raster);
        const zeilenIntervalle = geom.zeilenTopArr.map((top, i) => [top, top+geom.zeilenHoehenArr[i]]);
        const spaltenIntervalle = geom.spaltenLeftArr.map((left, j) => [left, left+geom.spaltenBreitenArr[j]]);
        const neueGroesse = tileDimensions(typ.kind, 1);
        const zeile = bestimmeVorlaeufigenIndex(lokalY, zeilenIntervalle, neueGroesse.h);
        const spalte = bestimmeVorlaeufigenIndex(lokalX, spaltenIntervalle, neueGroesse.w);

        // Dieses Gitterfeld ist bereits durch einen anderen vorläufigen
        // Eintrag belegt (mismatch-Einträge zählen nicht, deren Feld ist
        // faktisch aufgegeben) – Ablegen hier abweisen statt zu überschreiben.
        if(ausstehendeProdukte.some((p) => !p.mismatch && p.zeile===zeile && p.spalte===spalte)){
          kurzeFehlermarkierung(produktHitEl);
          return false;
        }

        mitUndo(() => { ausstehendeProdukte.push({ kind:typ.kind, sign:typ.sign, zeile, spalte }); });
        render();
        return true;
      }
      return versucheRasterErweitern(typ, punkt);
    },
    getProduktZoneEl: () => produktHitEl,
    istVollstaendig(){ return raster.zeilen.length>0 && raster.spalten.length>0 && rasterVollstaendig(raster); },
    /* Runde 21 (Punkt 8): alle bereits korrekt gefüllten Produkt-Zellen als flache Plättchen-Liste. */
    holeProduktPlaettchen: () => plaettchenAusRaster(raster),
    // Runde 16: "Zurücksetzen"/"Neu starten" leeren zusätzlich den
    // Undo-Speicher selbst (siehe mountUebungKM) – ein
    // kompletter Neustart ist keine einzelne Korrektur.
    reset(){ mitUndo(() => { raster = erzeugeLeeresRaster(); zellTiles.clear(); ausstehendeProdukte = []; }); render(); },
  };
}

/* Runde 21 (Punkt 9, Nutzer-Vorgabe: "Wenn schon ein Malkreuz angezeigt wird
   soll untendrunter ein Button erscheinen mit: 'Weiteres Malkreuz', welches
   ein neues Malkreuz unterhalb des ersten Malkreuzes erscheinen lässt"):
   verwaltet BELIEBIG VIELE, untereinander unabhängige Malkreuze – jedes
   bekommt sein eigenes, komplett unabhängiges createAndockRasterUI (eigenes
   Raster, eigener Undo-Verlauf über opts.undo) sowie einen eigenen
   "Anwenden"-Knopf (Punkt 8, opts.aufAnwenden). Das Erzeugen des NÄCHSTEN
   Malkreuzes hängt am jeweils LETZTEN Eintrag, wodurch "+ Weiteres Malkreuz"
   automatisch immer ans Ende der wachsenden Liste wandert. Bewusst NUR für
   frei bedienbare Malkreuze gedacht – von erzeugeFreieFlaeche und
   erzeugeGleichungsKette verwendet (seither auch von "Plättchen zu
   Gleichung"/"Gleichung zu Plättchen", die seit Runde 22 ebenfalls
   erzeugeGleichungsKette statt der inzwischen entfernten
   erzeugeGleichungsSeitenPaar nutzen), NICHT von den geführten Erklärungen
   oder von "Klammern multiplizieren"/"Division und Faktorisieren" (dort
   bleibt weiterhin die einzelne, gesperrte createAndockRasterUI-Instanz aus
   Runde 13–16 im Einsatz). Jedes Malkreuz der Gruppe lässt sich seit Runde
   22 (Punkt 6) auch per "Malkreuz löschen" wieder entfernen (mindestens
   eines bleibt bestehen). */
export function createMalkreuzGruppe(container, opts={}){
  container.innerHTML = '';
  const eintraege = []; // { wrapperEl, andock, weiteresBtn }

  function baueEintrag(){
    // Das "+ Weiteres Malkreuz" des bisher letzten Eintrags gehört nur so
    // lange dorthin, wie er tatsächlich der letzte ist.
    const vorheriger = eintraege[eintraege.length-1];
    vorheriger?.weiteresBtn.remove();

    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'malkreuz-eintrag';
    if(eintraege.length>0){
      const trennerEl = document.createElement('div');
      trennerEl.className = 'malkreuz-eintrag__trenner';
      wrapperEl.appendChild(trennerEl);
    }

    const andockHostEl = document.createElement('div');
    wrapperEl.appendChild(andockHostEl);
    const andock = createAndockRasterUI(andockHostEl, {
      zeilenLabel: opts.zeilenLabel, spaltenLabel: opts.spaltenLabel, undo: opts.undo,
    });

    const anwendenBtn = document.createElement('button');
    anwendenBtn.type = 'button';
    anwendenBtn.className = 'malkreuz-anwenden-btn';
    anwendenBtn.textContent = 'Anwenden';
    anwendenBtn.addEventListener('click', () => {
      const tiles = andock.holeProduktPlaettchen();
      if(tiles.length===0) return;
      opts.aufAnwenden?.(tiles);
    });
    wrapperEl.appendChild(anwendenBtn);

    // Runde 22 (Punkt 6, "genauso auch fürs Malkreuz"): entfernt GENAU
    // DIESES eine Malkreuz aus der Gruppe wieder vollständig. Mindestens
    // eines bleibt immer bestehen (siehe aktualisiereLoeschenButtons).
    const loeschenBtn = document.createElement('button');
    loeschenBtn.type = 'button';
    loeschenBtn.className = 'malkreuz-loeschen-btn';
    loeschenBtn.textContent = 'Malkreuz löschen';
    loeschenBtn.addEventListener('click', () => entferneEintrag(eintrag));
    wrapperEl.appendChild(loeschenBtn);

    const weiteresBtn = document.createElement('button');
    weiteresBtn.type = 'button';
    weiteresBtn.className = 'malkreuz-weiteres-btn';
    weiteresBtn.textContent = '+ Weiteres Malkreuz';
    weiteresBtn.addEventListener('click', baueEintrag);
    wrapperEl.appendChild(weiteresBtn);

    container.appendChild(wrapperEl);
    const eintrag = { wrapperEl, andock, weiteresBtn, loeschenBtn };
    eintraege.push(eintrag);
    aktualisiereLoeschenButtons();
    return eintrag;
  }

  /** Entfernt `eintrag` vollständig aus der Gruppe; wandert "+ Weiteres Malkreuz" ggf. auf den neuen letzten Eintrag weiter. */
  function entferneEintrag(eintrag){
    if(eintraege.length<=1) return;
    const idx = eintraege.indexOf(eintrag);
    const warLetzter = idx===eintraege.length-1;
    // War dies der erste Eintrag, verliert der neue erste seinen Trenner
    // (der Trenner gehört zum jeweils NACHFOLGENDEN Eintrag).
    if(idx===0) eintraege[1].wrapperEl.querySelector('.malkreuz-eintrag__trenner')?.remove();
    eintrag.wrapperEl.remove();
    eintraege.splice(idx, 1);
    if(warLetzter){
      const neuerLetzter = eintraege[eintraege.length-1];
      neuerLetzter.weiteresBtn = document.createElement('button');
      neuerLetzter.weiteresBtn.type = 'button';
      neuerLetzter.weiteresBtn.className = 'malkreuz-weiteres-btn';
      neuerLetzter.weiteresBtn.textContent = '+ Weiteres Malkreuz';
      neuerLetzter.weiteresBtn.addEventListener('click', baueEintrag);
      neuerLetzter.wrapperEl.appendChild(neuerLetzter.weiteresBtn);
    }
    aktualisiereLoeschenButtons();
  }

  /** Deaktiviert "Malkreuz löschen" auf ALLEN Einträgen, solange nur einer übrig ist. */
  function aktualisiereLoeschenButtons(){
    const gesperrt = eintraege.length<=1;
    for(const e of eintraege) e.loeschenBtn.disabled = gesperrt;
  }

  baueEintrag();

  return {
    /** Anzahl der aktuell verwalteten, unabhängigen Malkreuze. */
    get anzahl(){ return eintraege.length; },
    /* Versucht `typ` bei genau EINEM der verwalteten Malkreuze abzulegen
       (das ERSTE, dessen Zonen/Zellen den Punkt treffen). Liefert `false`,
       wenn KEIN Malkreuz der Gruppe getroffen wurde – die aufrufende Stelle
       soll dann normal an die Bearbeitungsfläche weiterreichen. */
    versucheAblegen(typ, punkt){
      for(const { andock } of eintraege){
        if(andock.punktTrifftZone(andock.getZeilenZoneEl(), punkt)){ andock.zeileHinzufuegen(typ); return true; }
        if(andock.punktTrifftZone(andock.getSpaltenZoneEl(), punkt)){ andock.spalteHinzufuegen(typ); return true; }
        const zielZelle = andock.findeZelleAnPunkt(punkt);
        if(zielZelle){ andock.versucheZelleFuellen(zielZelle, typ); return true; }
        // Runde 24 (Punkt 3): noch keine Achsen vorhanden – Treffer im
        // Produktfeld-Quadranten erzeugt Zeile+Spalte+Zelle in einem Zug.
        if(andock.punktTrifftZone(andock.getProduktZoneEl(), punkt) && andock.versucheErstbefuellung(typ, punkt)) return true;
      }
      return false;
    },
  };
}
