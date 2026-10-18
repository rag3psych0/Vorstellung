import { erzeugeGleichungsKette } from '../shared/gleichungsKette.js';

/* ============================================================
   Termeingabe-Parser (entspricht src/engine/termParser.js) und
   Vergleichshilfe (entspricht src/shared/termCheck.js) – verwendet von
   "Plättchen zu Term" und "Term zu Plättchen".
   ============================================================ */
export const MUSTER_X2 = /^(\d+)?x(\^2|²)$/i;
export const MUSTER_X = /^(\d+)?x$/i;
export const MUSTER_ZAHL = /^\d+$/;
// Runde 16 ("Klammern bei Termen müssen erkannt werden"): ein Summand kann
// jetzt auch "Vorfaktor·(linearer Term)" ODER "(linearer Term)·(linearer
// Term)" sein (Gruppe 2/3 = Klammer-Inhalt; Klammer-Inhalt selbst bleibt
// linear – kein x², keine verschachtelten Klammern).
export const MUSTER_KLAMMER_SUMMAND = /^(\d+)?[*·]?\(([^()]*)\)(?:[*·]?\(([^()]*)\))?$/;
/** Parst den Inhalt EINER Klammer als linearen Term (nur x/Zahl). */
export function parseLineareKlammer(inhalt){
  const normiert = inhalt.replace(/\s+/g,'').replace(/−/g,'-');
  // Nur ergänzen, wenn noch KEIN Vorzeichen vorhanden ist – sonst entstünde
  // (z. B. bei bereits signiertem Inhalt wie "+x-4") ein doppeltes Vorzeichen
  // und der Vergleich mit "teile.join('')" würde immer scheitern.
  const mitVz = /^[+-]/.test(normiert) ? normiert : `+${normiert}`;
  const teile = mitVz.match(/[+-][^+-]+/g);
  if(!teile || teile.join('') !== mitVz) return null;
  const erg = { x:0, zahl:0 };
  for(const teil of teile){
    const vz = teil[0]==='-' ? -1 : 1;
    const rest = teil.slice(1);
    if(rest==='') return null;
    let t;
    if((t = rest.match(MUSTER_X))) erg.x += vz * (t[1] ? Number(t[1]) : 1);
    else if(MUSTER_ZAHL.test(rest)) erg.zahl += vz * Number(rest);
    else return null;
  }
  return erg;
}
/** Multipliziert zwei lineare Terme aus (FOIL): (ax+b)(cx+d) = ac·x² + (ad+bc)·x + bd. */
export function multipliziereLinear(a, b){
  return { x2: a.x*b.x, x: a.x*b.zahl + a.zahl*b.x, zahl: a.zahl*b.zahl };
}
/** Parst EINEN additiven Summanden (ohne führendes Vorzeichen): Plättchen-Monom ODER Klammer-Form. */
export function parseSummand(summand){
  let treffer;
  if((treffer = summand.match(MUSTER_X2))) return { x2: treffer[1] ? Number(treffer[1]) : 1, x:0, zahl:0 };
  if((treffer = summand.match(MUSTER_X))) return { x2:0, x: treffer[1] ? Number(treffer[1]) : 1, zahl:0 };
  if(MUSTER_ZAHL.test(summand)) return { x2:0, x:0, zahl: Number(summand) };
  if((treffer = summand.match(MUSTER_KLAMMER_SUMMAND))){
    const vorfaktor = treffer[1] ? Number(treffer[1]) : 1;
    const klammerA = parseLineareKlammer(treffer[2]);
    if(!klammerA) return null;
    if(treffer[3] !== undefined){
      const klammerB = parseLineareKlammer(treffer[3]);
      if(!klammerB) return null;
      const produkt = multipliziereLinear(klammerA, klammerB);
      return { x2: vorfaktor*produkt.x2, x: vorfaktor*produkt.x, zahl: vorfaktor*produkt.zahl };
    }
    return { x2:0, x: vorfaktor*klammerA.x, zahl: vorfaktor*klammerA.zahl };
  }
  return null;
}
/** Zerlegt in additive Summanden, aber KLAMMER-TIEF ("+"/"-" innerhalb "(...)" trennt nicht). */
export function zerlegeInSummanden(bereinigt){
  const summanden = [];
  let start = 0, tiefe = 0;
  for(let i=1;i<bereinigt.length;i+=1){
    const c = bereinigt[i];
    if(c==='(') tiefe += 1;
    else if(c===')') tiefe -= 1;
    else if((c==='+'||c==='-') && tiefe===0){ summanden.push(bereinigt.slice(start,i)); start = i; }
  }
  summanden.push(bereinigt.slice(start));
  if(tiefe!==0) return null;
  return summanden;
}

