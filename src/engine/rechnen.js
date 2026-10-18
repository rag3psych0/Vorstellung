import { planeGleichungsLoesung, tilesAusKoeffizient } from './gleichungen.js';
import { erzeugeLeeresRaster, fuegeSpalteHinzu, fuegeZeileHinzu, koeffizientenAusRaster } from './multiplikationRaster.js';
import { formatiereKoeffizientenAlsTerm } from './termParser.js';
import { mountQuadratischeErgaenzungErklaerung } from '../erklaerungen/quadratische-ergaenzung/erklaerung.js';
import { createAndockRasterUI } from '../shared/andockRaster.js';

/* ============================================================
   Kern-Engine (entspricht 1:1 src/engine/ im ausgelieferten Code)
   ============================================================ */
export let idCounter = 0;
export function createPlaettchen(kind, sign) {
  idCounter += 1;
  return { id: `p${idCounter}`, kind, sign };
}

export class Board {
  constructor(){ this.tiles = []; }
  add(kind, sign, count = 1){
    const added = [];
    for(let i=0;i<count;i+=1){
      const tile = createPlaettchen(kind, sign);
      this.tiles.push(tile);
      added.push(tile);
    }
    return added;
  }
  countBySignedKind(kind, sign){
    return this.tiles.filter(t => t.kind===kind && t.sign===sign).length;
  }
  netValue(kind){
    return this.countBySignedKind(kind,1) - this.countBySignedKind(kind,-1);
  }
  findZeroPairs(kind){
    const positives = this.tiles.filter(t => t.kind===kind && t.sign===1);
    const negatives = this.tiles.filter(t => t.kind===kind && t.sign===-1);
    const n = Math.min(positives.length, negatives.length);
    const pairs = [];
    for(let i=0;i<n;i+=1) pairs.push([positives[i].id, negatives[i].id]);
    return pairs;
  }
  removeById(id){ this.tiles = this.tiles.filter(t => t.id!==id); }
  resolveZeroPairs(kind){
    const pairs = this.findZeroPairs(kind);
    for(const [posId, negId] of pairs){ this.removeById(posId); this.removeById(negId); }
    return pairs;
  }
  removeCount(kind, sign, count){
    const matching = this.tiles.filter(t => t.kind===kind && t.sign===sign).slice(0, count);
    for(const t of matching) this.removeById(t.id);
    return matching;
  }
  clear(){ this.tiles = []; }
  snapshot(){ return this.tiles.map(t => ({...t})); }
}

export function formatSigned(n){ return n>=0 ? `+${n}` : `${n}`; }

/** Runde 23 (Nutzer-Rückmeldung, Erklärungen zu Addition/Subtraktion): statt der abstrakten "+X"/"-X"-Formelsprache in den Schritt-Texten heißen negative Plättchen dort konkret "Minusplättchen" ("Lege 5 Minusplättchen dazu."), positive bleiben schlicht "Plättchen". */
export function plaettchenWort(sign){ return sign<0 ? 'Minusplättchen' : 'Plättchen'; }

export function berechneAddition(a, b, kind='zahl'){
  const board = new Board();
  const steps = [];
  const signA = a<0 ? -1 : 1;
  const signB = b<0 ? -1 : 1;

  if(a!==0) board.add(kind, signA, Math.abs(a));
  steps.push({type:'add', label:`Lege ${Math.abs(a)} ${plaettchenWort(signA)}.`, snapshot:board.snapshot()});

  if(b!==0) board.add(kind, signB, Math.abs(b));
  steps.push({type:'add', label:`Lege ${Math.abs(b)} ${plaettchenWort(signB)} dazu.`, snapshot:board.snapshot()});

  const pairs = board.findZeroPairs(kind);
  if(pairs.length>0){
    const cancelIds = pairs.flat();
    const snapshotBefore = board.snapshot();
    board.resolveZeroPairs(kind);
    steps.push({type:'cancel', label:`${pairs.length} Nullpaar(e) heben sich gegenseitig auf (macht zusammen 0).`, snapshotBefore, cancelIds, snapshot:board.snapshot()});
  }

  const result = board.netValue(kind);
  steps.push({type:'result', value:result, label:`Ergebnis: ${formatSigned(a)} ${b>=0?'+':'-'} ${Math.abs(b)} = ${result}`, snapshot:board.snapshot()});
  return {steps, result};
}

