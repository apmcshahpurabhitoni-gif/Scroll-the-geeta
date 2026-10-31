// Screenshot the ad placeholder areas (below the fold on Today).
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(BASE + '/#/today');
await page.waitForFunction(() => window.__STG__ !== undefined, null, { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => document.querySelector('.ad-slot.ad-placeholder')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(400);
await page.screenshot({ path: 'artifacts/ad-placeholder.png' });
await browser.close();
console.log('artifacts/ad-placeholder.png written');