export function parseTerm(eingabe){
  if(typeof eingabe !== 'string') return null;
  let bereinigt = eingabe.trim();
  if(bereinigt === '') return null;
  bereinigt = bereinigt.replace(/\s+/g, '').replace(/−/g, '-');
  if(!/^[+-]/.test(bereinigt)) bereinigt = `+${bereinigt}`;
  const summanden = zerlegeInSummanden(bereinigt);
  if(!summanden || summanden.join('') !== bereinigt) return null;
  const koeffizienten = { x2:0, x:0, zahl:0 };
  for(const summand of summanden){
    const vorzeichen = summand[0]==='-' ? -1 : 1;
    const rest = summand.slice(1);
    if(rest === '') return null;
    const teilErgebnis = parseSummand(rest);
    if(!teilErgebnis) return null;
    koeffizienten.x2 += vorzeichen * teilErgebnis.x2;
    koeffizienten.x += vorzeichen * teilErgebnis.x;
    koeffizienten.zahl += vorzeichen * teilErgebnis.zahl;
  }
  return koeffizienten;
}
export function nettoKoeffizienten(tiles){
  const ergebnis = { x2:0, x:0, zahl:0 };
  for(const tile of tiles) ergebnis[tile.kind] += tile.sign;
  return ergebnis;
}
export function koeffizientenGleich(a, b){
  return a.x2===b.x2 && a.x===b.x && a.zahl===b.zahl;
}

/** Parst eine Gleichungseingabe ("2x² - x + 3 = -x + 5") in zwei
 *  Koeffizienten-Objekte (links/rechts). Erwartet genau ein "=". */
export function parseGleichung(eingabe){
  if(typeof eingabe !== 'string') return null;
  const teile = eingabe.split('=');
  if(teile.length !== 2) return null;
  const links = parseTerm(teile[0]);
  const rechts = parseTerm(teile[1]);
  if(!links || !rechts) return null;
  return { links, rechts };
}
export function zufaelligeGanzzahl(min, max){
  return Math.floor(Math.random()*(max-min+1)) + min;
}
/* Runde 21 (Punkt 6/7, Nutzer-Rückmeldung: "Erhöhe die Wahrscheinlichkeit
   komplexerer Plättchen-Aufstellungen/Terme"): Maximum zweier unabhängiger
   Versuche – zieht den Wert zur oberen Hälfte des Bereichs hin, statt
   kleine/einfache Werte genauso häufig wie große zu ziehen. */
export function zufaelligeGanzzahlKomplex(min, max){
  return Math.max(zufaelligeGanzzahl(min,max), zufaelligeGanzzahl(min,max));
}
/** Zufällige, vorzeichenbehaftete Zahl in [-maxBetrag, maxBetrag], deren BETRAG zur oberen Hälfte hin verschoben ist – 0 bleibt weiterhin möglich. */
export function zufaelligeVorzeichenbehafteteZahlKomplex(maxBetrag){
  const betrag = zufaelligeGanzzahlKomplex(0, maxBetrag);
  return Math.random()<0.5 ? -betrag : betrag;
}
export function zufaelligeKoeffizienten({ mitX2 = true } = {}){
  let koeffizienten;
  do {
    koeffizienten = {
      x2: mitX2 ? zufaelligeVorzeichenbehafteteZahlKomplex(4) : 0,
      x: zufaelligeVorzeichenbehafteteZahlKomplex(6),
      zahl: zufaelligeVorzeichenbehafteteZahlKomplex(6),
    };
  } while(koeffizienten.x2===0 && koeffizienten.x===0 && koeffizienten.zahl===0);
  return koeffizienten;
}
/** Größter gemeinsamer Teiler (immer ≥1, auch für negative/0-Eingaben). */
export function ggT(a, b){
  a = Math.abs(a); b = Math.abs(b);
  while(b){ [a, b] = [b, a%b]; }
  return a || 1;
}
/** Runde 30 (Punkt 1): formatiert einen Bruch zaehler/nenner gekürzt, als
 *  ganze Zahl, falls er sich ohne Rest teilt. Für den "x ist keine ganze
 *  Zahl"-Hinweis in erzeugeGleichungsKette. */