export function berechneSubtraktion(a, b, kind='zahl'){
  const board = new Board();
  const steps = [];
  const signA = a<0 ? -1 : 1;
  if(a!==0) board.add(kind, signA, Math.abs(a));
  steps.push({type:'add', label:`Lege ${Math.abs(a)} ${plaettchenWort(signA)}.`, snapshot:board.snapshot()});

  if(b!==0){
    const neededSign = b<0 ? -1 : 1;
    const neededCount = Math.abs(b);
    const available = board.countBySignedKind(kind, neededSign);
    if(available < neededCount){
      const missing = neededCount - available;
      board.add(kind, 1, missing);
      board.add(kind, -1, missing);
      steps.push({type:'zero-pairs', label:`Es liegen nicht genug Plättchen zum Wegnehmen aus – ergänze ${missing} Nullpaar(e) (verändert den Wert nicht).`, snapshot:board.snapshot()});
    }
    board.removeCount(kind, neededSign, neededCount);
    steps.push({type:'remove', label:`Nimm ${neededCount} ${plaettchenWort(neededSign)} weg.`, snapshot:board.snapshot()});
  }

  const result = board.netValue(kind);
  steps.push({type:'result', value:result, label:`Ergebnis: ${formatSigned(a)} - (${formatSigned(b)}) = ${result}`, snapshot:board.snapshot()});
  return {steps, result};
}

/** Schreibweise für Faktoren in der Ergebniszeile: immer geklammert und signiert ("(+3) × (-4)"). Runde 20. */
export function formatFactor(n){ return `(${n>=0?'+':''}${n})`; }

/** a × b als "a Gruppen von b Plättchen" (entspricht src/engine/rechnen.js). */
export function berechneMultiplikation(a, b, kind='zahl'){
  const board = new Board();
  const steps = [];
  if(a===0 || b===0){
    steps.push({type:'info', label: a===0 ? '0 Gruppen bedeuten: es wird nichts ausgelegt.' : 'Jede Gruppe hat die Größe 0 – es wird nichts ausgelegt.', snapshot:board.snapshot()});
  } else if(a>0){
    const signB = b<0 ? -1 : 1;
    for(let i=1;i<=a;i+=1){
      const neu = board.add(kind, signB, Math.abs(b));
      for(const tile of neu) tile.gruppe = i;
      steps.push({type:'add', label:`Gruppe ${i} von ${a}: lege ${Math.abs(b)} Plättchen für ${formatSigned(b)} dazu.`, snapshot:board.snapshot()});
    }
  } else {
    const groupsCount = Math.abs(a);
    const groupSize = Math.abs(b);
    const groupSign = b<0 ? -1 : 1;
    const zeroPairsNeeded = groupsCount*groupSize;
    for(let i=1;i<=groupsCount;i+=1){
      const pos = board.add(kind, 1, groupSize);
      const neg = board.add(kind, -1, groupSize);
      for(const tile of pos) tile.gruppe = i;
      for(const tile of neg) tile.gruppe = i;
    }
    steps.push({type:'zero-pairs', label:`${a} Gruppen bedeutet: ${groupsCount} Gruppe(n) von ${groupSize} Plättchen (${formatSigned(b)}) wegnehmen. Es liegen noch keine da – ergänze ${zeroPairsNeeded} Nullpaar(e) (verändert den Wert nicht).`, snapshot:board.snapshot()});
    for(let i=1;i<=groupsCount;i+=1){
      const zuEntfernen = board.tiles.filter((t) => t.kind===kind && t.sign===groupSign && t.gruppe===i);
      for(const tile of zuEntfernen) board.removeById(tile.id);
      steps.push({type:'remove', label:`Nimm Gruppe ${i} von ${groupsCount} weg: ${groupSize} Plättchen (${groupSign>0?'+':'−'}).`, snapshot:board.snapshot()});
    }
  }
  const result = board.netValue(kind);
  steps.push({type:'result', value:result, label:`Ergebnis: ${formatFactor(a)} × ${formatFactor(b)} = ${result}`, snapshot:board.snapshot()});
  return {steps, result};
}

