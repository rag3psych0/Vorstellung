import { setzeXWertEin } from '../engine/gleichungen.js';
import { Board } from '../engine/rechnen.js';
import { erzeugeFreieFlaeche } from './freieFlaeche.js';
import { createPlaettchenElement } from './renderPlaettchen.js';
import { TILE_UNIT, styleFor, tileDimensions } from './theme.js';

/* ============================================================
   Freie Bearbeitungsfläche (entspricht src/shared/freieTafel.js)
   Plättchen werden über die Auswahl hinzugefügt (Button oder Ziehen) und
   ordnen sich dabei SELBST automatisch an: gleiche Plättchen stapeln sich
   in einer Spalte nach unten, verschiedene Typen stehen nebeneinander
   (Reihenfolge wie im Term). Ob zwei Plättchen ein Nullpaar bilden, wird
   NICHT automatisch angezeigt – das soll die Schülerin/der Schüler selbst
   erkennen. Aufgelöst wird ausschließlich per ZIEHEN auf ein passendes
   Gegenstück (sonst Rücksprung); ein Auswahlrechteck gruppiert mehrere
   Plättchen DERSELBEN SORTE zum gemeinsamen Ziehen. Eingabetaste/Leertaste
   auf einem fokussierten Plättchen ist der Tastatur-Fallback.
   ============================================================ */
export const TAFEL_REIHENFOLGE = ['x2', 'x', 'zahl'];
export const TAFEL_MIN_HOEHE = 320;
// Runde 24 (Punkte 9-11): Padding/Lücken sind seither keine festen Pixelwerte
// mehr, sondern immer ganze Vielfache der aktuellen Kästchengröße (siehe
// berechneTafelLayout) – dadurch stehen Plättchen immer exakt auf dem
// sichtbaren Hintergrundraster, auch nach einem Zoom-Schritt (Punkt 12). Die
// früheren, fein unterschiedlichen Pixelwerte (16/28/14/6) sind damit
// hinfällig.
// Ab welchem Abstand rechts vom letzten Stapel ein abgelegtes Plättchen einen
// NEUEN Stapel eröffnet statt sich dem bestehenden anzuschließen. Runde 21:
// von 0.5 auf 0.3 gesenkt – auf einem Tablet ist eine per Finger gezogene
// Ablage weniger präzise als per Maus, ein kleinerer nötiger Abstand macht
// das Eröffnen eines zweiten Stapels dadurch zuverlässiger auslösbar.
export const TAFEL_STAPEL_NEU_SCHWELLE = 0.3;

/* Gruppiert nach Typ+Vorzeichen+Stapel (tile.stapel, Vorgabe 0 – Runde 20). */
// Runde 35: Bei kind==='zahl' können Kärtchen aus einem x-Wert-Einsetzen
// (setzeXWertEin, Runde 24/25/26/29) stammen und tragen dann ausEinsetzen/
// ausEinsetzenKind ('x2' oder 'x'). Der Nutzer wünscht, dass solche Spalten
// immer in der Reihenfolge x²-Ursprung, dann x-Ursprung, dann die bereits
// vorher vorhandenen einfachen 1-Kärtchen stehen – UNABHÄNGIG davon, welches
// Vorzeichen das jeweilige Ergebnis am Ende hat ("egal ob sie +/- 1 Kärtchen
// am Ende sind"). Ohne diese Sonderbehandlung sortierte gruppenSpalten strikt
// nach Vorzeichen vor Stapel, wodurch z.B. ein negatives x-Ergebnis vor einem
// positiven x²-Ergebnis stehen konnte. Für alle anderen kinds (x2, x) sowie
// für reine 1-Kärtchen ohne Einsetzen-Ursprung ändert sich nichts – die
// Ursprungs-Rangfolge ist für alle "einfachen" (nicht eingesetzten)
// Zahl-Kärtchen gleich (Rang 2), wodurch exakt die bisherige
// Vorzeichen-dann-Stapel-Sortierung erhalten bleibt.
export function gruppenSpalten(tiles){
  const spalten = [];
  for(const kind of TAFEL_REIHENFOLGE){
    const kindTiles = tiles.filter(t => t.kind===kind);
    if(kindTiles.length===0) continue;
    if(kind==='zahl'){
      const einsetzenRang = (t) => !t.ausEinsetzen ? 2 : (t.ausEinsetzenKind==='x2' ? 0 : 1);
      const gefunden = new Map();
      for(const t of kindTiles){
        const stapel = t.stapel ?? 0;
        const key = `${einsetzenRang(t)}|${t.sign}|${stapel}`;
        if(!gefunden.has(key)) gefunden.set(key, {rang:einsetzenRang(t), sign:t.sign, stapel, tiles:[]});
        gefunden.get(key).tiles.push(t);
      }
      const gruppen = [...gefunden.values()].sort((a,b) => {
        if(a.rang!==b.rang) return a.rang-b.rang;
        if(a.sign!==b.sign) return a.sign===1 ? -1 : 1;
        return a.stapel-b.stapel;
      });
      for(const g of gruppen){
        spalten.push({kind, sign:g.sign, stapel:g.stapel, tiles:g.tiles});
      }
    } else {
      for(const sign of [1,-1]){
        const sorte = kindTiles.filter(t => t.sign===sign);
        if(sorte.length===0) continue;
        const stapelIndizes = [...new Set(sorte.map(t => t.stapel ?? 0))].sort((a,b) => a-b);
        for(const stapel of stapelIndizes){
          spalten.push({kind, sign, stapel, tiles:sorte.filter(t => (t.stapel ?? 0)===stapel)});
        }
      }
    }
  }
  return spalten;
}

