import { Board, TERM_REIHENFOLGE, TERM_SYMBOL, berechneDivision, berechneMultiplikation, ganzzahligeWurzel } from './rechnen.js';
import { nettoKoeffizienten } from './termParser.js';
import { baueKleinesFaktorproduktMalkreuz, mountGleichungLoesungErklaerung } from '../erklaerungen/module.js';
import { erzeugeFreieFlaeche } from '../shared/freieFlaeche.js';
import { TAFEL_REIHENFOLGE, berechneTafelLayout, createFreieTafel, gruppenSpalten } from '../shared/freieTafel.js';
import { erzeugeGleichungsKette } from '../shared/gleichungsKette.js';
import { styleFor } from '../shared/theme.js';

/* ============================================================
   Runde 19 (Nutzer-Vorgabe "Äquivalenzumformungen bei Gleichungen"):
   Fachliche Logik für "Auf beide Seiten anwenden" (entspricht
   .../engine/gleichungen.js). `wendeAufBeideSeitenAn` liefert die neuen
   ROHEN Plättchen-Bestände beider Seiten – absichtlich UNVEREINFACHT (die
   Schülerin/der Schüler löst entstehende Nullpaare selbst per Ziehen auf,
   siehe createFreieTafel), damit jeder Schritt nachvollziehbar bleibt.
   Multiplikation/Division nutzen dasselbe Gruppenmodell wie
   berechneMultiplikation/berechneDivision (keine symbolische
   Taschenrechner-Operation).
   ============================================================ */
export const GLEICHUNG_MAX_FAKTOR = 10;

export function formatiereOperation(operation){
  if(operation.typ==='addieren'){
    const anzahl = operation.anzahl ?? 1;
    const vorzeichen = operation.sign>0 ? '+' : '−';
    const symbol = TERM_SYMBOL[operation.kind];
    const koeffizient = operation.kind==='zahl' ? String(anzahl) : (anzahl>1 ? String(anzahl) : '');
    return `${vorzeichen}${koeffizient}${symbol}`;
  }
  if(operation.typ==='multiplizieren') return `· ${operation.faktor}`;
  if(operation.typ==='dividieren') return `: ${operation.faktor}`;
  // Runde 24 (Punkt 7, Nutzer-Rückmeldung "Gleichungen Äquivalenz option
  // ×(-1). Dreht die Vorzeichen um und dadurch auch die Farben"): eigene,
  // einfachere Operation statt "· multiplizieren" mit Faktor -1 – dreht auf
  // BEIDEN Seiten jedes Plättchen-Vorzeichen um (Anzahl bleibt gleich), die
  // Farbe folgt automatisch, da sie am Vorzeichen hängt (siehe styleFor).
  if(operation.typ==='vorzeichenUmkehren') return '× (−1)';
  return '';
}

export function multipliziereTilesGleichung(tiles, faktor){
  const ergebnis = [];
  for(let gruppe=1; gruppe<=faktor; gruppe+=1){
    for(const tile of tiles) ergebnis.push({ kind:tile.kind, sign:tile.sign, gruppe });
  }
  return ergebnis;
}

export function istOhneRestTeilbar(tiles, faktor){
  const netto = nettoKoeffizienten(tiles);
  return TERM_REIHENFOLGE.every((kind) => netto[kind] % faktor === 0);
}

export function teileTilesGleichung(tiles, faktor){
  const netto = nettoKoeffizienten(tiles);
  const ergebnis = [];
  for(const kind of TERM_REIHENFOLGE){
    const anteil = netto[kind] / faktor;
    if(anteil===0) continue;
    const sign = anteil>0 ? 1 : -1;
    for(let i=0; i<Math.abs(anteil); i+=1) ergebnis.push({ kind, sign, gruppe:1 });
  }
  return ergebnis;
}

export function wendeAufBeideSeitenAn(linksTiles, rechtsTiles, operation){
  if(operation.typ==='addieren'){
    const anzahl = operation.anzahl ?? 1;
    const neuePlaettchen = Array.from({ length:anzahl }, () => ({ kind:operation.kind, sign:operation.sign }));
    return {
      links: [...linksTiles, ...neuePlaettchen],
      rechts: [...rechtsTiles, ...neuePlaettchen.map((t) => ({ ...t }))],
      fehler: null,
    };
  }
  if(operation.typ==='multiplizieren'){
    return {
      links: multipliziereTilesGleichung(linksTiles, operation.faktor),
      rechts: multipliziereTilesGleichung(rechtsTiles, operation.faktor),
      fehler: null,
    };
  }
  if(operation.typ==='dividieren'){
    const linksOk = istOhneRestTeilbar(linksTiles, operation.faktor);
    const rechtsOk = istOhneRestTeilbar(rechtsTiles, operation.faktor);
    if(!linksOk || !rechtsOk){
      const seiten = [!linksOk ? 'linken' : null, !rechtsOk ? 'rechten' : null].filter(Boolean).join(' und ');
      return {
        links: null, rechts: null, fehler: 'nicht-teilbar',
        hinweis: `Auf der ${seiten} Seite lässt sich die aktuelle Plättchen-Anzahl nicht ohne Rest durch ${operation.faktor} teilen. Wähle einen anderen Faktor, oder löse zuerst vorhandene Nullpaare auf.`,
      };
    }
    return {
      links: teileTilesGleichung(linksTiles, operation.faktor),
      rechts: teileTilesGleichung(rechtsTiles, operation.faktor),
      fehler: null,
    };
  }
  if(operation.typ==='vorzeichenUmkehren'){
    return {
      links: linksTiles.map((t) => ({ kind:t.kind, sign:-t.sign })),
      rechts: rechtsTiles.map((t) => ({ kind:t.kind, sign:-t.sign })),
      fehler: null,
    };
  }
  throw new Error(`Unbekannte Operation: ${operation.typ}`);
}