/** a ÷ b als Umkehrung von berechneMultiplikation (entspricht src/engine/rechnen.js). */
export function berechneDivision(a, b, kind='zahl'){
  if(b===0){
    return {steps:[{type:'error', label:'Division durch 0 ist nicht möglich.', snapshot:[]}], result:null, fehler:'durch-null'};
  }
  if(a%b !== 0){
    return {steps:[{type:'error', label:`${a} lässt sich nicht ohne Rest durch ${b} teilen. Wähle andere Zahlen (z. B. ${b*Math.round(a/b)} ÷ ${b}).`, snapshot:[]}], result:null, fehler:'nicht-teilbar'};
  }
  const quotient = a/b;
  const { steps: multSteps } = berechneMultiplikation(quotient, b, kind);
  const steps = multSteps.map((step) => ({...step}));
  steps.unshift({type:'info', label:`Um ${a} ÷ ${b} zu bestimmen, legen wir Gruppen von ${Math.abs(b)} Plättchen (${formatSigned(b)}), bis wir ${a} erreicht haben.`, snapshot:[]});
  steps[steps.length-1] = {...steps[steps.length-1], label:`Ergebnis: ${a} ÷ ${b} = ${quotient} (denn ${formatFactor(quotient)} × ${formatFactor(b)} = ${a})`};
  return {steps, result:quotient, fehler:null};
}

/** Runde 21 (Punkt 2/3): bildet die Quadratzahl a² als Spezialfall von berechneMultiplikation mit b=a ("a Gruppen von a Plättchen") – nur Start-/Ergebniszeile umformuliert. */
export function berechneQuadratzahl(a){
  const { steps, result } = berechneMultiplikation(a, a);
  const ergebnisIndex = steps.length-1;
  const neueSteps = steps.map((step, i) => {
    if(i===0) return {...step, label:`${formatFactor(a)}² bedeutet ${formatFactor(a)} × ${formatFactor(a)} – also ${Math.abs(a)} Gruppen von ${Math.abs(a)} Plättchen. ${step.label}`};
    if(i===ergebnisIndex) return {...step, label:`Ergebnis: ${formatFactor(a)}² = ${result}`};
    return step;
  });
  return { steps: neueSteps, result };
}

/** Runde 21 (Punkt 2/3): zieht die (ganzzahlige) Quadratwurzel aus einer nicht-negativen Zahl n als Umkehrung von berechneQuadratzahl – nicht aufgehende Fälle liefern einen eigenen Fehler-Schritt statt einer Dezimalzahl. */
export function berechneWurzel(n){
  if(!Number.isInteger(n) || n<0){
    return {
      steps: [{ type:'error', label:`Aus ${n} lässt sich mit ganzen Plättchen keine Quadratwurzel ziehen – wähle eine nicht-negative ganze Zahl.`, snapshot:[] }],
      result: null, fehler: 'ungueltig',
    };
  }
  const wurzel = Math.round(Math.sqrt(n));
  if(wurzel*wurzel !== n){
    return {
      steps: [{ type:'error', label:`${n} ist keine Quadratzahl – die Wurzel lässt sich nicht als ganze Zahl (mit ganzen Plättchen) darstellen. Wähle eine Quadratzahl (z. B. ${wurzel*wurzel} oder ${(wurzel+1)**2}).`, snapshot:[] }],
      result: null, fehler: 'keine-quadratzahl',
    };
  }
  const { steps: quadratSteps } = berechneQuadratzahl(wurzel);
  const steps = quadratSteps.map((step) => ({...step}));
  steps.unshift({ type:'info', label:`Um √${n} zu bestimmen, suchen wir eine Zahl a mit a² = ${n} und stellen deren Quadrat als "a Gruppen von a" dar.`, snapshot:[] });
  steps[steps.length-1] = {...steps[steps.length-1], label:`Ergebnis: √${n} = ${wurzel} (denn ${formatFactor(wurzel)}² = ${n})`};
  return { steps, result: wurzel, fehler: null };
}

/** Runde 21 (Punkt 1/2/3): ganzzahlige Quadratwurzel einer nicht-negativen Ganzzahl, sofern sie exakt aufgeht (sonst null) – Hilfsfunktion für das Wurzelziehen bei quadratischen Gleichungen (planeGleichungsLoesung) und für berechneWurzel oben. */
export function ganzzahligeWurzel(wert){
  if(!Number.isInteger(wert) || wert<0) return null;
  const wurzel = Math.round(Math.sqrt(wert));
  return wurzel*wurzel===wert ? wurzel : null;
}

/** Quadratische Ergänzung: x² + px + c = (x ± p/2)² [+/- Rest] (entspricht src/engine/rechnen.js).
    p muss gerade und ungleich 0 sein (sonst eigener Fehler-Schritt). `c` ist
    die Konstante der Startgleichung x²+px+c; weicht sie von der für die Ecke
    benötigten (p/2)² ab, bleibt rechnerisch ein Rest übrig. */
