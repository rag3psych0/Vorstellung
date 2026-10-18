import { createPlaettchenElement } from './renderPlaettchen.js';
import { tileDimensions } from './theme.js';

/* ============================================================
   Palette (entspricht src/shared/palette.js)
   ============================================================ */
export const ALLE_TYPEN = [
  {kind:'x2', sign:1}, {kind:'x2', sign:-1},
  {kind:'x', sign:1}, {kind:'x', sign:-1},
  {kind:'zahl', sign:1}, {kind:'zahl', sign:-1},
];
export const PALETTE_SKALIERUNG = 0.75;
export function createPalette(container, { onDrop, typen = ALLE_TYPEN } = {}){
  let ausgewaehlt = typen[typen.length-2]; // Standard: +1
  function render(){
    container.innerHTML = '';
    for(const typ of typen){
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'palette__item';
      if(typ.kind===ausgewaehlt.kind && typ.sign===ausgewaehlt.sign) item.classList.add('palette__item--aktiv');
      const svg = createPlaettchenElement(typ.kind, typ.sign, {scale:PALETTE_SKALIERUNG, zeigeWert:true});
      svg.style.pointerEvents = 'none';
      item.appendChild(svg);
      item.addEventListener('click', () => { ausgewaehlt = typ; render(); });
      item.addEventListener('pointerdown', (event) => starteZiehen(event, typ));
      container.appendChild(item);
    }
  }
  function starteZiehen(event, typ){
    event.preventDefault();
    const { w, h } = tileDimensions(typ.kind);
    const ghost = createPlaettchenElement(typ.kind, typ.sign, {zeigeWert:true});
    ghost.style.position = 'fixed';
    ghost.style.left = `${event.clientX - w/2}px`;
    ghost.style.top = `${event.clientY - h/2}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '1000';
    ghost.style.filter = 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))';
    document.body.appendChild(ghost);
    const onMove = (moveEvent) => {
      ghost.style.left = `${moveEvent.clientX - w/2}px`;
      ghost.style.top = `${moveEvent.clientY - h/2}px`;
    };
    const onUp = (upEvent) => {
      window.removeEventListener('pointermove', onMove);
      ghost.remove();
      onDrop?.(typ, {clientX:upEvent.clientX, clientY:upEvent.clientY});
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, {once:true});
  }
  render();
  return { getAusgewaehlt: () => ausgewaehlt };
}