/* Runde 24 (Punkt 13, Nutzer-Rückmeldung: Schieberegler -5..+5, "wenn man
   auf anwenden drückt, soll x den Wert des Schiebereglers annehmen"):
   ersetzt in einer Kachel-Liste jedes x/x²-Plättchen durch die gleichwertige
   Anzahl Zahl-Plättchen, wenn x konkret den Wert `wert` annimmt. Der Beitrag
   eines einzelnen Plättchens ist tileSign * wert^potenz (potenz 1 bei 'x',
   2 bei 'x2') – daraus ergeben sich |Beitrag| neue Zahl-Plättchen mit dem
   Vorzeichen des Beitrags (Beitrag 0, z.B. wert=0 bei 'x', ergibt gar keine
   Plättchen). +1-Plättchen ('zahl') bleiben unverändert. Genutzt sowohl von
   der freien Terme-Fläche (erzeugeFreieFlaeche) als auch von der
   Gleichungs-Kette (erzeugeGleichungsKette). */
// Runde 25 (Punkt 6, Nutzer-Rückmeldung: "Wenn x eingesetzt wird, soll der
// Stapel sich nicht direkt mit den anderen +/-1 zusammensetzen sondern
// seinen eigenen Stapel erst einmal haben"): bereits vorhandene Zahl-
// Plättchen (z.B. die "+3" bei x²+2x+3) behalten ihren bisherigen Stapel.
//
// Runde 29 (Punkt 2, Nutzer-Rückmeldung: "Wenn eine Zahl für x eingesetzt
// wird, soll dieser Stapel auch an der selben Stelle bleiben. Im Moment
// erscheint der Stapel rechts von den +/-1 Stapel. Es soll erkennbar sein,
// welcher Stapel aus den x-Plättchen kommt. Bedeutet auch, dass, wenn wir 2
// x-Stapel haben, müssen auch 2 +/-1 Stapel dafür erscheinen (genauso auch
// bei x²)."): bis Runde 28 wurden ALLE x-/x²-Plättchen (unabhängig davon, zu
// welchem ursprünglichen Stapel sie gehörten) zu einem einzigen,
// gemeinsamen neuen Stapel pro Vorzeichen zusammengefasst – und dieser
// erschien, weil "neuester Stapel" stets den HÖCHSTEN Index bekam, rechts
// von (statt wie gewünscht an der Stelle von) den bereits vorhandenen
// Zahl-Stapeln. Seither wird JEDER ursprüngliche x-/x²-Stapel (Gruppe
// gleicher Art+Vorzeichen+Stapel-Index) EINZELN ausgewertet und ergibt
// einen eigenen neuen Zahl-Stapel – mehrere getrennte x-Stapel ergeben
// also auch mehrere getrennte Zahl-Stapel statt eines gemeinsamen. Diese
// neuen Stapel bekommen bewusst NEGATIVE Indizes (kleiner als jeder
// bestehende Zahl-Stapel, der stets bei 0 beginnt) – in gruppenSpalten
// (aufsteigend sortiert) rücken sie dadurch an den Anfang der Zahl-Gruppe,
// also genau an die Stelle, an der zuvor die x-/x²-Gruppe stand (die
// Kind-Reihenfolge TAFEL_REIHENFOLGE = [x2, x, zahl] platziert die
// Zahl-Gruppe ohnehin unmittelbar nach der x-Gruppe). Zusätzlich markiert
// `ausEinsetzen:true` jedes neu entstandene Plättchen – createFreieTafel
// rendert dafür eine eigene, erkennbare Markierung (seit Runde 30 ein
// durchgängiger Rahmen um die GESAMTE Gruppe, siehe
// ".freie-tafel__einsetzen-rahmen"). Die aufrufende Stelle muss sowohl
// den zurückgegebenen `stapel`-Wert als auch `ausEinsetzen` über
// ersetzeAlleTiles ans Board durchreichen, damit beides auch sichtbar wird.
export function setzeXWertEin(tiles, wert){
  const passDurch = [];
  // Ursprüngliche x-/x²-Stapel in fester, stabiler Reihenfolge einsammeln:
  // zuerst alle x²-Stapel (aufsteigend), danach alle x-Stapel (aufsteigend) –
  // dieselbe Reihenfolge, in der sie am Stapel-Modell auch nebeneinander
  // stehen (TAFEL_REIHENFOLGE).
  const quellStapelListe = []; // { sign, stapel, anzahl, potenz, kind }
  for(const kind of ['x2', 'x']){
    const gruppen = new Map(); // `${sign}|${stapel}` -> anzahl
    for(const t of tiles){
      if(t.kind!==kind) continue;
      const stapel = t.stapel ?? 0;
      const key = `${t.sign}|${stapel}`;
      gruppen.set(key, (gruppen.get(key) ?? 0) + 1);
    }
    const keys = [...gruppen.keys()].sort((a,b) => {
      const [signA, stapelA] = a.split('|').map(Number);
      const [signB, stapelB] = b.split('|').map(Number);
      return signA!==signB ? signB-signA : stapelA-stapelB; // + vor −, dann aufsteigend
    });
    for(const key of keys){
      const [sign, stapel] = key.split('|').map(Number);
      quellStapelListe.push({ sign, stapel, anzahl: gruppen.get(key), potenz: kind==='x2' ? 2 : 1, kind });
    }
  }
  for(const t of tiles){
    if(t.kind==='zahl') passDurch.push({ kind:'zahl', sign:t.sign, stapel:t.stapel ?? 0 });
  }

  // Für jeden ursprünglichen x-/x²-Stapel GETRENNT den Beitrag berechnen und
  // (falls ungleich 0) einen eigenen neuen Zahl-Stapel vormerken. Runde 32
  // (Nutzer-Rückmeldung: "Die Umrandung der +/-1 Plättchen durch einsetzen
  // von x als Zahl soll die selbe Farbe haben wie das Plättchen aus der sie
  // entstanden sind"): herkunftKind/herkunftSign (das URSPRÜNGLICHE
  // x-/x²-Plättchen – NICHT notwendig dasselbe Vorzeichen wie der neue
  // Zahl-Stapel, falls `wert` negativ ist) wird mitgeführt, damit render()
  // später die Rahmenfarbe daraus bestimmen kann (siehe
  // berechneTafelLayout/einsetzenRahmen und createFreieTafel).
  const neueGruppen = []; // { sign, anzahl, herkunftKind, herkunftSign } in quellStapelListe-Reihenfolge
  for(const quelle of quellStapelListe){
    const beitrag = quelle.anzahl * quelle.sign * (wert**quelle.potenz);
    if(beitrag===0) continue;
    neueGruppen.push({ sign: beitrag>0 ? 1 : -1, anzahl: Math.abs(beitrag), herkunftKind: quelle.kind, herkunftSign: quelle.sign });
  }

  const neu = [];
  for(const zielSign of [1,-1]){
    const bestehendeStapel = passDurch.filter(t => t.sign===zielSign).map(t => t.stapel);
    const baseMin = bestehendeStapel.length>0 ? Math.min(...bestehendeStapel) : 0;
    const gruppenDiesesVorzeichens = neueGruppen.filter(g => g.sign===zielSign);
    gruppenDiesesVorzeichens.forEach((gruppe, index) => {
      const stapel = baseMin - gruppenDiesesVorzeichens.length + index;
      for(let i=0; i<gruppe.anzahl; i+=1){
        neu.push({
          kind:'zahl', sign:zielSign, stapel, ausEinsetzen:true,
          ausEinsetzenKind: gruppe.herkunftKind, ausEinsetzenSign: gruppe.herkunftSign,
        });
      }
    });
  }
  return [...passDurch, ...neu];
}