/* Runde 23 (Punkt 5, Nutzer-Rückmeldung: "Erkläre die Quadratische Ergänzung
   nur mithilfe des Malkreuzes"): komplett umgestellt von der vorherigen
   Quadrat-Geometrie (Board-Snapshots mit Bereichen 'quadrat'/'seite-a'/
   'seite-b'/'ecke'/Nebenspalten, siehe das inzwischen entfernte
   renderQuadratTafel) auf dieselbe Malkreuz-Mechanik wie
   berechneKlammernMultiplikation oben: x² + px wird zu einem vollständigen
   Quadrat ergänzt, indem die Klammer (x ± p/2) mit sich SELBST am Malkreuz
   multipliziert wird – Zeile und Spalte sind dieselbe Plättchenkette. Das
   Malkreuz liefert x² ± px + (p/2)², die Ecke (p/2)² wird dabei sichtbar als
   genau jene Produkt-Zellen, die aus (±1)·(±1) entstehen. Der Vergleich mit
   der tatsächlich vorgegebenen Konstante c (und ein ggf. verbleibender Rest)
   wird danach als reiner Rechenweg-Text ergänzt, ohne eigene Darstellung. */
export const QE_MAX_HALFTE = 12;
export function berechneQuadratischeErgaenzung(p, c = Number.isInteger(p/2) ? (p/2)**2 : NaN){
  if(p===0){
    return {steps:[{type:'error', label:'Wähle ein p ungleich 0 – bei p = 0 ist x² bereits ein vollständiges Quadrat, es gibt nichts zu ergänzen.', raster:erzeugeLeeresRaster()}], result:null, rest:null, fehler:'p-null'};
  }
  if(p%2 !== 0){
    return {steps:[{type:'error', label:`${p} ist ungerade – die Hälfte (${p}/2) wäre kein ganzes Plättchen mehr. Wähle eine gerade Zahl für p (z. B. ${p>0?p+1:p-1}).`, raster:erzeugeLeeresRaster()}], result:null, rest:null, fehler:'p-ungerade'};
  }
  if(!Number.isInteger(c)){
    return {steps:[{type:'error', label:'Bitte für c eine ganze Zahl eingeben.', raster:erzeugeLeeresRaster()}], result:null, rest:null, fehler:'c-ungueltig'};
  }
  const half = p/2;
  const n = Math.abs(half);
  if(n > QE_MAX_HALFTE){
    return {steps:[{type:'error', label:`Für dieses p wäre das Malkreuz zu groß, um es Schritt für Schritt zu verfolgen – wähle ein p zwischen -${QE_MAX_HALFTE*2} und +${QE_MAX_HALFTE*2}.`, raster:erzeugeLeeresRaster()}], result:null, rest:null, fehler:'zu-gross'};
  }

  const steps = [];
  const signHalf = half<0 ? -1 : 1;
  const vorzeichenP = p>=0 ? '+' : '-';
  const vorzeichenC = c>=0 ? '+' : '-';
  const vorzeichenHalf = half>=0 ? '+' : '-';
  const klammerText = `(x ${vorzeichenHalf} ${n})`;

  let raster = erzeugeLeeresRaster();
  // Runde 38 (Nutzer-Rückmeldung, konkrete 3-Schritt-Vorgabe für die
  // Erklärung "Quadratische Ergänzung"): bisher (Runde 37, Punkt 5) wurden
  // die Achsen zwar in einem Zug aufgebaut, aber die bereits GEGEBENEN
  // Zellen (x² und alle p·x) noch in eigenen Schritten einzeln gefüllt
  // (start → dock-zeile → dock-spalte → fill x² → fill x) – fünf Klicks nur
  // für das, was aus der Startgleichung bereits feststeht. Der Nutzer gibt
  // jetzt genau drei Schritte vor: (1) Malkreuz zeigen MIT x² oben links und
  // allen p x-Plättchen bereits eingesetzt – alles auf einmal; (2) die Ecke
  // mit +1-Plättchen zum vollständigen Quadrat ergänzen; (3) die Faktoren
  // aus dem fertigen Produktfeld ablesen/einsetzen. Achsenaufbau UND das
  // Füllen von x²/x passieren deshalb jetzt VOR dem ersten steps.push,
  // komplett ohne Zwischenschritt.
  for(const tile of [{kind:'x', sign:1}, ...Array.from({length:n}, () => ({kind:'zahl', sign:signHalf}))]){
    raster = fuegeZeileHinzu(strukturKopie(raster), tile);
  }
  for(const tile of [{kind:'x', sign:1}, ...Array.from({length:n}, () => ({kind:'zahl', sign:signHalf}))]){
    raster = fuegeSpalteHinzu(strukturKopie(raster), tile);
  }

  function fuelleZellenDerKlasseOhneSchritt(art){
    const positionen = [];
    raster.zellen.forEach((reihe, i) => reihe.forEach((zelle, j) => {
      if(!zelle.gefuellt && zelle.erwarteteArt===art) positionen.push({ i, j });
    }));
    if(positionen.length===0) return;
    const naechstesRaster = strukturKopie(raster);
    for(const { i, j } of positionen) naechstesRaster.zellen[i][j].gefuellt = true;
    raster = naechstesRaster;
  }
  fuelleZellenDerKlasseOhneSchritt('x2');
  fuelleZellenDerKlasseOhneSchritt('x');

  // Runde 43 (Nutzer-Rückmeldung: "Lasse die Faktordarstellung weg z.B.
  // (x+3). Die Faktorplättchen (x-Plättchen und 3x +1-Plättchen z.B.) sollen
  // erst dann platziert werden, wenn das Produkt als Quadrat gelegt
  // wurde."): Die bisherige TEXT-Beschriftung der Achsen ("?" → abgeleitete
  // Klammer, seit Runde 36/39 über `faktorText`) entfällt vollständig – an
  // ihre Stelle tritt eine neue, pro Schritt mitgeführte Markierung
  // `achsenSichtbar`, die steuert, ob die Achsen-PLÄTTCHEN selbst (das
  // x-Plättchen und die n Eins-Plättchen je Achse, die zusammen den Faktor
  // (x ± n) bilden) in `createAndockRasterUI` überhaupt gerendert werden
  // (siehe neue Option `achsenPlaettchenSichtbar` in
  // src/shared/andockRaster.js). Die Achsen-Arrays (`raster.zeilen`/
  // `raster.spalten`) selbst werden weiterhin wie seit Runde 23 VOLLSTÄNDIG
  // vor dem ersten Schritt aufgebaut, da die Geometrie des Produktfelds
  // (Zellenzahl, -größe, -position) zwingend von ihnen abhängt – nur ihre
  // SICHTBARKEIT wird jetzt pro Schritt gesteuert, nicht ihr Aufbau. Die
  // Schritt-Texte der beiden ersten Schritte verzichten deshalb bewusst auf
  // jede Nennung der Klammer (x ± n) oder eines Malkreuz-Bezugs für die
  // Achsen, solange `achsenSichtbar:false` gilt.
  steps.push({type:'start', achsenSichtbar:false, label:`Wir gehen von x² ${vorzeichenP} ${Math.abs(p)}x ${vorzeichenC} ${Math.abs(c)} aus. Das x²-Plättchen und die ${Math.abs(p)} x-Plättchen werden in das Produktfeld eingesetzt.`, raster});

  // Schritt 2: die Ecke (n² Eins-Plättchen) wird ergänzt – das Produktfeld
  // ist damit als vollständiges Quadrat gelegt. Die Achsen bleiben hier
  // weiterhin unsichtbar (`achsenSichtbar:false`); der Schritt-Text nennt
  // bewusst nur die Flächen-Gleichheit (x² ± px + Ergänzung), nicht die
  // daraus ableitbare Klammer – diese folgt erst im nächsten Schritt, als
  // tatsächlich PLATZIERTE Faktor-Plättchen statt als Text.
  fuelleZellenDerKlasseOhneSchritt('zahl');
  const ergaenzung = n*n;
  steps.push({type:'quadrat-komplett', achsenSichtbar:false, label:`Das Quadrat wird jetzt mit ${ergaenzung} Eins-Plättchen (+1) fertiggestellt und ist damit vollständig: x² ${vorzeichenP} ${Math.abs(p)}x + ${ergaenzung}.`, raster});

  // Schritt 3 (genau einen Schritt nach dem fertigen Produktfeld, vgl. Runde
  // 42): Jetzt – und erst jetzt – werden die Faktor-Plättchen tatsächlich an
  // beide Achsen gelegt (`achsenSichtbar:true`, wirkt rückwirkend auf diesen
  // und alle folgenden Schritte). Der Text beschreibt die PLATZIERUNG (ein
  // x-Plättchen und n Eins-Plättchen je Achse), nicht das Ergebnis als
  // Klammer-Term – die Lernperson liest die Klammer (x ± n) selbst von den
  // nun sichtbaren Achsen-Plättchen ab, statt sie als Text vorgesetzt zu
  // bekommen.
  steps.push({type:'quadrat-fertig', achsenSichtbar:true, label:`Jetzt werden die Faktor-Plättchen an beide Achsen gelegt: ein x-Plättchen und ${n} Eins-Plättchen (${vorzeichenHalf}1) je Achse.`, raster});

  // Vergleich mit der tatsächlich vorgegebenen Konstante c: nur noch
  // Rechenweg-Text, keine eigene Darstellung (das Malkreuz zeigt bereits
  // alles, was es zeigen kann). Die Achsen-Plättchen bleiben ab hier für
  // alle folgenden Schritte sichtbar.
  const rest = c - ergaenzung;
  // Runde 24 (Punkt 2, Nutzer-Rückmeldung: "vorallem wenn c einen Rest hat
  // --> Rest im Malkreuz anzeigen"): der Rest bleibt NICHT mehr reiner
  // Rechenweg-Text, sondern wird zusätzlich als konkrete Zahl-Plättchen
  // direkt am Malkreuz angezeigt (siehe restTiles/.qe-rest-anzeige in
  // mountQuadratischeErgaenzungErklaerung) – bleibt (wie der
  // Malkreuz-Beleg bei der Gleichung, Punkt 5) ab hier für alle
  // nachfolgenden Schritte sichtbar stehen.
  const restTiles = rest!==0 ? tilesAusKoeffizient(rest, 'zahl') : [];
  if(rest !== 0){
    steps.push({type:'rest-legen', achsenSichtbar:true, label:`Die Startgleichung hatte aber c = ${formatSigned(c)}, nicht + ${ergaenzung}. Der Unterschied bleibt als Rest stehen: ${formatSigned(c)} − ${ergaenzung} = ${formatSigned(rest)}.`, raster, restTiles});
  } else {
    steps.push({type:'rest-keine', achsenSichtbar:true, label:`Die Startgleichung hatte genau c = ${ergaenzung} – das trifft die Ecke exakt, es bleibt kein Rest übrig.`, raster});
  }

  // Letzter Schritt (Achsen-Plättchen bereits seit Schritt 3 sichtbar,
  // Faktor also bereits von der Lernperson selbst ablesbar): erst hier
  // benennt der Rechenweg-Text die daraus abgeleitete Klammer (x ± n)
  // zusammenfassend als Ergebnis – nicht mehr vorab.
  const restText = rest!==0 ? ` ${rest>0?'+':'−'} ${Math.abs(rest)}` : '';
  steps.push({type:'result', achsenSichtbar:true, label:`x² ${vorzeichenP} ${Math.abs(p)}x ${vorzeichenC} ${Math.abs(c)} = ${klammerText}²${restText}`, raster, restTiles});

  return {steps, result:ergaenzung, rest, fehler:null};
}
/* ============================================================
   Runde 18 (Punkt 3): Rechenweg für die geführte Erklärung "Multiplikation
   von Klammern/Das Malkreuz" (entspricht berechneKlammernMultiplikation aus
   src/engine/rechnen.js). Zwei lineare Klammern (je {x, zahl}, kein x²)
   werden Schritt für Schritt am Malkreuz aufgebaut: erst Klammer A
   Plättchen für Plättchen an die Zeilen-Kette (unten links), dann Klammer B
   an die Spalten-Kette (oben rechts), anschließend jede Produkt-Zelle
   einzeln (Zeile für Zeile), zuletzt das ausmultiplizierte Ergebnis. Jeder
   Schritt trägt statt eines Board-Snapshots einen Snapshot des Malkreuz-
   `raster` (siehe erzeugeLeeresRaster/fuegeZeileHinzu/fuegeSpalteHinzu
   oben) – die aufrufende UI wandelt das bei Bedarf in den von
   createAndockRasterUI's stelleZustandWieder erwarteten Zustand um.
   ============================================================ */
