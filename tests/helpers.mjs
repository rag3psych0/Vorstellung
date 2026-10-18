// Gemeinsame Hilfsfunktionen für die Playwright-Tests dieses Projekts.
// BASE_URL kann per Umgebungsvariable überschrieben werden
// (siehe scripts/run-tests.sh, Standard-Port 8099).
export const BASE_URL = process.env.PM_TEST_URL || 'http://localhost:8099/index.html';

export function installErrorCollector(page){
  const errors = [];
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + String(err)));
  page.on('console', (msg) => {
    if(msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text());
  });
  return errors;
}

/** Zieht ein Palette-/Produkt-Plättchen per Maus auf ein Zielrechteck (relativ zu dessen Bounding-Box). */
export async function ziehenAuf(page, item, zielBox, offsetX, offsetY){
  const itemBox = await item.boundingBox();
  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(zielBox.x + offsetX, zielBox.y + offsetY, { steps: 8 });
  await page.waitForTimeout(30);
  await page.mouse.up();
}
