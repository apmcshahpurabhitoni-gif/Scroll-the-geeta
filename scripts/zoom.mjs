// Zoomed capture of the Sanskrit text to inspect a suspected glyph artifact.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 500 }, deviceScaleFactor: 3 });
await page.goto(`${BASE}/#/today`);
await page.waitForFunction(() => window.__STG__ !== undefined, null, { timeout: 20000 });
await page.waitForTimeout(800);
const sk = page.locator('#view-today .sk');
await sk.scrollIntoViewIfNeeded();
await sk.screenshot({ path: 'artifacts/zoom-sk.png' });

// Report font + glyph diagnostics around the suspected conjunct.
const info = await page.evaluate(() => {
  const el = document.querySelector('#view-today .sk');
  const text = el.textContent;
  const target = 'र्भ';
  const idx = text.indexOf(target);
  return {
    text,
    hasRaBha: idx,
    fontFamily: getComputedStyle(el).fontFamily,
    fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family}:${f.weight}`),
    devaLoaded: document.fonts.check('16px "Noto Serif Devanagari"'),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
