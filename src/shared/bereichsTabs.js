import { ALLE_TYPEN } from './palette.js';

/* ============================================================
   Wiederverwendbarer Tab-Umschalter für einen Bereich mit mehreren
   Unterpunkten (entspricht src/shared/bereichsTabs.js). Unterpunkte ohne
   `mount` gelten als noch nicht umgesetzt und werden deaktiviert
   angezeigt.
   ============================================================ */
export function erzeugeBereichsTabs(container, { titel, eintraege, tabsKlasse='bereich-tabs' }){
  container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', `
    <h2 class="modul-titel">${titel}</h2>
    <div class="${tabsKlasse}" role="tablist"></div>
    <div class="bereich-inhalt"></div>
  `);
  const tabsEl = container.querySelector(`.${tabsKlasse}`);
  const inhaltEl = container.querySelector('.bereich-inhalt');
  function zeige(eintrag){
    tabsEl.querySelectorAll('.ansicht-tab').forEach(btn => {
      const aktiv = btn.dataset.id===eintrag.id;
      btn.classList.toggle('ansicht-tab--aktiv', aktiv);
      btn.setAttribute('aria-selected', String(aktiv));
    });
    eintrag.mount?.(inhaltEl);
  }
  for(const eintrag of eintraege){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ansicht-tab';
    btn.dataset.id = eintrag.id;
    btn.setAttribute('role','tab');
    btn.textContent = eintrag.titel;
    const verfuegbar = Boolean(eintrag.mount);
    btn.disabled = !verfuegbar;
    btn.title = verfuegbar ? '' : 'Noch nicht umgesetzt';
    btn.addEventListener('click', () => zeige(eintrag));
    tabsEl.appendChild(btn);
  }
  const erstesVerfuegbares = eintraege.find(e => e.mount);
  if(erstesVerfuegbares) zeige(erstesVerfuegbares);
}

// Für "Linear" fehlt x² in der Auswahl (die ersten beiden Einträge von
// ALLE_TYPEN) – der Rest (x, Zahl, je positiv/negativ) bleibt gleich.
export const TYPEN_OHNE_QUADRAT = ALLE_TYPEN.slice(2);