export function tilesAusKoeffizient(koeffizient, kind){
  if(koeffizient===0) return [];
  const sign = koeffizient<0 ? -1 : 1;
  const tiles = [];
  for(let i=0; i<Math.abs(koeffizient); i+=1) tiles.push({ kind, sign });
  return tiles;
}
/** Wie tilesAusKoeffizient, aber für ein vollständiges {x2,x,zahl}-Koeffizienten-Objekt auf einen Schlag (Runde 30, Punkt 1). */
export function tilesAusKoeffizienten(koeffizienten){
  return [
    ...tilesAusKoeffizient(koeffizienten.x2, 'x2'),
    ...tilesAusKoeffizient(koeffizienten.x, 'x'),
    ...tilesAusKoeffizient(koeffizienten.zahl, 'zahl'),
  ];
}

export function formatiereKoeffizientForm(netto){
  const wert = netto.x2!==0 ? netto.x2 : netto.x!==0 ? netto.x : netto.zahl;
  return String(wert);
}

/** Plant den Lösungsweg für "a·kind + b = c" (kind='x'|'x2', a≥1) für die geführte Erklärung "Gleichungen" – bewusste Scope-Entscheidung, siehe Entwicklungsprotokoll Runde 19. */
export function planeGleichungsLoesung(kind, a, b, c){
  // Runde 37 (Punkt 2, Nutzer-Rückmeldung): a darf jetzt auch negativ sein
  // (nur a=0 bleibt ausgeschlossen, da x/x² dann ganz verschwände). aText
  // zeigt für |a|=1 nur noch das Vorzeichen (−x statt −1x), für alles
  // andere weiterhin die volle Zahl.
  if(!Number.isInteger(a) || a===0) return { schritte:null, fehler:'a-ungueltig' };

  let links = tilesAusKoeffizient(a, kind);
  links = links.concat(tilesAusKoeffizient(b, 'zahl'));
  let rechts = tilesAusKoeffizient(c, 'zahl');

  const symbol = TERM_SYMBOL[kind];
  const aText = a===1 ? '' : a===-1 ? '−' : a<0 ? `−${Math.abs(a)}` : String(a);
  const schritte = [{
    typ:'start', links:[...links], rechts:[...rechts],
    label:`Start: ${aText}${symbol} ${b>=0 ? '+' : '−'} ${Math.abs(b)} = ${c}`,
  }];

  if(b!==0){
    const operation = { typ:'addieren', kind:'zahl', sign: b>0 ? -1 : 1, anzahl: Math.abs(b) };
    const ergebnis = wendeAufBeideSeitenAn(links, rechts, operation);
    schritte.push({ typ:'umformung', operation, links:ergebnis.links, rechts:ergebnis.rechts,
      label:`${formatiereOperation(operation)} auf beiden Seiten anwenden.` });
    const linksNetto = nettoKoeffizienten(ergebnis.links);
    const rechtsNetto = nettoKoeffizienten(ergebnis.rechts);
    links = [...tilesAusKoeffizient(linksNetto.x2,'x2'), ...tilesAusKoeffizient(linksNetto.x,'x'), ...tilesAusKoeffizient(linksNetto.zahl,'zahl')];
    rechts = [...tilesAusKoeffizient(rechtsNetto.x2,'x2'), ...tilesAusKoeffizient(rechtsNetto.x,'x'), ...tilesAusKoeffizient(rechtsNetto.zahl,'zahl')];
    schritte.push({ typ:'vereinfachen', links:[...links], rechts:[...rechts], label:'Nullpaare auflösen.' });
  }

  if(a!==1){
    const operation = { typ:'dividieren', faktor:a };
    const ergebnis = wendeAufBeideSeitenAn(links, rechts, operation);
    if(ergebnis.fehler) return { schritte:null, fehler:'nicht-teilbar' };
    links = ergebnis.links; rechts = ergebnis.rechts;
    schritte.push({ typ:'umformung', operation, links:[...links], rechts:[...rechts],
      label:`${formatiereOperation(operation)} auf beiden Seiten anwenden.` });
  }

  if(kind==='x2'){
    // Runde 21 (Punkt 1: "man muss am Ende auch auf x=_ kommen –
    // Wurzelziehen muss vorkommen"): x² = wert ist noch NICHT die Lösung,
    // sondern ein Zwischenschritt. Wurzelziehen liefert ZWEI Lösungen
    // (+√wert und −√wert), auf Nutzer-Vorgabe ("Zwei vollständig parallele
    // Lösungswege") beide gleichzeitig nebeneinander dargestellt (typ
    // 'wurzel-ergebnis' mit `zweige`, siehe mountGleichungErklaerung).
    const wert = nettoKoeffizienten(rechts).zahl;
    schritte.push({ typ:'zwischenergebnis', links:[...links], rechts:[...rechts], label:`Zwischenergebnis: x² = ${wert}` });

    const wurzel = ganzzahligeWurzel(wert);
    if(wurzel===null) return { schritte:null, fehler: wert<0 ? 'keine-loesung' : 'keine-ganzzahlige-wurzel' };

    if(wurzel===0){
      // Sonderfall: +0 und −0 sind dieselbe Zahl – nur EINE Lösung.
      schritte.push({ typ:'ergebnis', links:[{kind:'x', sign:1}], rechts:[],
        label:'Wurzel ziehen: x² = 0 → x = 0 (einzige Lösung, da √0 = 0).' });
    } else {
      schritte.push({
        typ:'wurzel-ergebnis',
        label:`Wurzel ziehen: x² = ${wert} → x = ±√${wert} = ±${wurzel}. Da sowohl (+${wurzel})² als auch (−${wurzel})² wieder ${wert} ergeben, hat die Gleichung ZWEI Lösungen.`,
        zweige: [
          { label:`Lösungsweg 1: x = +√${wert} = +${wurzel}`, links:[{kind:'x', sign:1}], rechts:tilesAusKoeffizient(wurzel,'zahl'), malkreuz:{anzahl:wurzel, sign:1} },
          { label:`Lösungsweg 2: x = −√${wert} = −${wurzel}`, links:[{kind:'x', sign:1}], rechts:tilesAusKoeffizient(-wurzel,'zahl'), malkreuz:{anzahl:wurzel, sign:-1} },
        ],
      });
    }
  } else {
    schritte.push({ typ:'ergebnis', links:[...links], rechts:[...rechts],
      label:`Ergebnis: ${symbol} = ${formatiereKoeffizientForm(nettoKoeffizienten(rechts))}` });
  }
  return { schritte, fehler:null };
}