export const KM_MAX_TEIL_JE_KLAMMER = 6;

/* Zerlegt eine geparste lineare Klammer ({x, zahl}) in einzelne Plättchen –
   erst die x-Plättchen (falls vorhanden), dann die Zahl-Plättchen, jeweils
   mit dem Vorzeichen ihres Koeffizienten. */
export function tilesAusLinearerKlammer({ x, zahl }){
  const tiles = [];
  if(x!==0){ const sign = x<0 ? -1 : 1; for(let i=0;i<Math.abs(x);i+=1) tiles.push({kind:'x', sign}); }
  if(zahl!==0){ const sign = zahl<0 ? -1 : 1; for(let i=0;i<Math.abs(zahl);i+=1) tiles.push({kind:'zahl', sign}); }
  return tiles;
}
export function tileBeschreibungKM({ kind, sign }){
  const vorzeichen = sign>0 ? '+' : '−';
  const symbol = kind==='x2' ? 'x²' : kind==='x' ? 'x' : '1';
  return `${vorzeichen}${symbol}`;
}
export function formatiereKlammerKM(koeffizienten){
  return `(${formatiereKoeffizientenAlsTerm({ x2:0, x:koeffizienten.x, zahl:koeffizienten.zahl })})`;
}
export function strukturKopie(wert){ return typeof structuredClone==='function' ? structuredClone(wert) : JSON.parse(JSON.stringify(wert)); }