export function formatiereBruch(zaehler, nenner){
  if(nenner<0){ zaehler = -zaehler; nenner = -nenner; }
  const teiler = ggT(zaehler, nenner);
  const z = zaehler/teiler, n = nenner/teiler;
  return n===1 ? String(z) : `${z}/${n}`;
}
// Runde 36 (Punkt 5, Nutzer-Rückmeldung: "+2x-3 anstatt 2x-3" soll NICHT
// mehr vorkommen – ein führendes "+" vor einem positiven ersten Summanden
// ist in der üblichen Notation unnötig): `ersterEintrag` unterdrückt das
// "+" (nicht das "−") genau beim ersten Summanden eines Terms.
export function formatEintrag(wert, symbol, ersterEintrag=false){
  const zeichen = wert>0 ? (ersterEintrag ? '' : '+') : '−';
  const abs = Math.abs(wert);
  const koeffizient = symbol==='' ? String(abs) : (abs===1 ? '' : String(abs));
  return `${zeichen}${koeffizient}${symbol}`;
}
export function formatiereKoeffizientenAlsTerm(koeffizienten){
  const eintraege = [];
  if(koeffizienten.x2!==0) eintraege.push({wert:koeffizienten.x2, symbol:'x²'});
  if(koeffizienten.x!==0) eintraege.push({wert:koeffizienten.x, symbol:'x'});
  if(koeffizienten.zahl!==0) eintraege.push({wert:koeffizienten.zahl, symbol:''});
  if(eintraege.length===0) return '0';
  return eintraege.map((e, i) => formatEintrag(e.wert, e.symbol, i===0)).join(' ');
}
/** Zufällige lineare Klammer-Koeffizienten ({x, zahl}, x garantiert ≠ 0). */
export function zufaelligeLineareKlammerKoeffizienten(){
  let x; do { x = zufaelligeVorzeichenbehafteteZahlKomplex(3); } while(x===0);
  const zahl = zufaelligeVorzeichenbehafteteZahlKomplex(5);
  return { x, zahl };
}
/** Formatiert eine lineare Klammer ({x, zahl}) für die Darstellung INNERHALB einer Klammer. */
export function formatiereLineareKlammerInhalt(koeffizienten){
  return formatiereKoeffizientenAlsTerm({ x2:0, x:koeffizienten.x, zahl:koeffizienten.zahl });
}
/** Zufälliger, nie verschwindender Vorfaktor vor einer Klammer. */
export function zufaelligerVorfaktor(){
  const betrag = zufaelligeGanzzahlKomplex(1, 4);
  return Math.random()<0.5 ? -betrag : betrag;
}
/** Baut "±<Betrag>(<Inhalt 1>)(<Inhalt 2>)" aus einem Vorfaktor und ein bis zwei bereits formatierten Klammer-Inhalten. */
export function formatiereVorfaktorUndKlammern(vorfaktor, klammerInhalte){
  const vorzeichenZeichen = vorfaktor<0 ? '−' : '+';
  const betrag = Math.abs(vorfaktor);
  const vorfaktorText = betrag===1 ? '' : String(betrag);
  const klammerText = klammerInhalte.map((inhalt) => `(${inhalt})`).join('');
  return `${vorzeichenZeichen}${vorfaktorText}${klammerText}`;
}
/**
 * Erzeugt eine zufällige KLAMMER-Aufgabe als String (Runde 22, Punkt 7:
 * "Term zu Plättchen: Klammern als Aufgabentyp hinzufügen"). Statt eines
 * bereits vereinfachten Terms steht hier ein Vorfaktor vor einer linearen
 * Klammer (z. B. "+3(+2x −1)"), bei erlaubtem x² mit 60% Wahrscheinlichkeit
 * stattdessen das Produkt ZWEIER linearer Klammern (z. B. "+2(+x −3)(+x +1)")
 * – die Schülerin/der Schüler muss den Term also erst gedanklich (bzw. am
 * Malkreuz) ausmultiplizieren. Mit weiteren 50% Wahrscheinlichkeit kommt
 * danach noch ein einzelnes zusätzliches Glied (x oder Zahl, nie x²) dazu.
 * parseTerm versteht beide Klammerformen bereits und multipliziert sie beim
 * Einlesen automatisch aus, sodass der bestehende Vergleich mit den
 * ausliegenden Plättchen unverändert funktioniert.
 */