export function vorzeichenTextGE(n){ return n>=0 ? '+' : '−'; }

/* Höchste noch sinnvoll als kleines Beleg-Malkreuz darstellbare Kettenlänge
   einer Faktor-Klammer – siehe baueKleinesFaktorproduktMalkreuz. Von
   planeAusklammernLoesung (Klammer a·x+b) UND
   planeQuadratischeErgaenzungGleichungLoesung (Klammer x±seitenAnzahl)
   gemeinsam genutzt. */
export const GE_BELEG_MALKREUZ_MAX = 12;

/**
 * Plant den Lösungsweg für `a·x² + b·x = 0` (Runde 22 Punkt 5, zweites
 * Unterkapitel) über AUSKLAMMERN + NULLPRODUKT: `x·(a·x + b) = 0`. Ein
 * Produkt ist genau dann 0, wenn (mindestens) einer der Faktoren 0 ist –
 * daraus ergeben sich zwei parallele Lösungswege (dasselbe zweige-Muster wie
 * beim Wurzelziehen): x = 0 ODER a·x + b = 0.
 * Runde 23 (Punkt 7, Nutzer-Rückmeldung): da es HIER kein konstantes Glied
 * gibt (c = 0, anders als bei der vollständigen quadratischen Gleichung),
 * reicht einfaches Ausklammern – das Malkreuz der beiden Nullprodukt-
 * Lösungswege zeigt das jeweils direkt: eine ganze Achse (ein ganzer Faktor)
 * bleibt leer, wodurch das Produkt-Raster selbst leer (= 0) wird.
 */
