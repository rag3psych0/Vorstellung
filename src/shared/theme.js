import { berechneTafelLayout } from './freieTafel.js';

/* ============================================================
   Theme (entspricht src/shared/theme.js)
   Grundfarben = positiv, Komplementärfarben = negativ.
   textColor wird pro Kachel so gewählt, dass das +/- Symbol auf
   der jeweiligen Füllfarbe ausreichend Kontrast hat.
   ============================================================ */
export const THEME = {
  /* Runde 22 Punkt 8: Farben für +1/−1 vertauscht (+1 jetzt Grün, −1 jetzt Rot). */
  zahl:{ positive:{fill:'#3CB371', label:'+1', text:'#123522'}, negative:{fill:'#D62839', label:'−1', text:'#ffffff'} },
  x:   { positive:{fill:'#3A6EA5', label:'+x', text:'#ffffff'}, negative:{fill:'#F0932B', label:'−x', text:'#3a2100'} },
  x2:  { positive:{fill:'#F6C445', label:'+x²', text:'#3a2c00'}, negative:{fill:'#8E5572', label:'−x²', text:'#ffffff'} },
};
export function styleFor(kind, sign){ return THEME[kind][sign>0 ? 'positive' : 'negative']; }

/* Alle drei Typen sind Rechtecke unterschiedlicher Größe (wie klassische
   Algebra-Kacheln): 1-Plättchen = kleines Quadrat, x-Plättchen = Balken mit
   gleicher Höhe wie das 1-Plättchen und gleicher Breite wie das
   x²-Plättchen, x²-Plättchen = großes Quadrat. */
/* Runde 24 (Punkt 9): etwas größer als zuvor (32->36), zugleich Basis für
   die Kästchengröße des Hintergrundrasters der freien Tafel (siehe
   berechneTafelLayout/--zelle weiter unten) – 1-Plättchen und Kästchen
   sind dadurch immer exakt gleich groß (Punkt 10/11). */
export const TILE_UNIT = 36;
export const TILE_LONG = 72;
export const GRUNDMASSE = {
  zahl:{ w:TILE_UNIT, h:TILE_UNIT },
  x:   { w:TILE_LONG, h:TILE_UNIT },
  x2:  { w:TILE_LONG, h:TILE_LONG },
};
export function tileDimensions(kind, scale=1){
  const basis = GRUNDMASSE[kind];
  return { w: basis.w*scale, h: basis.h*scale };
}
