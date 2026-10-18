// Runde 34: Automatische Ausrichtungs-Erkennung für x-Produktplättchen im
// Malkreuz, solange noch nicht beide Achsen feststehen. Ein x²-Plättchen
// legt beide angrenzenden Achsen auf "x" fest; ein x-Plättchen in derselben
// Zeile muss dadurch stehend (schmal×hoch), eines in derselben Spalte
// liegend (breit×schmal) gerendert werden.
import { chromium } from 'playwright';
import { BASE_URL, installErrorCollector, ziehenAuf } from './helpers.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 2600 } });
const errors = installErrorCollector(page);

try {
  await page.goto(BASE_URL, { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.click('.modul-chip[data-id="terme"]');
  await page.waitForTimeout(200);
  await page.click('.ansicht-tab:has-text("Quadratisch")');
  await page.waitForTimeout(200);
  await page.click('.ansicht-tab:has-text("Sandbox")');
  await page.waitForTimeout(200);
  await page.click('.malkreuz-toggle-btn');
  await page.waitForTimeout(200);

  const hitzone = page.locator('.malkreuz__hitzone--produkt').first();
  const xItemPos = page.locator('.palette .palette__item').filter({ has: page.locator('svg.plaettchen--x.plaettchen--pos') }).first();
  const x2ItemPos = page.locator('.palette .palette__item').filter({ has: page.locator('svg.plaettchen--x2.plaettchen--pos') }).first();

  // x2 bei (0,0) ablegen.
  let hzBox = await hitzone.boundingBox();
  await ziehenAuf(page, x2ItemPos, hzBox, 15, 15);
  await page.waitForTimeout(150);
  // x bei (0,1) ablegen (klar rechts -> selbe Zeile wie x2 -> stehend).
  hzBox = await hitzone.boundingBox();
  await ziehenAuf(page, xItemPos, hzBox, 130, 15);
  await page.waitForTimeout(150);
  // x bei (1,0) ablegen (klar darunter -> selbe Spalte wie x2 -> liegend).
  hzBox = await hitzone.boundingBox();
  await ziehenAuf(page, xItemPos, hzBox, 15, 110);
  await page.waitForTimeout(200);

  const kacheln = await page.locator('.andock-raster__vormerkung-kachel').all();
  const masse = [];
  for(const k of kacheln){
    masse.push({ w: Number(await k.getAttribute('width')), h: Number(await k.getAttribute('height')) });
  }
  console.log('Gemessene Maße:', masse);

  const erwartet = [{ w: 72, h: 72 }, { w: 36, h: 72 }, { w: 72, h: 36 }];
  const passt = masse.length === 3 && erwartet.every((e, i) => masse[i].w === e.w && masse[i].h === e.h);

  console.log('Konsolenfehler:', errors);
  if(!passt || errors.length > 0){
    console.error('FEHLGESCHLAGEN: Maße oder Konsolenfehler weichen vom erwarteten Verhalten ab.');
    process.exitCode = 1;
  } else {
    console.log('OK: Ausrichtungs-Erkennung liefert die erwarteten Maße (72×72, 36×72, 72×36).');
  }
} finally {
  await browser.close();
}