export function planeAusklammernLoesung(a, b){
  // Runde 37 (Punkt 2): a darf auch negativ sein (nur a=0 ausgeschlossen).
  if(!Number.isInteger(a) || a===0) return { schritte:null, fehler:'a-ungueltig' };
  if(!Number.isInteger(b)) return { schritte:null, fehler:'b-ungueltig' };

  const links = [...tilesAusKoeffizient(a,'x2'), ...tilesAusKoeffizient(b,'x')];
  const aText = a===1 ? '' : a===-1 ? '−' : a<0 ? `−${Math.abs(a)}` : String(a);
  const klammerText = `(${aText}x ${vorzeichenTextGE(b)} ${Math.abs(b)})`;
  const schritte = [{ typ:'start', links:[...links], rechts:[], label:`Start: ${aText}x² ${vorzeichenTextGE(b)} ${Math.abs(b)}x = 0 – kein konstantes Glied (c = 0).` }];

  // Runde 25 (Punkt 3, Nutzer-Rückmeldung: "Erklärung von ax²+bx=0. Stelle
  // das Malkreuz auf, dann erkläre dass entweder Faktor a/b=0 sein muss. -->
  // wann ist x=0 wann ist Klammer=0"): die Klammer (a·x+b) wird schon HIER
  // (vor dem eigentlichen Nullprodukt-Argument) als eigenes Malkreuz-Beleg
  // eingeführt – x·(a·x+b) als vollständiges Produkt-Rechteck, GENAU wie das
  // Ausklammern es behauptet. Bleibt ab jetzt stehen (Runde 24 Punkt 5), so
  // dass beim folgenden Nullprodukt-Argument direkt auf die beiden Achsen
  // (x bzw. die Klammer) gezeigt werden kann.
  const klammerTiles = [...tilesAusKoeffizient(a,'x'), ...tilesAusKoeffizient(b,'zahl')];
  const klammerPasstInsMalkreuz = klammerTiles.length>0 && klammerTiles.length<=GE_BELEG_MALKREUZ_MAX;

  schritte.push({ typ:'ausklammern', links:[...links], rechts:[],
    label:`x ausklammern: beide Summanden enthalten den Faktor x, also x · ${klammerText} = 0. Es gibt keine Klammer für eine Konstante – die entfiele hier (c = 0). Das Malkreuz zeigt dieses Produkt: eine Achse ist x, die andere die Klammer ${klammerText}.`,
    malkreuzBeleg: klammerPasstInsMalkreuz ? {
      zeilenTiles:[{kind:'x', sign:1}], spaltenTiles: klammerTiles,
      zeilenLabel:'x', spaltenLabel: klammerText,
      hinweis: 'Beleg am Malkreuz: x · ' + klammerText,
    } : undefined,
  });

  if(b===0){
    schritte.push({ typ:'ergebnis', links:[{kind:'x', sign:1}], rechts:[],
      label:`x = 0 (einzige, doppelte Lösung, da bereits ${aText}x² = 0 dastand).` });
    return { schritte, fehler:null };
  }

  schritte.push({ typ:'nullprodukt', links:[...links], rechts:[],
    label:`Nullprodukt-Eigenschaft: ein Produkt ist genau dann 0, wenn (mindestens) einer der Faktoren 0 ist. Am Malkreuz heißt das: die ganze Fläche (das Produkt) wird nur dann leer, wenn eine ganze Achse leer bleibt – also entweder die x-Achse (x = 0) ODER die Klammer-Achse (${klammerText} = 0, also ${aText}x ${vorzeichenTextGE(b)} ${Math.abs(b)} = 0). Wann ist welcher Fall gemeint? x = 0 macht die STEHENDE Achse leer, ${klammerText} = 0 macht die LIEGENDE Achse leer – nie beide gleichzeitig nötig.` });

  if(b%a !== 0) return { schritte:null, fehler:'nicht-teilbar' };
  const loesung2 = -b/a;

  // Beide Zweige am Malkreuz: EINE Achse bleibt bewusst leer (= der Faktor,
  // der für diesen Lösungsweg 0 ist) – "Malkreuz aufstellen mit allem bis
  // auf die x" heißt hier: die Klammer (a·x + b) kommt konkret ans Malkreuz,
  // die x-Achse bleibt offen/leer, bis geklärt ist, was für x eingesetzt
  // werden muss, damit das Produkt-Raster leer (= 0) wird. (klammerTiles und
  // klammerPasstInsMalkreuz wurden schon oben beim 'ausklammern'-Schritt
  // berechnet, siehe dort.)

  // Runde 36 (Punkt 4, Nutzer-Rückmeldung: Bsp. x(2x+6)=0 --> x=0 UND
  // 2x+6=0, nicht schon x=-3): beide Lösungswege zeigen zuerst den
  // kompletten Faktor als EIGENE, noch nicht aufgelöste Gleichung – erst
  // der nachfolgende Schritt löst die zweite Gleichung nach x auf. Genau
  // dasselbe zweistufige Muster wie bei 'wurzel-gezogen'/'wurzel-ergebnis'
  // weiter unten in planeQuadratischeErgaenzungGleichungLoesung.
  schritte.push({
    typ:'nullprodukt-gleichungen',
    label:`Beide Faktoren einzeln zu 0 gesetzt ergeben zwei Gleichungen: x = 0 ODER ${aText}x ${vorzeichenTextGE(b)} ${Math.abs(b)} = 0.`,
    zweige: [
      {
        label:'Gleichung 1 (erster Faktor): x = 0', links:[{kind:'x', sign:1}], rechts:[],
        ...(klammerPasstInsMalkreuz ? { faktorMalkreuz: {
          zeilenTiles:[], spaltenTiles:klammerTiles,
          zeilenLabel:'x (= 0, leer)', spaltenLabel:klammerText,
        } } : {}),
      },
      {
        label:`Gleichung 2 (zweiter Faktor): ${aText}x ${vorzeichenTextGE(b)} ${Math.abs(b)} = 0 – noch nicht nach x aufgelöst.`,
        links:[...tilesAusKoeffizient(a,'x'), ...tilesAusKoeffizient(b,'zahl')], rechts:[],
        faktorMalkreuz: {
          zeilenTiles:[{kind:'x', sign:1}], spaltenTiles:[],
          zeilenLabel:'x', spaltenLabel:`${klammerText} (= 0, leer)`,
        },
      },
    ],
  });
  schritte.push({
    typ:'nullprodukt-ergebnis',
    label:`Jede der beiden Gleichungen nach x auflösen: das ergibt zwei Lösungen: x = 0 ODER x = ${loesung2}.`,
    zweige: [
      { label:'Lösungsweg 1 (erster Faktor): x = 0', links:[{kind:'x', sign:1}], rechts:[] },
      { label:`Lösungsweg 2 (zweiter Faktor): ${aText}x ${vorzeichenTextGE(b)} ${Math.abs(b)} = 0 → x = ${loesung2}`,
        links:[{kind:'x', sign:1}], rechts:tilesAusKoeffizient(loesung2,'zahl') },
    ],
  });

  return { schritte, fehler:null };
}

