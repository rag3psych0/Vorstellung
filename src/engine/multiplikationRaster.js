import { TAFEL_STAPEL_NEU_SCHWELLE } from '../shared/freieTafel.js';
import { TILE_LONG, TILE_UNIT, tileDimensions } from '../shared/theme.js';

/* ============================================================
   Multiplikationsraster (entspricht src/engine/multiplikationRaster.js):
   Flächenmodell für "Klammern multiplizieren" – Faktor A (Zeilen,
   senkrecht) × Faktor B (Spalten, waagerecht). TILE_UNIT/TILE_LONG werden
   weiter unten definiert; da hier nur function-Deklarationen stehen (erst
   zur Laufzeit aufgerufen), ist das unproblematisch.
   ============================================================ */
export function kombiniereArt(artA, artB){
  if(artA==='x' && artB==='x') return 'x2';
  if(artA==='zahl' && artB==='zahl') return 'zahl';
  return 'x';
}
export function kombiniereVorzeichen(signA, signB){ return signA*signB; }
/* Runde 25 (Punkt 8): Umkehrung von kombiniereArt – welche Art müsste die
   UNBEKANNTE Achse haben, damit sie zusammen mit einer BEKANNTEN Achsen-Art
   die erwartete Produkt-Art ergibt? (kombiniereArt ist symmetrisch in
   artA/artB, daher reicht eine Richtung.) null = es gibt keine solche Art. */
export function loeseAchsenArt(erwarteteArt, bekannteArt){
  if(erwarteteArt==='x2') return bekannteArt==='x' ? 'x' : null;
  if(erwarteteArt==='zahl') return bekannteArt==='zahl' ? 'zahl' : null;
  if(bekannteArt==='zahl') return 'x';
  if(bekannteArt==='x') return 'zahl';
  return null;
}
export function erzeugeMultiplikationsRaster(zeilenTiles, spaltenTiles){
  const zellen = zeilenTiles.map((zeile, i) => spaltenTiles.map((spalte, j) => ({
    zeile:i, spalte:j,
    erwarteteArt: kombiniereArt(zeile.kind, spalte.kind),
    erwartetesVorzeichen: kombiniereVorzeichen(zeile.sign, spalte.sign),
    gefuellt:false,
  })));
  return { zeilen:zeilenTiles, spalten:spaltenTiles, zellen };
}
export function zellePasstZuKachel(zelle, kandidat){
  return zelle.erwarteteArt===kandidat.kind && zelle.erwartetesVorzeichen===kandidat.sign;
}
export function rasterVollstaendig(raster){
  return raster.zellen.every(reihe => reihe.every(z => z.gefuellt));
}
export function koeffizientenAusRaster(raster){
  const ergebnis = {x2:0, x:0, zahl:0};
  for(const reihe of raster.zellen) for(const zelle of reihe) if(zelle.gefuellt) ergebnis[zelle.erwarteteArt] += zelle.erwartetesVorzeichen;
  return ergebnis;
}
/** Runde 21 (Punkt 8): alle bereits gefüllten Produkt-Zellen als flache Plättchen-Liste (EIN Eintrag je gefüllter Zelle, nicht zusammengefasst) – für den "Anwenden"-Knopf eines frei bedienbaren Malkreuzes. */
export function plaettchenAusRaster(raster){
  const ergebnis = [];
  for(const reihe of raster.zellen) for(const zelle of reihe) if(zelle.gefuellt) ergebnis.push({ kind: zelle.erwarteteArt, sign: zelle.erwartetesVorzeichen });
  return ergebnis;
}
export function spaltenBreite(kind){ return kind==='x' ? TILE_LONG : TILE_UNIT; }
export function zeilenHoehe(kind){ return kind==='x' ? TILE_LONG : TILE_UNIT; }
export function zellGeometrie(zeileKind, spalteKind){
  return { w:spaltenBreite(spalteKind), h:zeilenHoehe(zeileKind), vertical: zeileKind==='x' && spalteKind==='zahl' };
}