export function berechneTafelLayout(tiles, skalierung=1){
  // Runde 24 (Punkte 9-11): eine Kästchengröße ("Zelle") ist die einzige
  // Bezugsgröße für Padding, Lücken UND Plättchengröße (tileDimensions) –
  // alles ganze Vielfache davon, nie dazwischen. Dadurch stehen Plättchen
  // immer exakt auf dem (ebenfalls auf "zelle" gesetzten) Hintergrundraster,
  // bei jeder Zoomstufe (Punkt 12) gleichermaßen.
  const zelle = TILE_UNIT*skalierung;
  const PADDING = zelle, GAP_SPALTEN = zelle, GAP_KACHEL = 0;
  const spaltenGeom = [];
  let x = PADDING;
  let maxStapelHoehe = 0;
  // Runde 26 (Punkt 2, Nutzer-Rückmeldung: "Gleiche Wertigkeiten (+/-x² oder
  // +/-x oder +/-1) sollen keinen Zeilenabstand in den Bearbeitungsflächen
  // haben, sondern nur wenn es von x² zu x zu 1 geht"): eine Lücke entsteht
  // seither NUR noch an der Grenze zwischen unterschiedlichen Wertigkeiten
  // (x² -> x -> 1, `spalte.kind`). Zwischen mehreren Spalten DERSELBEN
  // Wertigkeit – unterschiedliches Vorzeichen (+x neben -x) oder mehrere
  // getrennte Stapel desselben Vorzeichens (Mehrfach-Stapel, Runde 20) –
  // gibt es bewusst keinen Abstand mehr (vormals GAP_STAPEL, genauso groß
  // wie GAP_SPALTEN, zwischen jeder Vorzeichen-/Stapel-Spalte).
  let vorigerKind = null;
  for(const spalte of gruppenSpalten(tiles)){
    if(vorigerKind!==null && vorigerKind!==spalte.kind) x += GAP_SPALTEN;
    const { w, h } = tileDimensions(spalte.kind, skalierung);
    const stapelHoehe = spalte.tiles.length*h + Math.max(0, spalte.tiles.length-1)*GAP_KACHEL;
    maxStapelHoehe = Math.max(maxStapelHoehe, stapelHoehe);
    spaltenGeom.push({ ...spalte, w, h, left:x, right:x+w });
    x += w;
    vorigerKind = spalte.kind;
  }
  const hoehe = Math.max(TAFEL_MIN_HOEHE*skalierung, maxStapelHoehe + PADDING*2);
  const groundY = hoehe - PADDING;
  const positionen = new Map();
  for(const spalte of spaltenGeom){
    spalte.tiles.forEach((tile, i) => {
      const top = groundY - i*(spalte.h+GAP_KACHEL) - spalte.h;
      positionen.set(tile.id, { left:spalte.left, top, w:spalte.w, h:spalte.h });
    });
  }
  // Runde 30 (Punkt 2, Nutzer-Rückmeldung: "statt gestrichelte Umrandung über
  // einzelne +1, Mache eine eine durchgängige, gruppierte Umrandung über alle
  // +/-1 die von einem x/x² stammt"): da setzeXWertEin JEDEM ursprünglichen
  // x-/x²-Stapel einen eigenen, alleinigen (negativen) Stapel-Index zuteilt
  // (siehe dort), entspricht eine aus dem Einsetzen stammende Gruppe bereits
  // GENAU einer Spalte aus gruppenSpalten – hier wird für jede solche Spalte
  // EINE gemeinsame Rahmen-Geometrie (statt vormals je Plättchen eine
  // einzelne) berechnet, die den gesamten Stapel umschließt.
  const einsetzenRahmen = [];
  for(const spalte of spaltenGeom){
    if(spalte.tiles.length===0 || !spalte.tiles[0].ausEinsetzen) continue;
    let top = Infinity, bottom = -Infinity;
    for(const tile of spalte.tiles){
      const pos = positionen.get(tile.id);
      top = Math.min(top, pos.top);
      bottom = Math.max(bottom, pos.top+pos.h);
    }
    // Runde 32 (Punkt 1, Nutzer-Rückmeldung: "Die Umrandung der +/-1
    // Plättchen durch einsetzen von x als Zahl soll die selbe Farbe haben
    // wie das Plättchen aus der sie entstanden sind"): Rahmenfarbe aus der
    // HERKUNFT (ursprüngliches x-/x²-Plättchen, nicht die neu entstandene
    // Zahl) ableiten, siehe setzeXWertEin/ersetzeAlleTiles.
    const herkunft = spalte.tiles[0];
    const farbe = herkunft.ausEinsetzenKind
      ? styleFor(herkunft.ausEinsetzenKind, herkunft.ausEinsetzenSign).fill
      : 'var(--accent)';
    einsetzenRahmen.push({ left:spalte.left, top, width:spalte.w, height:bottom-top, farbe });
  }
  return { positionen, hoehe, spaltenGeom, zelle, einsetzenRahmen };
}

