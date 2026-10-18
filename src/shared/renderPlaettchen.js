import { styleFor, tileDimensions } from './theme.js';

/* ============================================================
   Rendering (entspricht src/shared/renderPlaettchen.js)
   ============================================================ */
export const SVG_NS = 'http://www.w3.org/2000/svg';
export let hatchReady = false;
export function ensureHatchPattern(svgRoot){
  if(hatchReady) return;
  let defs = svgRoot.querySelector('defs');
  if(!defs){ defs = document.createElementNS(SVG_NS,'defs'); svgRoot.insertBefore(defs, svgRoot.firstChild); }
  const pattern = document.createElementNS(SVG_NS,'pattern');
  pattern.setAttribute('id','plaettchen-hatch-negativ');
  pattern.setAttribute('width','6'); pattern.setAttribute('height','6');
  pattern.setAttribute('patternTransform','rotate(45)');
  pattern.setAttribute('patternUnits','userSpaceOnUse');
  const line = document.createElementNS(SVG_NS,'line');
  line.setAttribute('x1','0'); line.setAttribute('y1','0'); line.setAttribute('x2','0'); line.setAttribute('y2','6');
  line.setAttribute('stroke','rgba(255,255,255,0.55)'); line.setAttribute('stroke-width','3');
  pattern.appendChild(line);
  defs.appendChild(pattern);
  hatchReady = true;
}
export function createPlaettchenElement(kind, sign, opts={}){
  const scale = opts.scale ?? 1;
  let { w, h } = tileDimensions(kind, scale);
  if(opts.vertical){ [w, h] = [h, w]; }
  const svg = document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.classList.add('plaettchen', `plaettchen--${kind}`, sign>0 ? 'plaettchen--pos' : 'plaettchen--neg');
  if(opts.id) svg.dataset.tileId = opts.id;
  ensureHatchPattern(svg);

  const style = styleFor(kind, sign);
  // Runde 25 (Punkt 4/5, Nutzer-Rückmeldung: "Die Plättchen sollen perfekt
  // die Kästchen ausfüllen"/"im Malkreuz darf kein Abstand mehr sein – die
  // müssen aneinander anliegen"): vormals 9% Innenabstand auf jeder Seite,
  // wodurch zwei aneinandergrenzende Plättchen (gleiche Boundingbox, siehe
  // berechneLayout/colLefts/rowTops) optisch einen Spalt zwischen sich
  // hatten und ein einzelnes Plättchen sein Kästchen nie ganz ausfüllte. Nur
  // noch ein minimaler, fixer Rand (unabhängig von der Kachelgröße), knapp
  // groß genug, damit der Rahmen (stroke-width 1.5) nicht am SVG-Rand
  // abgeschnitten wird.
  const pad = 1;

  const rect = document.createElementNS(SVG_NS,'rect');
  rect.setAttribute('x', String(pad)); rect.setAttribute('y', String(pad));
  rect.setAttribute('width', String(w-pad*2)); rect.setAttribute('height', String(h-pad*2));
  rect.setAttribute('rx', String(Math.min(w,h)*0.08));
  rect.setAttribute('fill', style.fill);
  rect.setAttribute('stroke','rgba(0,0,0,0.25)');
  rect.setAttribute('stroke-width','1.5');
  svg.appendChild(rect);

  if(sign<0){
    const hatchEl = rect.cloneNode();
    hatchEl.setAttribute('fill','url(#plaettchen-hatch-negativ)');
    hatchEl.removeAttribute('stroke');
    svg.appendChild(hatchEl);
  }

  const label = opts.zeigeWert ? style.label : (sign>0 ? '+' : '−');
  const text = document.createElementNS(SVG_NS,'text');
  text.setAttribute('x','50%'); text.setAttribute('y','52%');
  text.setAttribute('text-anchor','middle'); text.setAttribute('dominant-baseline','middle');
  text.setAttribute('font-size', String(Math.min(w,h) * (label.length>2 ? 0.30 : 0.36)));
  text.setAttribute('font-weight','700');
  text.setAttribute('fill', style.text);
  text.textContent = label;
  svg.appendChild(text);

  svg.setAttribute('role','img');
  svg.setAttribute('aria-label', `${style.label} Plättchen`);
  return svg;
}