/* Runde 33 (Nutzer-Rückmeldung: "Ich kann dem Malkreuz Produktkärtchen
   hinzufügen, genauso wie ich Faktorkärtchen hinzufügen kann. Sie springen
   auf ein passendes Feld und ich muss am Ende die Passenden Faktorkärtchen
   hinzufügen."): vollständige Neufassung des produktfeld-ersten Einstiegs
   (ersetzt die Runde-30/31/32-Vormerkungs-Mechanismen). Ein vor jeder Achse
   abgelegtes Produktfeld-Plättchen bekommt seither einen (vorläufigen)
   Zeilen-/Spalten-Index in einem eigenen, rein geometrisch wachsenden
   Gitter zugewiesen – die Lernperson bestimmt die genaue Position selbst
   durch die Ablage (wie beim echten Legen von Plättchen zu einem
   Rechteck), das System errät dabei NIE eine Vorzeichen-/Faktor-Zerlegung
   (vgl. Runde 29, Punkt 3). Diese beiden Funktionen sind bewusst reine,
   von der UI-Komponente unabhängige Hilfsfunktionen, damit sich die
   Gitter-Geometrie unverändert sowohl für die Index-Bestimmung beim Ablegen
   als auch für das spätere Rendern verwenden lässt. */
export function berechneVorlaeufigeGitterGeometrie(ausstehendeProdukte, raster){
  const vorlaeufig = ausstehendeProdukte.filter(p => !p.mismatch);
  const maxZeile = vorlaeufig.reduce((m,p) => Math.max(m, p.zeile), -1);
  const maxSpalte = vorlaeufig.reduce((m,p) => Math.max(m, p.spalte), -1);
  const zeilenAnzahl = Math.max(raster.zeilen.length, maxZeile+1);
  const spaltenAnzahl = Math.max(raster.spalten.length, maxSpalte+1);

  const zeilenHoehenArr = [];
  for(let i=0; i<zeilenAnzahl; i+=1){
    if(i < raster.zeilen.length){ zeilenHoehenArr.push(zeilenHoehe(raster.zeilen[i].kind)); continue; }
    const hoehen = vorlaeufig.filter(p => p.zeile===i).map(p => effektiveVorlaeufigeMasse(p, ausstehendeProdukte, raster).h);
    zeilenHoehenArr.push(hoehen.length>0 ? Math.max(...hoehen) : TILE_UNIT);
  }
  const spaltenBreitenArr = [];
  for(let j=0; j<spaltenAnzahl; j+=1){
    if(j < raster.spalten.length){ spaltenBreitenArr.push(spaltenBreite(raster.spalten[j].kind)); continue; }
    const breiten = vorlaeufig.filter(p => p.spalte===j).map(p => effektiveVorlaeufigeMasse(p, ausstehendeProdukte, raster).w);
    spaltenBreitenArr.push(breiten.length>0 ? Math.max(...breiten) : TILE_UNIT);
  }
  const zeilenTopArr = []; let topLauf = 0;
  for(const h of zeilenHoehenArr){ zeilenTopArr.push(topLauf); topLauf += h; }
  const spaltenLeftArr = []; let leftLauf = 0;
  for(const w of spaltenBreitenArr){ spaltenLeftArr.push(leftLauf); leftLauf += w; }

  return { zeilenAnzahl, spaltenAnzahl, zeilenHoehenArr, spaltenBreitenArr, zeilenTopArr, spaltenLeftArr };
}
/* Bestimmt, zu welchem (bestehenden ODER neuen) Index entlang EINER Achse
   eine Ablageposition gehört: Trifft sie direkt ein bestehendes Intervall,
   gehört sie zu diesem Index. Liegt sie dahinter, aber noch nahe genug
   (gleiche Schwelle wie beim Stapel-Eröffnen auf der freien Tafel,
   TAFEL_STAPEL_NEU_SCHWELLE), zählt sie noch zum letzten bestehenden Index;
   weiter dahinter entsteht ein neuer, unmittelbar anschließender Index –
   nie einer VOR dem ersten, da Achsen/Zeilen/Spalten in dieser Anwendung
   grundsätzlich nur angehängt, nie vorangestellt werden (vgl. Runde 16). */