/* Runde 20 (Punkt 2): welchem Stapel ein NEU aus der Auswahl gezogenes
   Plättchen zugeordnet wird. Ohne Ablagepunkt: primärer (ältester) Stapel.
   Mit Ablagepunkt: bestehenden Stapel treffen -> dort dazu; mehr als eine
   halbe Plättchenbreite rechts vom letzten Stapel -> neuer Stapel; sonst
   nächstgelegener bestehender Stapel. */
export function bestimmeStapelIndex(tiles, kind, sign, punktRelativ, skalierung=1){
  const bestehende = [...new Set(tiles.filter(t => t.kind===kind && t.sign===sign).map(t => t.stapel ?? 0))].sort((a,b) => a-b);
  if(bestehende.length===0) return 0;
  if(!punktRelativ) return bestehende[0];

  const { spaltenGeom } = berechneTafelLayout(tiles, skalierung);
  const geomByStapel = new Map();
  for(const spalte of spaltenGeom){
    if(spalte.kind===kind && spalte.sign===sign) geomByStapel.set(spalte.stapel, spalte);
  }

  let rechtesEnde = -Infinity;
  let naechsterIndex = bestehende[0];
  let naechsterAbstand = Infinity;
  let breite = tileDimensions(kind, skalierung).w;
  for(const idx of bestehende){
    const geo = geomByStapel.get(idx);
    if(!geo) continue;
    breite = geo.w;
    rechtesEnde = Math.max(rechtesEnde, geo.right);
    if(punktRelativ.x>=geo.left && punktRelativ.x<=geo.right) return idx;
    const abstand = punktRelativ.x<geo.left ? geo.left-punktRelativ.x : punktRelativ.x-geo.right;
    if(abstand<naechsterAbstand){ naechsterAbstand = abstand; naechsterIndex = idx; }
  }
  if(punktRelativ.x > rechtesEnde + breite*TAFEL_STAPEL_NEU_SCHWELLE){
    return bestehende[bestehende.length-1]+1;
  }
  return naechsterIndex;
}

export function tafelRechteckeUeberlappen(a, b){
  return a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
}

// Runde 24 (Punkt 12): Zoomstufen in festen Schritten, als Vielfaches der
// Grund-Kästchengröße (TILE_UNIT) – bewusst eine kleine, feste Stufenliste
// statt eines stufenlosen Reglers, damit "+"/"−" immer vorhersagbar zum
// nächsten, weiterhin exakt rasterkonformen Wert springt.
export const TAFEL_ZOOM_STUFEN = [0.6, 0.8, 1, 1.25, 1.5, 1.8];
export const TAFEL_ZOOM_STANDARD_INDEX = 2; // entspricht 1