export function berechneKlammernMultiplikation(faktorA, faktorB){
  const tilesA = tilesAusLinearerKlammer(faktorA);
  const tilesB = tilesAusLinearerKlammer(faktorB);

  if(tilesA.length===0 || tilesB.length===0){
    return {
      steps: [{ type:'error', label:'Beide Klammern brauchen mindestens einen Koeffizienten ungleich 0.', raster: erzeugeLeeresRaster() }],
      ergebnis: null, fehler: 'leer',
    };
  }
  if(tilesA.length>KM_MAX_TEIL_JE_KLAMMER || tilesB.length>KM_MAX_TEIL_JE_KLAMMER){
    return {
      steps: [{ type:'error', label:`Für diese Klammern wäre das Malkreuz zu groß, um es Schritt für Schritt zu verfolgen – wähle kleinere Zahlen (höchstens ${KM_MAX_TEIL_JE_KLAMMER} Plättchen je Klammer).`, raster: erzeugeLeeresRaster() }],
      ergebnis: null, fehler: 'zu-gross',
    };
  }

  const steps = [];
  const klammerAText = formatiereKlammerKM(faktorA);
  const klammerBText = formatiereKlammerKM(faktorB);

  let raster = erzeugeLeeresRaster();
  steps.push({ type:'start', label:`Wir multiplizieren die Klammern ${klammerAText} und ${klammerBText} mit dem Malkreuz: Klammer A steht unten links, Klammer B liegt oben rechts.`, raster });

  // Runde 22 Punkt 2: jede Klammer kommt VOLLSTÄNDIG auf einmal ans Malkreuz
  // (nicht mehr Plättchen für Plättchen) – "Nächster Schritt" zeigt direkt
  // die ganze Klammer A, dann die ganze Klammer B.
  for(const tile of tilesA){ raster = fuegeZeileHinzu(strukturKopie(raster), tile); }
  steps.push({ type:'dock-zeile', label:`Klammer A (${klammerAText}) kommt vollständig stehend ans Malkreuz (unten links).`, raster });
  for(const tile of tilesB){ raster = fuegeSpalteHinzu(strukturKopie(raster), tile); }
  steps.push({ type:'dock-spalte', label:`Klammer B (${klammerBText}) kommt vollständig liegend ans Malkreuz (oben rechts).`, raster });

  // Runde 23 (Punkt 4, Nutzer-Rückmeldung): Produkte DERSELBEN Klasse (z. B.
  // alle Zellen, die ein −x-Plättchen ergeben, oder alle, die ein
  // +1-Plättchen ergeben) werden auf einmal gefüllt und als EIN
  // Rechenweg-Schritt dargestellt, statt – wie zuvor – jede Zelle einzeln
  // nacheinander. Die Gruppen-Reihenfolge richtet sich danach, in welcher
  // Zelle (Zeile für Zeile, Spalte für Spalte) die jeweilige Klasse zuerst
  // auftritt – das entspricht dem bisherigen Lese-Fortschritt übers Raster.
  const klassenReihenfolge = [];
  const klassenZellen = new Map();
  raster.zellen.forEach((reihe, i) => {
    reihe.forEach((zelle, j) => {
      const klasse = `${zelle.erwarteteArt}|${zelle.erwartetesVorzeichen}`;
      if(!klassenZellen.has(klasse)){ klassenZellen.set(klasse, []); klassenReihenfolge.push(klasse); }
      klassenZellen.get(klasse).push({ i, j });
    });
  });

  for(const klasse of klassenReihenfolge){
    const positionen = klassenZellen.get(klasse);
    const naechstesRaster = strukturKopie(raster);
    for(const { i, j } of positionen) naechstesRaster.zellen[i][j].gefuellt = true;
    raster = naechstesRaster;

    const [art, vorzeichenText] = klasse.split('|');
    const vorzeichen = Number(vorzeichenText);
    const produktBeschreibung = tileBeschreibungKM({ kind: art, sign: vorzeichen });
    const paarBeschreibungen = positionen.map(({ i, j }) => {
      const zeileBeschreibung = tileBeschreibungKM(raster.zeilen[i]);
      const spalteBeschreibung = tileBeschreibungKM(raster.spalten[j]);
      return `Zeile ${i+1} mal Spalte ${j+1} (${zeileBeschreibung} mal ${spalteBeschreibung})`;
    });

    const label = positionen.length>1
      ? `Alle Zellen, die ein ${produktBeschreibung}-Plättchen ergeben, werden jetzt auf einmal gefüllt: ${paarBeschreibungen.join('; ')} – das ergibt jeweils ein ${produktBeschreibung}-Plättchen im Produkt-Raster.`
      : `${paarBeschreibungen[0]} ergibt ein ${produktBeschreibung}-Plättchen im Produkt-Raster.`;
    steps.push({ type:'fill-cell', label, raster });
  }

  const ergebnis = koeffizientenAusRaster(raster);
  steps.push({ type:'result', label:`Ergebnis: ${klammerAText} · ${klammerBText} = ${formatiereKoeffizientenAlsTerm(ergebnis)}`, raster });

  return { steps, ergebnis, fehler: null };
}

