import { mountPlaettchenZuTerm } from './plaettchenZuTerm.js';
import { mountSandbox } from './sandbox.js';
import { mountTermZuPlaettchen } from './termZuPlaettchen.js';

/* ============================================================
   Innerer Umschalter Sandbox/Plättchen zu Term/Term zu Plättchen
   (entspricht .../terme/uebungsAnsichten.js) – wiederverwendet von
   "Linear" und "Quadratisch" mit unterschiedlicher `typen`-Auswahl.
   ============================================================ */
export function mountUebungsAnsichten(container, opts={}){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <div class="ansicht-tabs" role="tablist"></div>
    <div class="ansicht-inhalt"></div>
  `);
  const ANSICHTEN = [
    {id:'sandbox', titel:'Sandbox', mount:(el)=>mountSandbox(el, opts)},
    {id:'plaettchen-zu-term', titel:'Plättchen zu Term', mount:(el)=>mountPlaettchenZuTerm(el, opts)},
    {id:'term-zu-plaettchen', titel:'Term zu Plättchen', mount:(el)=>mountTermZuPlaettchen(el, opts)},
  ];
  const tabsEl = container.querySelector('.ansicht-tabs');
  const inhaltEl = container.querySelector('.ansicht-inhalt');
  function zeigeAnsicht(ansicht){
    tabsEl.querySelectorAll('.ansicht-tab').forEach(btn => {
      const aktiv = btn.dataset.id===ansicht.id;
      btn.classList.toggle('ansicht-tab--aktiv', aktiv);
      btn.setAttribute('aria-selected', String(aktiv));
    });
    ansicht.mount(inhaltEl);
  }
  for(const ansicht of ANSICHTEN){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ansicht-tab';
    btn.dataset.id = ansicht.id;
    btn.setAttribute('role','tab');
    btn.textContent = ansicht.titel;
    btn.addEventListener('click', () => zeigeAnsicht(ansicht));
    tabsEl.appendChild(btn);
  }
  zeigeAnsicht(ANSICHTEN[0]);
}