/**
 * Plant den Lösungsweg für die allgemeine quadratische Gleichung
 * `a·x² + b·x + c = 0` (Runde 22 Punkt 5, drittes Unterkapitel) AUSDRÜCKLICH
 * über QUADRATISCHE ERGÄNZUNG – NICHT über die abc- oder pq-Formel.
 * 1. (falls a≠1) durch a teilen → x²+px+q=0 (braucht b,c ganzzahlig durch a
 *    teilbar, sonst Fehler 'nicht-teilbar-a').
 * 2. (falls q≠0) q auf die andere Seite bringen.
 * 3. p muss gerade sein (sonst Fehler 'p-ungerade').
 * 4. Auf BEIDEN Seiten (p/2)² ergänzen – links entsteht ein vollständiges Quadrat.
 * 5. Wurzelziehen wie bei planeGleichungsLoesung: ZWEI parallele Lösungswege,
 *    außer bei Rest=0 (eine doppelte Lösung) oder Rest<0/keine Quadratzahl (Fehler).
 */
export function planeQuadratischeErgaenzungGleichungLoesung(a, b, c){
  if(!Number.isInteger(a) || a===0) return { schritte:null, fehler:'a-ungueltig' };
  if(!Number.isInteger(b)) return { schritte:null, fehler:'b-ungueltig' };
  if(!Number.isInteger(c)) return { schritte:null, fehler:'c-ungueltig' };

  let links = [...tilesAusKoeffizient(a,'x2'), ...tilesAusKoeffizient(b,'x'), ...tilesAusKoeffizient(c,'zahl')];
  let rechts = [];
  const aText = a===1 ? '' : a===-1 ? '−' : a<0 ? `−${Math.abs(a)}` : String(a);
  const schritte = [{ typ:'start', links:[...links], rechts:[...rechts], label:`Start: ${aText}x² ${vorzeichenTextGE(b)} ${Math.abs(b)}x ${vorzeichenTextGE(c)} ${Math.abs(c)} = 0` }];

  let p = b, q = c;

  if(a!==1){
    if(b%a!==0 || c%a!==0) return { schritte:null, fehler:'nicht-teilbar-a' };
    const operation = { typ:'dividieren', faktor:a };
    const ergebnis = wendeAufBeideSeitenAn(links, rechts, operation);
    links = ergebnis.links; rechts = ergebnis.rechts;
    p = b/a; q = c/a;
    schritte.push({ typ:'umformung', operation, links:[...links], rechts:[...rechts],
      label:`${formatiereOperation(operation)} auf beiden Seiten anwenden, um x² einen Koeffizienten von 1 zu geben: x² ${vorzeichenTextGE(p)} ${Math.abs(p)}x ${vorzeichenTextGE(q)} ${Math.abs(q)} = 0.` });
  }

  if(p%2 !== 0) return { schritte:null, fehler:'p-ungerade' };

  if(q!==0){
    const operation = { typ:'addieren', kind:'zahl', sign: q>0 ? -1 : 1, anzahl:Math.abs(q) };
    const ergebnis = wendeAufBeideSeitenAn(links, rechts, operation);
    schritte.push({ typ:'umformung', operation, links:ergebnis.links, rechts:ergebnis.rechts,
      label:`${formatiereOperation(operation)} auf beiden Seiten anwenden, um die Zahl auf die andere Seite zu bringen.` });
    const linksNetto = nettoKoeffizienten(ergebnis.links);
    const rechtsNetto = nettoKoeffizienten(ergebnis.rechts);
    links = [...tilesAusKoeffizient(linksNetto.x2,'x2'), ...tilesAusKoeffizient(linksNetto.x,'x')];
    rechts = tilesAusKoeffizient(rechtsNetto.zahl,'zahl');
    schritte.push({ typ:'vereinfachen', links:[...links], rechts:[...rechts],
      label:`Nullpaare auflösen: x² ${vorzeichenTextGE(p)} ${Math.abs(p)}x = ${vorzeichenTextGE(-q)} ${Math.abs(q)}.` });
  }

  const half = p/2;
  const seitenAnzahl = Math.abs(half);
  const ergaenzung = seitenAnzahl*seitenAnzahl;
  const vorzeichenHalf = half>=0 ? '+' : '−';

  // Runde 23 (Punkt 8, Nutzer-Rückmeldung): der frühere Text-Einschub
  // ("Quadratische Ergänzung (bewusst NICHT die abc- oder pq-Formel): wir
  // ergänzen auf BEIDEN Seiten …") entfällt – stattdessen zeigt ein eigenes,
  // kleines Malkreuz (dieselbe Klammer (x ± seitenAnzahl) mit sich selbst
  // multipliziert, "die beiden Klammern"), WIE das vollständige Quadrat
  // x² ± px + (p/2)² überhaupt zustande kommt, bevor wir +ergaenzung auf
  // beiden Seiten anwenden. Siehe baueKleinesFaktorproduktMalkreuz/
  // frame.malkreuzBeleg in mountGleichungLoesungErklaerung.
  const klammerTextQe = `(x ${vorzeichenHalf} ${seitenAnzahl})`;
  const faktorTilesQe = [{kind:'x', sign:1}];
  for(let i=0;i<seitenAnzahl;i+=1) faktorTilesQe.push({kind:'zahl', sign:half<0 ? -1 : 1});
  schritte.push({ typ:'qe-malkreuz-quadrat', links:[...links], rechts:[...rechts],
    label:`Mit dem Malkreuz sehen wir, wie das vollständige Quadrat entsteht: dieselbe Klammer ${klammerTextQe} wird mit sich selbst multipliziert – daher „die beiden Klammern" ${klammerTextQe}·${klammerTextQe}. Das Malkreuz liefert genau x² ${vorzeichenTextGE(p)} ${Math.abs(p)}x + ${ergaenzung}. Genau dieses +${ergaenzung} ergänzen wir jetzt auf BEIDEN Seiten der Gleichung.`,
    malkreuzBeleg: faktorTilesQe.length<=GE_BELEG_MALKREUZ_MAX ? {
      zeilenTiles: faktorTilesQe, spaltenTiles: faktorTilesQe,
      zeilenLabel: klammerTextQe, spaltenLabel: klammerTextQe,
      hinweis: 'Beleg am Malkreuz: woher das Quadrat kommt',
    } : undefined,
  });

  const ergaenzenOp = { typ:'addieren', kind:'zahl', sign:1, anzahl:ergaenzung };
  const ergaenzenErgebnis = wendeAufBeideSeitenAn(links, rechts, ergaenzenOp);
  schritte.push({ typ:'umformung', operation:ergaenzenOp, links:ergaenzenErgebnis.links, rechts:ergaenzenErgebnis.rechts,
    label:`${formatiereOperation(ergaenzenOp)} auf beiden Seiten anwenden.` });
  const linksNettoQe = nettoKoeffizienten(ergaenzenErgebnis.links);
  const rechtsNettoQe = nettoKoeffizienten(ergaenzenErgebnis.rechts);
  links = [...tilesAusKoeffizient(linksNettoQe.x2,'x2'), ...tilesAusKoeffizient(linksNettoQe.x,'x'), ...tilesAusKoeffizient(linksNettoQe.zahl,'zahl')];
  const rest = rechtsNettoQe.zahl;
  rechts = tilesAusKoeffizient(rest,'zahl');
  schritte.push({ typ:'quadrat-erkannt', links:[...links], rechts:[...rechts],
    label:`Die linke Seite ist jetzt ein vollständiges Quadrat: x² ${vorzeichenTextGE(p)} ${Math.abs(p)}x + ${ergaenzung} = (x ${vorzeichenHalf} ${seitenAnzahl})². Zwischenergebnis: (x ${vorzeichenHalf} ${seitenAnzahl})² = ${rest}.` });

  if(rest<0) return { schritte:null, fehler:'keine-loesung' };
  const wurzel = ganzzahligeWurzel(rest);
  if(wurzel===null) return { schritte:null, fehler:'keine-ganzzahlige-wurzel' };

  if(wurzel===0){
    schritte.push({ typ:'ergebnis', links:[{kind:'x', sign:1}], rechts:tilesAusKoeffizient(-half,'zahl'),
      label:`Wurzel ziehen: (x ${vorzeichenHalf} ${seitenAnzahl})² = 0 → x ${vorzeichenHalf} ${seitenAnzahl} = 0 → x = ${-half} (einzige, doppelte Lösung, da √0 = 0).` });
  } else {
    // Runde 24 (Punkt 6, Nutzer-Rückmeldung): nach dem Wurzelziehen wird NICHT
    // mehr sofort nach x aufgelöst – zuerst zeigt ein eigener Schritt nur die
    // Gleichung direkt nach dem Wurzelziehen (x ± seitenAnzahl = ±wurzel, noch
    // UNAUFGELÖST), erst der darauf folgende Schritt löst sie nach x auf.
    // Runde 36 (Punkt 3, Nutzer-Rückmeldung): das Malkreuz zum BEWEIS der
    // Wurzel (dass √${rest} tatsächlich ${wurzel} ergibt) muss in dem
    // Schritt stehen, in dem die Wurzel gezogen wird – NICHT erst danach,
    // wenn die Gleichung schon nach x umgestellt ist. Das Feld `malkreuz`
    // wandert deshalb von 'wurzel-ergebnis' zu 'wurzel-gezogen'.
    schritte.push({
      typ:'wurzel-gezogen',
      label:`Wurzel ziehen: (x ${vorzeichenHalf} ${seitenAnzahl})² = ${rest} → x ${vorzeichenHalf} ${seitenAnzahl} = ±√${rest} = ±${wurzel}. Das Malkreuz belegt, dass ${wurzel}·${wurzel} = ${rest} ist. Das ergibt ZWEI (noch nicht aufgelöste) Gleichungen.`,
      zweige: [
        { label:`Gleichung 1: x ${vorzeichenHalf} ${seitenAnzahl} = +${wurzel}`, links:[{kind:'x', sign:1}, ...tilesAusKoeffizient(half,'zahl')], rechts:tilesAusKoeffizient(wurzel,'zahl'), malkreuz:{anzahl:wurzel, sign:1} },
        { label:`Gleichung 2: x ${vorzeichenHalf} ${seitenAnzahl} = −${wurzel}`, links:[{kind:'x', sign:1}, ...tilesAusKoeffizient(half,'zahl')], rechts:tilesAusKoeffizient(-wurzel,'zahl'), malkreuz:{anzahl:wurzel, sign:-1} },
      ],
    });
    schritte.push({
      typ:'wurzel-ergebnis',
      label:`Jede der beiden Gleichungen nach x auflösen: das ergibt ZWEI Lösungen.`,
      zweige: [
        { label:`Lösungsweg 1: x ${vorzeichenHalf} ${seitenAnzahl} = +${wurzel} → x = ${-half+wurzel}`, links:[{kind:'x', sign:1}], rechts:tilesAusKoeffizient(-half+wurzel,'zahl') },
        { label:`Lösungsweg 2: x ${vorzeichenHalf} ${seitenAnzahl} = −${wurzel} → x = ${-half-wurzel}`, links:[{kind:'x', sign:1}], rechts:tilesAusKoeffizient(-half-wurzel,'zahl') },
      ],
    });
  }

  return { schritte, fehler:null };
}
