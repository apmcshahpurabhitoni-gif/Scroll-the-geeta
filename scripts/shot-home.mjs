// Screenshot the default landing screen (reading feed, first sloka).
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(BASE + '/');
await page.waitForFunction(() => window.__STG__ !== undefined, null, { timeout: 20000 });
await page.waitForTimeout(1200);
const route = await page.evaluate(() => (location.hash || '(no hash) → default route'));
console.log('landed:', route);
await page.screenshot({ path: 'artifacts/home-first-sloka.png' });
// scroll to the next sloka, screenshot again
await page.evaluate(() => document.getElementById('feed')?.scrollBy({ top: 400 }));
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(900);
await page.screenshot({ path: 'artifacts/home-next-sloka.png' });
const state = await page.evaluate(() => ({
  ref: document.getElementById('now-ref')?.textContent,
  hintHidden: document.getElementById('feed')?.classList.contains('read-started'),
}));
console.log(JSON.stringify(state));
await browser.close();