export function bestimmeVorlaeufigenIndex(position, intervalle, neueGroesse){
  if(intervalle.length===0) return 0;
  for(let idx=0; idx<intervalle.length; idx+=1){
    const [start, ende] = intervalle[idx];
    if(position>=start && position<ende) return idx;
  }
  const [letzterStart, letztesEnde] = intervalle[intervalle.length-1];
  if(position>=letztesEnde){
    const schwelle = Math.max(neueGroesse, letztesEnde-letzterStart) * TAFEL_STAPEL_NEU_SCHWELLE;
    return (position-letztesEnde<=schwelle) ? intervalle.length-1 : intervalle.length;
  }
  return 0;
}

/* Runde 34 (Nutzer-Rückmeldung: "Erkenne selbständig, ob, bei noch nicht
   allen bekannten Faktoren, die x-Plättchen senkrecht oder waagerecht
   stehen müssen. [...] Wenn ich ein x² schon habe, müssen alle x-Plättchen
   rechts und links davon stehen und alle oberhalb/unterhalb liegen. Wenn
   ich oben als faktor +1 habe, dann müssen die x-Plättchen auch stehen,
   und zwar alle in der selben Reihe."): Ein x-Produktplättchen im noch
   nicht vollständig befüllten Produktfeld kann nur dann sinnvoll als
   stehend ODER liegend erkannt werden, wenn mindestens EINE der beiden
   Achsen bereits eine bekannte Art besitzt – als "Anker" zählt dabei
   entweder eine bereits bestehende ECHTE Achse (raster.zeilen/-spalten)
   oder ein anderes, noch nicht fehlgeschlagenes x²-Produktplättchen in
   derselben Zeile bzw. Spalte (x² entsteht gemäß kombiniereArt NUR aus
   x·x, legt also BEIDE Achsen dort zwingend auf "x" fest). Ohne einen
   solchen Anker bleibt die Ausrichtung weiterhin unbestimmt (liegend wie
   bisher) – es wird an dieser Stelle NIE eine Vorzeichen- oder Faktor-
   Zerlegung erraten (vgl. Runde 29, Punkt 3), nur die aus bereits
   vorhandener Information zwingend folgende Ausrichtung sichtbar gemacht. */
export function ermittleAchsenArtAnZeile(zeile, ausstehendeProdukte, raster, ausschluss){
  if(raster.zeilen[zeile]) return raster.zeilen[zeile].kind;
  const hatX2Anker = ausstehendeProdukte.some((p) => !p.mismatch && p!==ausschluss && p.zeile===zeile && p.kind==='x2');
  return hatX2Anker ? 'x' : null;
}
export function ermittleAchsenArtAnSpalte(spalte, ausstehendeProdukte, raster, ausschluss){
  if(raster.spalten[spalte]) return raster.spalten[spalte].kind;
  const hatX2Anker = ausstehendeProdukte.some((p) => !p.mismatch && p!==ausschluss && p.spalte===spalte && p.kind==='x2');
  return hatX2Anker ? 'x' : null;
}
export function bestimmeVorlaeufigeAusrichtung(eintrag, ausstehendeProdukte, raster){
  if(eintrag.kind!=='x') return false;
  const zeileArt = ermittleAchsenArtAnZeile(eintrag.zeile, ausstehendeProdukte, raster, eintrag);
  if(zeileArt) return zeileArt==='x';
  const spalteArt = ermittleAchsenArtAnSpalte(eintrag.spalte, ausstehendeProdukte, raster, eintrag);
  if(spalteArt) return spalteArt==='zahl';
  return false;
}
export function effektiveVorlaeufigeMasse(eintrag, ausstehendeProdukte, raster){
  const {w, h} = tileDimensions(eintrag.kind, 1);
  return bestimmeVorlaeufigeAusrichtung(eintrag, ausstehendeProdukte, raster) ? {w:h, h:w} : {w, h};
}
/* Runde 34 (zweiter Teil derselben Rückmeldung: "Ausserdem soll nicht ein
   Produktplättchen rausgeschmissen werden wenn ich die Faktoren falsch
   einsetze, sondern man muss den passenden letzten Faktor einsetzen, der
   falsche wird nicht akzeptiert."): Da eine neue Zeile/Spalte stets ALLE
   ihr zugehörigen Zellen auf einen Schlag erzeugt und eine bereits
   bestehende Zeile/Spalte danach nie mehr verändert werden kann (nur
   angehängt, vgl. Runde 16), prüft diese Funktion VOR dem eigentlichen
   Anlegen, ob auch nur EINE der dadurch neu entstehenden Zellen einem
   bereits im Produktfeld liegenden, noch nicht fehlgeschlagenen Plättchen
   widerspricht – ist das der Fall, darf der gesamte neue Faktor gar nicht
   erst entstehen (siehe zeileHinzufuegen/spalteHinzufuegen), statt wie bis
   Runde 33 eine dauerhafte mismatch-Markierung zu erzeugen. */
