import { erzeugeFreieFlaeche } from '../shared/freieFlaeche.js';

/* ============================================================
   Ansicht "Sandbox" (freies Legen ohne Vorgabe, entspricht .../sandbox.js,
   früher "Terme")
   ============================================================ */
export function mountSandbox(container, opts={}){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <p class="modul-intro">Füge über die Auswahl Plättchen hinzu. Erkennst du ein Nullpaar (ein positives und ein negatives Plättchen derselben Sorte), ziehe eines der beiden auf das andere, um es aufzulösen – trifft es nicht, springt es zurück. Mit gedrückter Maustaste über der Fläche kannst du mehrere gleichartige Plättchen zu einer Gruppe zusammenfassen und gemeinsam verschieben.</p>
    <div class="freie-flaeche"></div>
  `);
  erzeugeFreieFlaeche(container.querySelector('.freie-flaeche'), { flaechenTitel:'Bearbeitungsfläche', typen:opts.typen });
}