/* Runde 16 ("Rückgängig button"): einfacher, mehrstufiger Undo-Speicher pro
   Bearbeitungsfläche – entspricht 1:1 src/shared/undo.js. */
export function erzeugeUndoSpeicher(opts={}){
  const stapel = [];
  const onChange = opts.onChange;
  function melde(){ onChange?.(stapel.length); }
  melde();
  return {
    aufzeichnen(wiederherstellen){ stapel.push(wiederherstellen); melde(); },
    kannRueckgaengig: () => stapel.length>0,
    rueckgaengig(){
      const wiederherstellen = stapel.pop();
      if(!wiederherstellen) return false;
      wiederherstellen(); melde();
      return true;
    },
    leeren(){ if(stapel.length===0) return; stapel.length=0; melde(); },
    ersetzeLetzten(wiederherstellen){
      if(stapel.length>0) stapel.pop();
      stapel.push(wiederherstellen); melde();
    },
  };
}

/** Liest den aktuell dargestellten Term ab, OHNE ihn zu vereinfachen. */
export const TERM_REIHENFOLGE = ['x2', 'x', 'zahl'];
export const TERM_SYMBOL = { x2:'x²', x:'x', zahl:'' };
export function termAusBoard(tiles){
  const teile = [];
  for(const kind of TERM_REIHENFOLGE){
    const positiv = tiles.filter(t => t.kind===kind && t.sign===1).length;
    const negativ = tiles.filter(t => t.kind===kind && t.sign===-1).length;
    if(positiv>0) teile.push(formatiereTermTeil(1, positiv, kind));
    if(negativ>0) teile.push(formatiereTermTeil(-1, negativ, kind));
  }
  return teile.length>0 ? teile.join(' ') : '0';
}
export function formatiereTermTeil(sign, anzahl, kind){
  const zeichen = sign>0 ? '+' : '−';
  if(kind==='zahl') return `${zeichen}${anzahl}`;
  const koeffizient = anzahl>1 ? String(anzahl) : '';
  return `${zeichen}${koeffizient}${TERM_SYMBOL[kind]}`;
}

/** Geometrie: liegt ein Plättchen nah genug an seinem Gegenstück? */
export function findeGegenpaarInNaehe(tiles, zentren, tileId, maxDistance){
  const tile = tiles.find(t => t.id===tileId);
  const zentrum = zentren[tileId];
  if(!tile || !zentrum) return null;
  let beste = null, besterAbstand = Infinity;
  for(const other of tiles){
    if(other.id===tileId) continue;
    if(other.kind!==tile.kind || other.sign===tile.sign) continue;
    const oz = zentren[other.id];
    if(!oz) continue;
    const abstand = Math.hypot(oz.x-zentrum.x, oz.y-zentrum.y);
    if(abstand<=maxDistance && abstand<besterAbstand){ beste=other; besterAbstand=abstand; }
  }
  return beste;
}