export function erzeugeZufaelligenKlammerTerm({ mitX2 = true } = {}){
  let term, geparst;
  do {
    const zweiKlammern = mitX2 && Math.random()<0.6;
    const klammerInhalte = [formatiereLineareKlammerInhalt(zufaelligeLineareKlammerKoeffizienten())];
    if(zweiKlammern) klammerInhalte.push(formatiereLineareKlammerInhalt(zufaelligeLineareKlammerKoeffizienten()));

    term = formatiereVorfaktorUndKlammern(zufaelligerVorfaktor(), klammerInhalte);

    if(Math.random()<0.5){
      const zusatzIstX = Math.random()<0.5;
      let zusatzWert; do { zusatzWert = zufaelligeVorzeichenbehafteteZahlKomplex(zusatzIstX ? 4 : 6); } while(zusatzWert===0);
      term += ` ${formatiereKoeffizientenAlsTerm({ x2:0, x: zusatzIstX ? zusatzWert : 0, zahl: zusatzIstX ? 0 : zusatzWert })}`;
    }

    geparst = parseTerm(term);
  } while(!geparst || (geparst.x2===0 && geparst.x===0 && geparst.zahl===0));
  return term;
}

/**
 * Erzeugt einen zufälligen Term als String (für den "Zufällig"-Button bei
 * "Term zu Plättchen"). Seit Runde 22 (Punkt 7) fällt die Wahl mit 55%
 * Wahrscheinlichkeit auf eine neue Klammer-Aufgabe statt auf einen bereits
 * flachen, vereinfachten Term.
 */
