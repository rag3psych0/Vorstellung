import { mountErklaerungenBereich } from './erklaerungen/module.js';
import { mountFunktionenBereich } from './funktionen/module.js';
import { mountGleichungenBereich } from './gleichungen/module.js';
import { mountTermeBereich } from './terme/module.js';

/* ============================================================
   App-Rahmen / oberste Navigationsebene (entspricht src/app.js): vier
   Reiter, jeweils mit eigenen Unterpunkten.
   ============================================================ */
export const BEREICHE = [
  {id:'erklaerungen', titel:'Erklärungen', mount:mountErklaerungenBereich},
  {id:'terme', titel:'Terme', mount:mountTermeBereich},
  {id:'gleichungen', titel:'Gleichungen', mount:mountGleichungenBereich},
  {id:'funktionen', titel:'Funktionen', mount:mountFunktionenBereich},
];
export function renderNav(navEl, contentEl){
  navEl.innerHTML = '';
  for(const bereich of BEREICHE){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modul-chip';
    btn.dataset.id = bereich.id;
    btn.textContent = bereich.titel;
    btn.addEventListener('click', () => {
      navEl.querySelectorAll('.modul-chip').forEach(b => b.dataset.aktiv = 'false');
      btn.dataset.aktiv = 'true';
      bereich.mount(contentEl);
    });
    navEl.appendChild(btn);
  }
}
export function init(){
  const navEl = document.getElementById('modul-nav');
  const contentEl = document.getElementById('modul-content');
  renderNav(navEl, contentEl);
  navEl.querySelector('.modul-chip').dataset.aktiv = 'true';
  BEREICHE[0].mount(contentEl);
}
init();
