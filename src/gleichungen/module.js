import { mountGleichungenUebungsAnsichten } from './ansichten.js';
import { TYPEN_OHNE_QUADRAT, erzeugeBereichsTabs } from '../shared/bereichsTabs.js';

/* ============================================================
   Bereich "Gleichungen" (entspricht .../gleichungen/module.js): dieselbe
   Struktur wie "Terme" (Linear/Quadratisch → Sandbox/Plättchen zu
   Gleichung/Gleichung zu Plättchen), aber mit zwei Seiten statt einer.
   ============================================================ */
export function mountGleichungenBereich(container){
  erzeugeBereichsTabs(container, {
    titel: 'Gleichungen',
    eintraege: [
      {id:'linear', titel:'Linear', mount:(el)=>mountGleichungenUebungsAnsichten(el, {typen:TYPEN_OHNE_QUADRAT})},
      {id:'quadratisch', titel:'Quadratisch', mount:(el)=>mountGleichungenUebungsAnsichten(el, {})},
    ],
  });
}
