// Headless audit of the deployed app: console errors, failed requests, loader state, screenshots.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.AUDIT_URL || 'https://site-319aa22e54d448878c96aed3c801558c.freebuff.page/';
mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch();
for (const vp of [
  { w: 390, h: 844, name: 'mobile' },
  { w: 1280, h: 800, name: 'desktop' },
]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  const errors = [];
  const failed = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${(r.failure() || {}).errorText}`));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errors.push('goto: ' + e.message));
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => ({
    loaderDone: document.getElementById('loader')?.classList.contains('done'),
    loaderText: (document.getElementById('loader')?.innerText || '').slice(0, 150),
    ref: document.getElementById('now-ref')?.textContent,
    chapter: document.getElementById('now-chapter')?.textContent,
    sections: document.querySelectorAll('.verse').length,
    firstVerseText: (document.querySelector('.verse .sk')?.textContent || '').slice(0, 80),
    firstTranslation: (document.querySelector('.verse .en')?.textContent || '').slice(0, 120),
    translatorLabel: document.getElementById('translator-name')?.textContent,
    bodyScrollW: document.body.scrollWidth,
    innerW: window.innerWidth,
  }));

  console.log(`\n=== ${vp.name} ${vp.w}x${vp.h} ===`);
  console.log(JSON.stringify(state, null, 2));
  console.log('console errors:', errors.length ? errors : 'none');
  console.log('failed requests:', failed.length ? failed : 'none');

  await page.screenshot({ path: `artifacts/audit-${vp.name}.png` });
  await page.close();
}
await browser.close();