export function konfliktMitAusstehenden(typ, istZeile, ausstehendeProdukte, raster){
  const andereAchse = istZeile ? raster.spalten : raster.zeilen;
  const neuerIndex = istZeile ? raster.zeilen.length : raster.spalten.length;
  for(let k=0; k<andereAchse.length; k+=1){
    const zeile = istZeile ? neuerIndex : k;
    const spalte = istZeile ? k : neuerIndex;
    const erwarteteArt = kombiniereArt(typ.kind, andereAchse[k].kind);
    const erwartetesVorzeichen = kombiniereVorzeichen(typ.sign, andereAchse[k].sign);
    const eintrag = ausstehendeProdukte.find((p) => !p.mismatch && p.zeile===zeile && p.spalte===spalte);
    if(eintrag && (eintrag.kind!==erwarteteArt || eintrag.sign!==erwartetesVorzeichen)) return true;
  }
  return false;
}

/* Runde 13: Raster, das per Andock-Geste Stück für Stück wächst (statt auf
   einen Schlag aus zwei bekannten Faktoren) – siehe README/Entwicklungs-
   protokoll "Wie die Andock-Geste funktioniert". */
export function erzeugeLeeresRaster(){ return { zeilen:[], spalten:[], zellen:[] }; }
export function fuegeZeileHinzu(raster, zeileTile){
  const i = raster.zeilen.length;
  raster.zeilen.push(zeileTile);
  raster.zellen.push(raster.spalten.map((spalte, j) => ({
    zeile:i, spalte:j,
    erwarteteArt: kombiniereArt(zeileTile.kind, spalte.kind),
    erwartetesVorzeichen: kombiniereVorzeichen(zeileTile.sign, spalte.sign),
    gefuellt:false,
  })));
  return raster;
}
export function fuegeSpalteHinzu(raster, spalteTile){
  const j = raster.spalten.length;
  raster.spalten.push(spalteTile);
  raster.zeilen.forEach((zeile, i) => {
    raster.zellen[i].push({
      zeile:i, spalte:j,
      erwarteteArt: kombiniereArt(zeile.kind, spalteTile.kind),
      erwartetesVorzeichen: kombiniereVorzeichen(zeile.sign, spalteTile.sign),
      gefuellt:false,
    });
  });
  return raster;
}
/* Runde 16 ("man muss Plättchen wieder wegnehmen dürfen"): Gegenstück zu
   fuegeZeileHinzu/fuegeSpalteHinzu – da Zeilen/Spalten nur ANGEHÄNGT werden,
   lässt sich konsequent auch nur die jeweils LETZTE wieder entfernen (LIFO). */
export function entferneLetzteZeile(raster){
  if(raster.zeilen.length===0) return raster;
  raster.zeilen.pop(); raster.zellen.pop();
  return raster;
}
export function entferneLetzteSpalte(raster){
  if(raster.spalten.length===0) return raster;
  raster.spalten.pop();
  for(const reihe of raster.zellen) reihe.pop();
  return raster;
}
