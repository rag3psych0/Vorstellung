// Runde 35: Beim Einsetzen eines x-Werts stehen die farbigen
// Umrandungs-Gruppen immer in der Reihenfolge x² -> x -> 1, unabhängig vom
// Vorzeichen des jeweiligen Ergebnisses. Testfall mit bewusst GEMISCHTEN
// Ergebnis-Vorzeichen: +x² -> positiv, -x -> negativ, bestehendes +1 bleibt
// positiv.
import { chromium } from 'playwright';
import { BASE_URL, installErrorCollector } from './helpers.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
const errors = installErrorCollector(page);

async function waehleUndFuege(page, kind, sign, anzahl){
  const selector = `.palette .palette__item:has(svg.plaettchen--${kind}.plaettchen--${sign > 0 ? 'pos' : 'neg'})`;
  await page.click(selector);
  for(let i = 0; i < anzahl; i += 1) await page.click('.hinzufuegen-btn');
}

try {
  await page.goto(BASE_URL, { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.click('.modul-chip[data-id="terme"]');
  await page.waitForTimeout(200);
  await page.click('.ansicht-tab:has-text("Quadratisch")');
  await page.waitForTimeout(200);
  await page.click('.ansicht-tab:has-text("Sandbox")');
  await page.waitForTimeout(200);

  await waehleUndFuege(page, 'x2', 1, 1);
  await waehleUndFuege(page, 'x', -1, 1);
  await waehleUndFuege(page, 'zahl', 1, 1);
  await page.waitForTimeout(200);

  await page.fill('.x-wert-slider', '2');
  await page.dispatchEvent('.x-wert-slider', 'input');
  await page.waitForTimeout(100);
  await page.click('.x-wert-anwenden-btn');
  await page.waitForTimeout(300);

  const info = await page.evaluate(() => {
    const eintraege = [...document.querySelectorAll('.freie-flaeche__eintrag')];
    const letzter = eintraege[eintraege.length - 1];
    const rahmen = [...letzter.querySelectorAll('.freie-tafel__einsetzen-rahmen')]
      .map((el) => ({ left: parseFloat(el.style.left) }))
      .sort((a, b) => a.left - b.left);
    const kacheln = [...letzter.querySelectorAll('.freie-tafel__kachel')]
      .map((el) => ({ left: parseFloat(el.style.left), label: el.getAttribute('aria-label') }))
      .sort((a, b) => a.left - b.left);
    return { rahmen, kacheln };
  });

  // Erwartung: 3 Spalten, von links nach rechts nach HERKUNFT geordnet
  // (x²-Ursprung, dann x-Ursprung, dann das unveränderte +1), unabhängig
  // vom jeweiligen Ergebnis-Vorzeichen.
  const linksZuRechts = [...new Set(info.kacheln.map((k) => k.left))].sort((a, b) => a - b);
  const gruppen = linksZuRechts.map((l) => info.kacheln.filter((k) => k.left === l));
  const vorzeichen = gruppen.map((g) => (g[0].label.startsWith('+') ? '+' : '−'));

  console.log('Spalten-Vorzeichen (links -> rechts):', vorzeichen, '(erwartet: +, −, + — x²-Ursprung positiv, x-Ursprung negativ, bestehendes +1 zuletzt)');
  console.log('Anzahl Umrandungen:', info.rahmen.length, '(erwartet 2 — nur x²- und x-Ursprung, nicht das bestehende +1)');

  const passt = gruppen.length === 3 && vorzeichen.join('') === '+−+' && info.rahmen.length === 2;
  console.log('Konsolenfehler:', errors);
  if(!passt || errors.length > 0){
    console.error('FEHLGESCHLAGEN: Reihenfolge oder Konsolenfehler weichen vom erwarteten Verhalten ab.');
    process.exitCode = 1;
  } else {
    console.log('OK: Reihenfolge x² -> x -> 1 bleibt trotz Vorzeichenwechsel erhalten.');
  }
} finally {
  await browser.close();
}