export function erzeugeZufaelligenTerm(opts={}){
  if(Math.random()<0.55) return erzeugeZufaelligenKlammerTerm(opts);
  return formatiereKoeffizientenAlsTerm(zufaelligeKoeffizienten(opts));
}
// Runde 30 (Punkt 1, Nutzer-Rückmeldung: "Ich wollte nicht nur dass beim
// Wurzelziehen auf ganzzahlige Lösungen geachtet wird sondern immer.
// Gleichungen sollen nur so generiert werden dass x eine ganzzahlige Zahl
// ist"): bis Runde 29 wurden links/rechts VOLLSTÄNDIG unabhängig voneinander
// zufällig erzeugt – die resultierende Gleichung hatte dadurch im
// Allgemeinen GAR KEINE ganzzahlige (oft nicht einmal eine reelle, bei
// echtem x²-Unterschied) Lösung. Diese Funktion bestimmt stattdessen zuerst
// selbst eine zufällige GANZZAHLIGE Lösung `x`, erzeugt danach die linke
// Seite wie gewohnt zufällig und bestimmt die rechte Seite so, dass sie bei
// GENAU diesem x denselben Wert ergibt. Der x²-Koeffizient bleibt dabei auf
// beiden Seiten BEWUSST GLEICH – er kürzt sich beim Gleichsetzen vollständig
// heraus, wodurch stets eine in x LINEARE (und damit für eine frei gewählte
// ganze Zahl x immer exakt lösbare) Gleichung entsteht, nie eine "echte"
// quadratische mit womöglich nicht ganzzahliger oder gar nicht reeller
// Lösung – eine bewusste Scope-Entscheidung für einen reinen
// Zufallsgenerator ohne eigene Lösungsweg-Führung (vgl. Division durch einen
// Faktor/Wurzelziehen, die beide NUR als explizite, einzeln ausgeführte
// Äquivalenzumformungen existieren, nicht als Teil der Zufallserzeugung).
export const GLEICHUNG_X_BEREICH = 6;
export const GLEICHUNG_ZAHL_GRENZE = 40; // vermeidet ausufernd lange Plättchen-Stapel
export function erzeugeZufaelligeGleichungKoeffizienten(opts={}){
  // Runde 37 (Punkt 4, Nutzer-Rückmeldung: "sollen sich die x² nicht
  // komplett auflösen"): rechts.x2 wurde bis dahin IMMER exakt gleich
  // links.x2 gesetzt, damit sich x beim Lösen rein linear berechnen ließ –
  // genau dadurch hob sich x² beim Umstellen aber auch IMMER restlos auf,
  // die erzeugte "quadratische" Gleichung war also heimlich nie wirklich
  // quadratisch. Jetzt bekommt rechts einen eigenen, garantiert ANDEREN
  // x²-Koeffizienten; x bleibt trotzdem exakt ganzzahlige Lösung, weil
  // rechtsZahl direkt so berechnet wird, dass die Gleichung bei diesem x
  // aufgeht (die x²-Terme beider Seiten fließen jetzt mit in diese
  // Berechnung ein, statt sich strukturell wegzukürzen).
  const mitX2 = opts.mitX2 ?? true;
  for(let versuch=0; versuch<200; versuch+=1){
    const x = zufaelligeVorzeichenbehafteteZahlKomplex(GLEICHUNG_X_BEREICH);
    const links = zufaelligeKoeffizienten(opts);
    let rechtsX2 = links.x2;
    if(mitX2){
      do { rechtsX2 = zufaelligeVorzeichenbehafteteZahlKomplex(4); } while(rechtsX2===links.x2);
    }
    const rechtsX = zufaelligeVorzeichenbehafteteZahlKomplex(6);
    const rechtsZahl = links.x2*x*x + links.x*x + links.zahl - rechtsX2*x*x - rechtsX*x;
    const rechts = { x2: rechtsX2, x: rechtsX, zahl: rechtsZahl };
    if(links.x2===rechts.x2 && links.x===rechts.x && links.zahl===rechts.zahl) continue; // optisch identische Seiten -> keine erkennbare Gleichung
    if(Math.abs(rechtsZahl)>GLEICHUNG_ZAHL_GRENZE) continue;
    return { links, rechts, x };
  }
  // Fallback (praktisch nie erreicht): einfachste ganzzahlig lösbare
  // Gleichung, bei der x² (falls gefordert) ebenfalls nicht wegfällt.
  return mitX2
    ? { links:{x2:1,x:0,zahl:0}, rechts:{x2:-1,x:0,zahl:0}, x:0 }
    : { links:{x2:0,x:1,zahl:0}, rechts:{x2:0,x:0,zahl:0}, x:0 };
}
export function erzeugeZufaelligeGleichung(opts={}){
  const { links, rechts } = erzeugeZufaelligeGleichungKoeffizienten(opts);
  return `${formatiereKoeffizientenAlsTerm(links)} = ${formatiereKoeffizientenAlsTerm(rechts)}`;
}
// Runde 21 (Punkt 6): angehoben (war x2:2, x:3, zahl:3), damit größere
// Stapel und mehr gleichzeitig offene Nullpaare möglich sind.
export const KACHEL_GRENZEN = { x2:3, x:4, zahl:4 };
export function erzeugeZufaelligeKachelsammlung({ mitX2 = true } = {}){
  const kinds = mitX2 ? ['x2','x','zahl'] : ['x','zahl'];
  let sammlung;
  do {
    sammlung = [];
    for(const kind of kinds){
      // Runde 21 (Punkt 6): nutzt die nach oben verschobene
      // zufaelligeGanzzahlKomplex statt einer reinen Gleichverteilung.
      const positiv = zufaelligeGanzzahlKomplex(0, KACHEL_GRENZEN[kind]);
      const negativ = zufaelligeGanzzahlKomplex(0, KACHEL_GRENZEN[kind]);
      for(let i=0;i<positiv;i+=1) sammlung.push({ kind, sign:1 });
      for(let i=0;i<negativ;i+=1) sammlung.push({ kind, sign:-1 });
    }
  } while(sammlung.length===0);
  return sammlung;
}

/** Runde 21 (Punkt 6): prüft, ob ein eingetippter Term-Text bereits VOLLSTÄNDIG vereinfacht ist (jede Sorte höchstens einmal, keine Klammerform). */
export function istVereinfachterTermText(eingabe){
  if(typeof eingabe !== 'string') return false;
  let bereinigt = eingabe.trim().replace(/\s+/g,'').replace(/−/g,'-');
  if(bereinigt === '') return false;
  if(!/^[+-]/.test(bereinigt)) bereinigt = `+${bereinigt}`;
  const summanden = zerlegeInSummanden(bereinigt);
  if(!summanden || summanden.join('') !== bereinigt) return false;
  const gesehen = { x2:0, x:0, zahl:0 };
  for(const summand of summanden){
    const rest = summand.slice(1);
    if(rest === '') return false;
    if(MUSTER_X2.test(rest)) gesehen.x2 += 1;
    else if(MUSTER_X.test(rest)) gesehen.x += 1;
    else if(MUSTER_ZAHL.test(rest)) gesehen.zahl += 1;
    else return false; // Klammerform o. Ä. – nicht als vereinfachte Form akzeptiert
  }
  return gesehen.x2<=1 && gesehen.x<=1 && gesehen.zahl<=1;
}

