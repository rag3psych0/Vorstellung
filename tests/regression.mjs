// Regressionstest: klickt sich durch ALLE Module, Bereiche und Ansichten
// der Anwendung und prüft, dass dabei keine neuen Konsolenfehler auftreten.
// Dies ist der nach jeder "Runde" (siehe claude/entwicklungsprotokoll-quelle.md
// im zugehörigen Projekt) verwendete Basis-Regressionstest.
import { chromium } from 'playwright';
import { BASE_URL, installErrorCollector } from './helpers.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 2600 } });
const errors = installErrorCollector(page);

try {
  await page.goto(BASE_URL, { timeout: 15000 });
  await page.waitForTimeout(300);

  const modulIds = await page.locator('.modul-chip').evaluateAll((els) => els.map((e) => e.dataset.id));
  console.log('Module:', modulIds);

  for(const modId of modulIds){
    await page.click(`.modul-chip[data-id="${modId}"]`);
    await page.waitForTimeout(200);
    const bereichIds = await page.locator('.bereich-tabs .ansicht-tab').evaluateAll((els) => els.map((e) => ({ id: e.dataset.id, disabled: e.disabled })));
    for(const b of bereichIds){
      if(b.disabled) continue;
      await page.click(`.bereich-tabs .ansicht-tab[data-id="${b.id}"]`);
      await page.waitForTimeout(150);
      const innerIds = await page.locator('.ansicht-inhalt .ansicht-tabs .ansicht-tab, .bereich-inhalt .ansicht-tabs .ansicht-tab').evaluateAll((els) => els.map((e) => ({ id: e.dataset.id, disabled: e.disabled })));
      for(const i of innerIds){
        if(i.disabled) continue;
        await page.click(`.ansicht-tabs .ansicht-tab[data-id="${i.id}"]`);
        await page.waitForTimeout(150);
      }
    }
  }

  console.log('Konsolenfehler nach komplettem Durchklicken:', errors);
  if(errors.length > 0){
    console.error('FEHLGESCHLAGEN: Regressionstest hat Konsolenfehler gefunden.');
    process.exitCode = 1;
  } else {
    console.log('OK: keine Konsolenfehler.');
  }
} finally {
  await browser.close();
}