export function createFreieTafel(container, { onChange, undo } = {}){
  const board = new Board();
  const kachelElemente = new Map();
  // Runde 30 (Punkt 2): eigene, bei jedem render() komplett neu erzeugte
  // Rahmen-Elemente (eines je Einsetzen-Gruppe) – anders als kachelElemente
  // brauchen sie keine Drag-Listener o. Ä. und werden daher nicht einzeln
  // nachverfolgt/wiederverwendet.
  let einsetzenRahmenElemente = [];
  const EINSETZEN_RAHMEN_PAD = 4;
  let letzteLayoutPositionen = new Map();
  let auswahl = new Set();
  let zoomIndex = TAFEL_ZOOM_STANDARD_INDEX;
  function aktuelleSkalierung(){ return TAFEL_ZOOM_STUFEN[zoomIndex]; }

  function melde(details){ onChange?.(board, details); }

  /* Runde 16 ("Rückgängig button"): führt `aktion` aus und zeichnet, falls
     sich das Board dabei ändert (und `undo` übergeben wurde), den
     vorherigen Stand als Wiederherstellungs-Schritt auf. Runde 18 (Punkt 6):
     `opts.sync` (Default true) wird beim späteren Rückgängig-Machen an
     render() durchgereicht, damit eine lokal gebliebene Nullpaar-Auflösung
     auch beim Rückgängig-Machen lokal bleibt. */
  function mitUndo(aktion, { sync = true } = {}){
    const vorher = undo ? board.snapshot() : null;
    aktion();
    if(undo && (board.tiles.length!==vorher.length || board.tiles.some((t,i) => t.id!==vorher[i]?.id))){
      undo.aufzeichnen(() => { board.tiles = vorher; render({ sync }); });
    }
  }

  function aktualisiereAuswahlDarstellung(){
    for(const [id, el] of kachelElemente){
      el.classList.toggle('freie-tafel__kachel--ausgewaehlt', auswahl.has(id));
    }
  }

  function versucheKeyboardAufzuloesen(tile){
    const partner = board.tiles.find(t => t.id!==tile.id && t.kind===tile.kind && t.sign===-tile.sign);
    if(!partner) return;
    // Runde 18 (Punkt 6): eine Nullpaar-Auflösung ändert den Wert nicht und
    // bleibt deshalb lokal (sync:false).
    mitUndo(() => { board.removeById(tile.id); board.removeById(partner.id); }, { sync: false });
    auswahl.delete(tile.id); auswahl.delete(partner.id);
    render({ sync: false });
  }

  function loeseAbgelegteGruppeAuf(dragIds){
    const verwendetePartner = new Set();
    const zuEntfernen = new Set();
    for(const id of dragIds){
      const tile = board.tiles.find(t => t.id===id);
      const el = kachelElemente.get(id);
      if(!tile || !el) continue;
      const { w, h } = tileDimensions(tile.kind, aktuelleSkalierung());
      const mitteX = parseFloat(el.style.left) + w/2;
      const mitteY = parseFloat(el.style.top) + h/2;
      const partner = board.tiles.find(t => {
        if(dragIds.has(t.id) || verwendetePartner.has(t.id)) return false;
        if(t.kind!==tile.kind || t.sign!==-tile.sign) return false;
        const pos = letzteLayoutPositionen.get(t.id);
        if(!pos) return false;
        return mitteX>=pos.left && mitteX<=pos.left+pos.w && mitteY>=pos.top && mitteY<=pos.top+pos.h;
      });
      if(partner){ verwendetePartner.add(partner.id); zuEntfernen.add(id); zuEntfernen.add(partner.id); }
    }
    for(const id of zuEntfernen) board.removeById(id);
  }

  function starteKachelDrag(event, tileId){
    event.preventDefault();
    let dragIds;
    if(auswahl.has(tileId)){ dragIds = new Set(auswahl); }
    else { auswahl.clear(); dragIds = new Set([tileId]); }
    aktualisiereAuswahlDarstellung();

    const startX = event.clientX, startY = event.clientY;
    const homes = new Map();
    for(const id of dragIds){
      const el = kachelElemente.get(id);
      if(!el) continue;
      el.classList.add('freie-tafel__kachel--dragging');
      homes.set(id, { left:parseFloat(el.style.left), top:parseFloat(el.style.top) });
    }
    function onMove(moveEvent){
      const dx = moveEvent.clientX-startX, dy = moveEvent.clientY-startY;
      for(const id of dragIds){
        const el = kachelElemente.get(id), home = homes.get(id);
        if(!el || !home) continue;
        el.style.left = `${home.left+dx}px`;
        el.style.top = `${home.top+dy}px`;
      }
    }
    function onUp(upEvent){
      window.removeEventListener('pointermove', onMove);
      for(const id of dragIds) kachelElemente.get(id)?.classList.remove('freie-tafel__kachel--dragging');
      // Runde 30 (Punkt 2, Nutzer-Rückmeldung: "Diese Umrandung soll
      // aufgelöst werden, sobald weiter danach mit gearbeitet/aufgelöst
      // wird"): die Herkunfts-Markierung (ausEinsetzen, siehe setzeXWertEin)
      // gilt nur, bis die Lernperson das betroffene Plättchen SELBST wieder
      // anfasst – unabhängig davon, ob es danach entfernt, zu einem Nullpaar
      // aufgelöst oder nur auf einen anderen Stapel umsortiert wird. Das
      // Ziehen selbst gilt bereits als "weiter gearbeitet", daher wird die
      // Markierung hier für ALLE gezogenen Plättchen gelöscht, noch bevor
      // über Entfernen/Zusammenführen/Umsortieren entschieden wird.
      for(const id of dragIds){
        const tile = board.tiles.find((t) => t.id===id);
        if(tile) tile.ausEinsetzen = false;
      }
      // Runde 16 ("man muss Plättchen wieder wegnehmen dürfen"): außerhalb
      // der Tafel losgelassen -> entfernen, unabhängig von einem Treffer.
      const tafelRect = container.getBoundingClientRect();
      const ausserhalb = upEvent.clientX<tafelRect.left || upEvent.clientX>tafelRect.right
        || upEvent.clientY<tafelRect.top || upEvent.clientY>tafelRect.bottom;
      // Runde 18 (Punkt 6): NUR das Zusammenführen zu einem Nullpaar
      // (innerhalb der Tafel) ändert den Wert nicht und bleibt lokal
      // (sync:false) – das Herausziehen entfernt dagegen tatsächlich
      // Plättchen und bleibt deshalb wie gehabt synchronisiert.
      let sync = true;
      if(ausserhalb){
        mitUndo(() => { for(const id of dragIds) board.removeById(id); });
      } else {
        sync = false;
        mitUndo(() => { loeseAbgelegteGruppeAuf(dragIds); }, { sync: false });

        // Runde 21 (Präzisierung zu Punkt 2 der Vorrunde): bis Runde 20 ließ
        // sich ein zweiter Stapel nur durch ein NEU aus der Auswahl gezogenes
        // Plättchen eröffnen – ein bereits ausliegendes Plättchen sprang beim
        // Loslassen stets auf seine alte Stapel-Position zurück. "Ich ziehe
        // ein Plättchen neben den Stapel" meint aber ausdrücklich auch ein
        // bereits liegendes Plättchen. Eine Stapel-Umsortierung verändert die
        // Wertigkeit nicht (sync:false).
        // Runde 25 (Punkt 7, Nutzer-Rückmeldung: "Gruppierte Plättchen
        // dürfen auch zusammen auf einen anderen/neuen Stapel gelegt werden.
        // Dies kann bisher nur mit einzelnen gemacht werden"): gilt jetzt
        // auch für eine Mehrfach-Auswahl, NICHT mehr nur für ein einzelnes
        // Plättchen – alle noch vorhandenen gezogenen Plättchen werden nach
        // Art+Vorzeichen gruppiert (eine Auswahl ist zwar immer derselben
        // ART, kann aber unterschiedliche VORZEICHEN enthalten) und JEDE
        // Untergruppe wandert gemeinsam auf denselben neuen/bestehenden
        // Stapel – ermittelt anhand der Endposition ihres ersten Plättchens
        // (alle Plättchen einer Untergruppe wurden während des Ziehens starr,
        // also mit gleichem Versatz, bewegt, daher reicht ein Vertreter).
        if(dragIds.size>0){
          // Runde 25 (Punkt 7, Korrektur): bestimmeStapelIndex braucht die
          // Spalten-GEOMETRIE aller Stapel so, wie sie GERADE (statisch,
          // ohne den laufenden Drag) auf der Tafel stehen – dazu gehört auch
          // der eigene Herkunfts-Stapel der gezogenen Gruppe. Würde man ihn
          // (wie zuvor) aus der Geometrie-Berechnung herausfiltern, rutschen
          // alle ÜBRIGEN Stapel in der hypothetischen Spalten-Neuberechnung
          // nach links – ihre dort berechnete Spalten-Position stimmt dann
          // nicht mehr mit der tatsächlich auf dem Bildschirm sichtbaren
          // Position überein, worauf der Ablagepunkt-Vergleich fehlschlägt
          // (Symptom: eine komplett gezogene Gruppe landet auf einem neuen,
          // dritten Stapel statt sich an den Ziel-Stapel anzuschließen).
          // `board.tiles` (ungefiltert, mit noch unveränderten `.stapel`-
          // Werten der Gruppe) liefert dieselbe Geometrie wie der aktuelle
          // Bildschirm-Zustand.
          const nachArtVorzeichen = new Map();
          for(const id of dragIds){
            const tile = board.tiles.find((t) => t.id===id);
            if(!tile) continue;
            const schluessel = `${tile.kind}|${tile.sign}`;
            if(!nachArtVorzeichen.has(schluessel)) nachArtVorzeichen.set(schluessel, []);
            nachArtVorzeichen.get(schluessel).push(tile);
          }
          mitUndo(() => {
            for(const gruppe of nachArtVorzeichen.values()){
              const vertreter = gruppe[0];
              const vertreterEl = kachelElemente.get(vertreter.id);
              if(!vertreterEl) continue;
              const { w } = tileDimensions(vertreter.kind, aktuelleSkalierung());
              const punktRelativ = { x: parseFloat(vertreterEl.style.left)+w/2, y: parseFloat(vertreterEl.style.top) };
              const neuerStapel = bestimmeStapelIndex(board.tiles, vertreter.kind, vertreter.sign, punktRelativ, aktuelleSkalierung());
              for(const tile of gruppe) tile.stapel = neuerStapel;
            }
          }, { sync: false });
        }
      }
      auswahl.clear();
      render({ sync });
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once:true });
  }

  function starteRechteckAuswahl(event){
    event.preventDefault();
    const tafelRect = container.getBoundingClientRect();
    const startX = event.clientX-tafelRect.left, startY = event.clientY-tafelRect.top;
    const rechteckEl = document.createElement('div');
    rechteckEl.className = 'freie-tafel__auswahlrechteck';
    container.appendChild(rechteckEl);

    let letztesRechteck;
    function zeichne(x2, y2){
      const left = Math.min(startX,x2), top = Math.min(startY,y2);
      const right = Math.max(startX,x2), bottom = Math.max(startY,y2);
      rechteckEl.style.left = `${left}px`;
      rechteckEl.style.top = `${top}px`;
      rechteckEl.style.width = `${right-left}px`;
      rechteckEl.style.height = `${bottom-top}px`;
      letztesRechteck = { left, top, right, bottom };
    }
    zeichne(startX, startY);

    function onMove(moveEvent){ zeichne(moveEvent.clientX-tafelRect.left, moveEvent.clientY-tafelRect.top); }
    function onUp(){
      window.removeEventListener('pointermove', onMove);
      rechteckEl.remove();
      const breite = letztesRechteck.right-letztesRechteck.left;
      const hoehe = letztesRechteck.bottom-letztesRechteck.top;
      if(breite<4 && hoehe<4){ auswahl.clear(); aktualisiereAuswahlDarstellung(); return; }
      const getroffen = board.tiles.filter(tile => {
        const pos = letzteLayoutPositionen.get(tile.id);
        if(!pos) return false;
        return tafelRechteckeUeberlappen(letztesRechteck, { left:pos.left, top:pos.top, right:pos.left+pos.w, bottom:pos.top+pos.h });
      });
      auswahl = new Set();
      if(getroffen.length>0){
        const zielArt = getroffen[0].kind;
        for(const tile of getroffen) if(tile.kind===zielArt) auswahl.add(tile.id);
      }
      aktualisiereAuswahlDarstellung();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once:true });
  }

  container.addEventListener('pointerdown', (event) => {
    if(event.button!==0) return;
    const kachelEl = event.target.closest?.('.freie-tafel__kachel');
    if(kachelEl?.dataset.tileId) starteKachelDrag(event, kachelEl.dataset.tileId);
    else starteRechteckAuswahl(event);
  });

  function render(details){
    // Runde 30 (Punkt 2): gerät ein "fremdes" (nicht aus x-Wert-Einsetzen
    // stammendes) Plättchen in denselben Stapel wie eine bestehende
    // Einsetzen-Gruppe (z. B. durch Umsortieren per Drag, siehe
    // starteKachelDrag), ist die Gruppe damit bereits "weiter bearbeitet" –
    // die Herkunfts-Markierung löst sich dann für den GESAMTEN Stapel auf,
    // statt einen optisch widersprüchlichen Misch-Rahmen zu zeigen.
    for(const spalte of gruppenSpalten(board.tiles)){
      const hatMarkierte = spalte.tiles.some((t) => t.ausEinsetzen);
      const hatFremde = spalte.tiles.some((t) => !t.ausEinsetzen);
      if(hatMarkierte && hatFremde){
        for(const t of spalte.tiles) t.ausEinsetzen = false;
      }
    }

    const skalierung = aktuelleSkalierung();
    const layout = berechneTafelLayout(board.tiles, skalierung);
    letzteLayoutPositionen = layout.positionen;
    container.style.minHeight = `${layout.hoehe}px`;
    // Runde 24 (Punkte 9-11): die Kästchengröße des Hintergrundrasters folgt
    // exakt derselben Zelle, die auch die Plättchenmaße bestimmt (siehe CSS
    // ".freie-tafel{ background-size: var(--zelle) ... }").
    container.style.setProperty('--zelle', `${layout.zelle}px`);

    const aktuelleIds = new Set(board.tiles.map(t => t.id));
    for(const [id, el] of kachelElemente){
      if(!aktuelleIds.has(id)){ el.remove(); kachelElemente.delete(id); }
    }
    for(const tile of board.tiles){
      const pos = layout.positionen.get(tile.id);
      let el = kachelElemente.get(tile.id);
      // Runde 24 (Punkt 12): nach einem Zoom-Schritt müssen bereits
      // vorhandene Plättchen-Elemente auf die neue Größe neu erzeugt werden
      // (die bisherige Inkremental-Logik aktualisierte nur links/top).
      if(el && Number(el.dataset.skalierung)!==skalierung){ el.remove(); kachelElemente.delete(tile.id); el = null; }
      if(!el){
        // Runde 24 (Punkt 8): Plättchen auf Bearbeitungsflächen zeigen
        // künftig immer ihre Wertigkeit (1/x/x²), nicht nur das Vorzeichen.
        el = createPlaettchenElement(tile.kind, tile.sign, {id:tile.id, scale:skalierung, zeigeWert:true});
        el.dataset.skalierung = String(skalierung);
        el.classList.add('freie-tafel__kachel');
        el.setAttribute('tabindex','0');
        el.setAttribute('role','button');
        el.setAttribute('aria-label', `${el.getAttribute('aria-label')} – auf ein passendes Gegenstück ziehen, um es aufzulösen (oder Eingabetaste drücken)`);
        el.addEventListener('keydown', (event) => {
          if(event.key==='Enter' || event.key===' '){ event.preventDefault(); versucheKeyboardAufzuloesen(tile); }
        });
        container.appendChild(el);
        kachelElemente.set(tile.id, el);
      }
      el.style.left = `${pos.left}px`;
      el.style.top = `${pos.top}px`;
      el.classList.toggle('freie-tafel__kachel--ausgewaehlt', auswahl.has(tile.id));
    }
    // Runde 30 (Punkt 2, Nutzer-Rückmeldung: "statt gestrichelte Umrandung
    // über einzelne +1, Mache eine eine durchgängige, gruppierte Umrandung
    // über alle +/-1 die von einem x/x² stammt"): ersetzt die bisherige, an
    // JEDEM einzelnen Plättchen angebrachte gestrichelte Markierung
    // (Runde 29, Punkt 2) durch GENAU EINEN durchgängigen Rahmen je
    // Einsetzen-Gruppe, der den gesamten zugehörigen Stapel umschließt
    // (Geometrie aus berechneTafelLayout/einsetzenRahmen).
    for(const el of einsetzenRahmenElemente) el.remove();
    einsetzenRahmenElemente = [];
    for(const rahmen of layout.einsetzenRahmen){
      const el = document.createElement('div');
      el.className = 'freie-tafel__einsetzen-rahmen';
      el.style.left = `${rahmen.left-EINSETZEN_RAHMEN_PAD}px`;
      el.style.top = `${rahmen.top-EINSETZEN_RAHMEN_PAD}px`;
      el.style.width = `${rahmen.width+EINSETZEN_RAHMEN_PAD*2}px`;
      el.style.height = `${rahmen.height+EINSETZEN_RAHMEN_PAD*2}px`;
      // Runde 32 (Punkt 1): Rahmenfarbe = Farbe des Herkunfts-Plättchens.
      if(rahmen.farbe) el.style.borderColor = rahmen.farbe;
      container.appendChild(el);
      einsetzenRahmenElemente.push(el);
    }
    melde(details);
  }

  return {
    board,
    // Runde 20 (Punkt 2): opts.punktRelativ (Ablagepunkt relativ zur Tafel)
    // entscheidet, ob das Plättchen einem bestehenden Stapel derselben Sorte
    // zugeordnet wird oder (weit genug rechts davon) einen neuen eröffnet.
    addTile(kind, sign, opts={}){
      let tile;
      mitUndo(() => {
        [tile] = board.add(kind, sign, 1);
        tile.stapel = bestimmeStapelIndex(board.tiles.filter(t => t.id!==tile.id), kind, sign, opts.punktRelativ, aktuelleSkalierung());
      });
      render();
      return tile;
    },
    addTiles(kachelListe){
      mitUndo(() => { for(const { kind, sign } of kachelListe) board.add(kind, sign, 1); });
      render();
      return board.tiles;
    },
    addZeroPair(kind){
      mitUndo(() => { board.add(kind, 1, 1); board.add(kind, -1, 1); });
      render();
    },
    // Runde 24 (Punkt 13): ersetzt den GESAMTEN Plättchenbestand durch
    // `neueTiles` – in EINEM Rückgängig-Schritt (anders als clear()+
    // addTiles() in zwei Schritten), z.B. zum Einsetzen eines konkreten
    // x-Werts (siehe setzeXWertEin). `sync:false` unterdrückt die normale
    // Gruppen-/Zeilen-Synchronisation, wenn die aufrufende Stelle ohnehin
    // JEDE betroffene Fläche einzeln selbst ersetzt (siehe die
    // "Anwenden"-Knöpfe bei Termen und Gleichungen).
    // Runde 25 (Punkt 6): übernimmt einen optionalen `stapel`-Wert pro
    // Plättchen (z.B. von setzeXWertEin vergeben), statt ihn wie zuvor zu
    // verwerfen – nur so bleiben per Einsetzen entstandene Plättchen
    // sichtbar in einem eigenen Stapel statt (Default-Stapel 0) sofort mit
    // schon vorhandenen Plättchen derselben Art+Vorzeichen zu verschmelzen.
    // Runde 25 (Punkt 9): `einsetzInfo` (falls übergeben) wird unverändert bis
    // zum `onChange(board, details)`-Aufruf durchgereicht – so kann die
    // aufrufende Stelle (x-Wert-Einsetzen) markieren, DASS und WOMIT gerade
    // ersetzt wurde, ohne dass ersetzeAlleTiles selbst wissen muss, wofür
    // das gebraucht wird (siehe aktualisiereTermAnzeige in erzeugeFreieFlaeche).
    ersetzeAlleTiles(neueTiles, { sync = true, einsetzInfo } = {}){
      mitUndo(() => {
        board.clear();
        for(const t of neueTiles){
          const [tile] = board.add(t.kind, t.sign, 1);
          if(t.stapel!==undefined) tile.stapel = t.stapel;
          // Runde 29 (Punkt 2): Markierung "durch x-Wert-Einsetzen entstanden"
          // (siehe setzeXWertEin) bleibt beim Ersetzen erhalten, damit render()
          // sie darstellen kann.
          if(t.ausEinsetzen) tile.ausEinsetzen = true;
          // Runde 32 (Nutzer-Rückmeldung: "Die Umrandung der +/-1 Plättchen
          // durch einsetzen von x als Zahl soll die selbe Farbe haben wie das
          // Plättchen aus der sie entstanden sind"): Herkunfts-Art/-Vorzeichen
          // (das URSPRÜNGLICHE x-/x²-Plättchen, nicht das neu entstandene
          // Zahl-Plättchen, siehe setzeXWertEin) ebenfalls durchreichen, damit
          // render() die Rahmenfarbe daraus bestimmen kann.
          if(t.ausEinsetzenKind) tile.ausEinsetzenKind = t.ausEinsetzenKind;
          if(t.ausEinsetzenSign!==undefined) tile.ausEinsetzenSign = t.ausEinsetzenSign;
        }
      });
      auswahl.clear();
      render({ sync, einsetzInfo });
    },
    clear(){
      mitUndo(() => { board.clear(); });
      auswahl.clear();
      render();
    },
    render,
    // Runde 24 (Punkt 12): Zoom-Button neben "Bearbeitungsfläche" o.ä. ruft
    // dies auf; richtung = +1 (hinein, größer) oder -1 (heraus, kleiner).
    // Verändert nur die Darstellung (Kästchen- & Plättchengröße), nie den
    // Plättchenbestand selbst.
    zoomen(richtung){
      const neuerIndex = Math.min(TAFEL_ZOOM_STUFEN.length-1, Math.max(0, zoomIndex + richtung));
      if(neuerIndex===zoomIndex) return false;
      zoomIndex = neuerIndex;
      render();
      return true;
    },
    kannHineinzoomen(){ return zoomIndex < TAFEL_ZOOM_STUFEN.length-1; },
    kannHerauszoomen(){ return zoomIndex > 0; },
  };
}

/* Standalone-Toggle für die (zunächst verborgene) Term-Anzeige. */
export function verdrahteTermToggle(button, anzeige, opts = {}){
  const textAnzeigen = opts.textAnzeigen ?? 'Term anzeigen';
  const textVerbergen = opts.textVerbergen ?? 'Term verbergen';
  let sichtbar = false;
  anzeige.hidden = true;
  button.textContent = textAnzeigen;
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    sichtbar = !sichtbar;
    anzeige.hidden = !sichtbar;
    button.textContent = sichtbar ? textVerbergen : textAnzeigen;
    button.setAttribute('aria-expanded', String(sichtbar));
  });
}
