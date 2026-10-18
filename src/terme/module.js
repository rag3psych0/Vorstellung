import { TYPEN_OHNE_QUADRAT, erzeugeBereichsTabs } from '../shared/bereichsTabs.js';
import { mountUebungsAnsichten } from './uebungsAnsichten.js';

/* ============================================================
   Bereich "Terme" (entspricht .../terme/module.js): "Linear" (ohne x²)
   und "Quadratisch" (alle sechs Typen) teilen sich dieselben drei
   Übungsansichten (Sandbox / Plättchen zu Term / Term zu Plättchen), nur
   mit unterschiedlicher Auswahl.
   ============================================================ */
export function mountTermeBereich(container){
  erzeugeBereichsTabs(container, {
    titel: 'Terme',
    eintraege: [
      {id:'linear', titel:'Linear', mount:(el)=>mountUebungsAnsichten(el, {typen:TYPEN_OHNE_QUADRAT})},
      {id:'quadratisch', titel:'Quadratisch', mount:(el)=>mountUebungsAnsichten(el, {})},
    ],
  });
}
