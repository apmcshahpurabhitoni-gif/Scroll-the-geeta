// Capture every screen at phone + desktop sizes for a UI review pass.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
mkdirSync('artifacts/ui', { recursive: true });

const browser = await chromium.launch();

async function shot(ctxName, viewport, routes) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  let page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  for (const [name, hash, after] of routes) {
    try {
      await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__STG__ !== undefined, null, { timeout: 20000 });
      await page.waitForTimeout(900);
      if (after) await after(page);
      await page.screenshot({ path: `artifacts/ui/${ctxName}-${name}.png` });
      const m = await page.evaluate(() => ({
        docW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
        feedH: Math.round(document.getElementById('feed')?.getBoundingClientRect().height || 0),
        view: decodeURIComponent(location.hash),
      }));
      if (m.docW > m.winW + 1) console.log(`  !! horizontal overflow on ${name}: ${m.docW} > ${m.winW}`);
      console.log(`${ctxName}/${name}`, JSON.stringify(m));
    } catch (err) {
      console.log(`  !! ${ctxName}/${name} failed: ${err.message.split('\n')[0]}`);
      try {
        await page.close();
      } catch {}
      const fresh = await ctx.newPage();
      page = fresh;
    }
  }
  if (errors.length) console.log(`${ctxName} console errors:`, errors);
  await ctx.close();
}

const scrollNext = async (page) => {
  await page.evaluate(() => {
    const feed = document.getElementById('feed');
    feed.scrollTo({ top: feed.clientHeight, behavior: 'instant' });
  });
  await page.waitForTimeout(500);
};

await shot('phone', { width: 390, height: 844 }, [
  ['read-1', '#/explore'],
  ['read-2', '#/explore', scrollNext],
  ['today', '#/today'],
  ['topics', '#/topics'],
  ['saved', '#/saved'],
  ['journey', '#/journey'],
]);

await shot('small', { width: 360, height: 640 }, [
  ['read-1', '#/explore'],
  ['journey', '#/journey'],
]);

await shot('desktop', { width: 1280, height: 800 }, [
  ['read-1', '#/explore'],
  ['today', '#/today'],
  ['journey', '#/journey'],
]);

// dark theme parity
const darkCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
const darkPage = await darkCtx.newPage();
for (const [name, hash] of [
  ['read-1', '#/explore'],
  ['today', '#/today'],
  ['journey', '#/journey'],
]) {
  await darkPage.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await darkPage.waitForFunction(() => window.__STG__ !== undefined, null, { timeout: 20000 });
  await darkPage.waitForTimeout(800);
  await darkPage.screenshot({ path: `artifacts/ui/dark-${name}.png` });
}
await darkCtx.close();

await browser.close();