/** Runde 21 (Punkt 7): prüft, ob eine Plättchen-Sammlung bereits VOLLSTÄNDIG gekürzt ist (keine Sorte mit sowohl positiven als auch negativen Plättchen). */
export function istKachelnVollstaendigGekuerzt(tiles){
  const zaehler = { x2:{pos:0,neg:0}, x:{pos:0,neg:0}, zahl:{pos:0,neg:0} };
  for(const tile of tiles){
    if(tile.sign>0) zaehler[tile.kind].pos += 1;
    else zaehler[tile.kind].neg += 1;
  }
  return Object.values(zaehler).every((z) => z.pos===0 || z.neg===0);
}

export function pruefeTermEingabe(eingabeText, erwartet, feedbackEl, opts={}){
  const { erfordertVereinfachteForm = false } = opts;
  feedbackEl.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
  const geparst = parseTerm(eingabeText);
  if(!geparst){
    feedbackEl.textContent = 'Konnte den Term nicht lesen. Beispiel: 2x² − x + 3 (auch als 2x^2 - x + 3 möglich).';
    feedbackEl.classList.add('term-check-feedback--fehler');
    return 'fehler';
  }
  if(!koeffizientenGleich(geparst, erwartet)){
    feedbackEl.textContent = 'Noch nicht richtig – versuch es noch einmal.';
    feedbackEl.classList.add('term-check-feedback--falsch');
    return 'falsch';
  }
  // Runde 21 (Punkt 6): bei "Plättchen zu Term" reicht der Wertevergleich
  // nicht mehr aus – nur der vollständig vereinfachte Text zählt als Lösung.
  if(erfordertVereinfachteForm && !istVereinfachterTermText(eingabeText)){
    feedbackEl.textContent = 'Der Wert stimmt schon, aber fasse gleichartige Glieder noch zusammen – trage den vollständig vereinfachten Term ein.';
    feedbackEl.classList.add('term-check-feedback--falsch');
    return 'unvereinfacht';
  }
  feedbackEl.textContent = 'Richtig!';
  feedbackEl.classList.add('term-check-feedback--richtig');
  return 'richtig';
}
export function pruefeGleichungEingabe(eingabeText, erwartetLinks, erwartetRechts, feedbackEl, opts={}){
  const { erfordertVereinfachteForm = false } = opts;
  feedbackEl.classList.remove('term-check-feedback--richtig', 'term-check-feedback--falsch', 'term-check-feedback--fehler');
  const geparst = parseGleichung(eingabeText);
  if(!geparst){
    feedbackEl.textContent = 'Konnte die Gleichung nicht lesen. Beispiel: 2x² − x + 3 = −x + 5 (auch als 2x^2 - x + 3 = -x + 5 möglich).';
    feedbackEl.classList.add('term-check-feedback--fehler');
    return 'fehler';
  }
  const passt = koeffizientenGleich(geparst.links, erwartetLinks) && koeffizientenGleich(geparst.rechts, erwartetRechts);
  if(!passt){
    feedbackEl.textContent = 'Noch nicht richtig – versuch es noch einmal.';
    feedbackEl.classList.add('term-check-feedback--falsch');
    return 'falsch';
  }
  if(erfordertVereinfachteForm){
    const [textLinks, textRechts] = eingabeText.split('=');
    if(!istVereinfachterTermText(textLinks) || !istVereinfachterTermText(textRechts)){
      feedbackEl.textContent = 'Der Wert stimmt schon, aber fasse auf beiden Seiten noch gleichartige Glieder zusammen – trage die vollständig vereinfachte Gleichung ein.';
      feedbackEl.classList.add('term-check-feedback--falsch');
      return 'unvereinfacht';
    }
  }
  feedbackEl.textContent = 'Richtig!';
  feedbackEl.classList.add('term-check-feedback--richtig');
  return 'richtig';
}
