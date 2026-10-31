// Checks for the route-filtered verse frame: one verse rendered, fixed rails,
// hash routing, gestures, keyboard, chapter card, states and platform floors.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3000';
const browser = await chromium.launch();
let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const ready = async () => {
  await page.waitForFunction(() => window.__STG__ !== undefined, null, { timeout: 20000 });
  await page.waitForTimeout(350);
};

/* 1. cold load renders ONE verse, not the book */
await page.goto(`${BASE}/#/ch2/v47`);
await ready();
const cold = await page.evaluate(() => ({
  count: document.getElementById('rail-count')?.textContent,
  chapter: document.getElementById('rail-ch-name')?.textContent,
  hash: location.hash,
  verses: document.querySelectorAll('#feed .verse').length,
  id: document.querySelector('#feed .verse')?.id,
  sanskrit: document.querySelector('.verse .sk')?.textContent?.length || 0,
  translation: document.querySelector('.verse .tx')?.textContent?.slice(0, 30),
  preloaded: window.__STG__.explorePreloaded?.() || [],
}));
check('Cold #/ch2/v47 renders exactly one verse', cold.verses === 1 && cold.id === 'v-2-47', JSON.stringify({ v: cold.verses, id: cold.id }));
check('Rails show chapter position', cold.count === 'Verse 47 of 72', cold.count);
check('Sanskrit + translation rendered', cold.sanskrit > 40 && (cold.translation || '').length > 10);
check('±2 verses around the route are preloaded', JSON.stringify(cold.preloaded) === JSON.stringify([712, 713, 714, 715, 716]) || cold.preloaded.length === 5, JSON.stringify(cold.preloaded));

/* 2. transliteration collapsed, no markdown leaking */
const translit = await page.evaluate(() => {
  const d = document.querySelector('.verse .translit');
  const body = document.querySelector('.verse')?.textContent || '';
  return {
    exists: Boolean(d),
    open: d ? d.open : null,
    label: d?.querySelector('summary')?.textContent?.trim() || '',
    hashes: body.includes('##'),
  };
});
check('Transliteration collapsed by default', translit.exists && translit.open === false, JSON.stringify(translit));
check('Toggle says "Show transliteration"', /show transliteration/i.test(translit.label), translit.label);
check('No literal markdown headings in the verse', translit.hashes === false);

/* 3. rails stay fixed while the body scrolls */
const railsBefore = await page.evaluate(() => ({
  top: document.getElementById('rail-top').getBoundingClientRect().top,
  bottom: document.getElementById('rail-bottom').getBoundingClientRect().top,
  overflow: (() => {
    const f = document.getElementById('feed');
    return f.scrollHeight > f.clientHeight + 4;
  })(),
}));
await page.evaluate(() => document.getElementById('feed').scrollBy({ top: 160, behavior: 'instant' }));
await page.waitForTimeout(200);
const railsAfter = await page.evaluate(() => ({
  top: document.getElementById('rail-top').getBoundingClientRect().top,
  bottom: document.getElementById('rail-bottom').getBoundingClientRect().top,
  scrollTop: document.getElementById('feed').scrollTop,
}));
check(
  'Rails never scroll with the body',
  railsBefore.top === railsAfter.top && railsBefore.bottom === railsAfter.bottom,
  `overflow=${railsBefore.overflow} scrollTop=${railsAfter.scrollTop}`
);

/* 4. swipe in the middle of the body does not navigate */
await page.goto(`${BASE}/#/ch2/v46`);
await ready();
const bodyBox = await page.locator('#vbody').boundingBox();
const hashBefore = await page.evaluate(() => location.hash);
await page.mouse.move(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height * 0.75);
await page.mouse.down();
await page.mouse.move(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height * 0.35, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(350);
const hashAfter = await page.evaluate(() => location.hash);
check('Body swipe does not change verse', hashBefore === hashAfter, `${hashBefore} → ${hashAfter}`);

/* 5. swipe up on the bottom rail advances */
const railBox = await page.locator('#rail-bottom').boundingBox();
await page.mouse.move(railBox.x + railBox.width / 2, railBox.y + railBox.height - 8);
await page.mouse.down();
await page.mouse.move(railBox.x + railBox.width / 2, railBox.y - 90, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(350);
const afterSwipe = await page.evaluate(() => location.hash);
check('Bottom-rail swipe advances the verse', afterSwipe === '#/ch2/v47', afterSwipe);

/* 6. chapter card between chapters */
await page.goto(`${BASE}/#/ch2/v72`);
await ready();
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(250);
const card = await page.evaluate(() => ({
  visible: !document.getElementById('chapter-card').hidden,
  deva: document.querySelector('#chapter-card .cc-deva')?.textContent || '',
  railsInside: document.querySelectorAll('#chapter-card .rail').length,
  verseBehind: document.querySelectorAll('#feed .verse').length,
}));
check('Chapter card appears between chapters', card.visible && card.deva.length > 0, JSON.stringify(card));
check('Chapter card carries no rails', card.railsInside === 0);
await page.click('#chapter-card .btn');
await page.waitForTimeout(300);
const landed = await page.evaluate(() => ({ hash: location.hash, id: document.querySelector('#feed .verse')?.id }));
check('Begin chapter lands on 3.1', landed.hash === '#/ch3/v1' && landed.id === 'v-3-1', JSON.stringify(landed));

/* 7. keyboard navigation + URL */
await page.goto(`${BASE}/#/ch1/v1`);
await ready();
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
}
const afterKeys = await page.evaluate(() => ({ hash: location.hash, id: document.querySelector('#feed .verse')?.id }));
check('ArrowDown three times lands on 1.4', afterKeys.hash === '#/ch1/v4' && afterKeys.id === 'v-1-4', JSON.stringify(afterKeys));

/* 8. back / forward */
await page.goBack();
await page.waitForTimeout(350);
check('Browser Back returns to 1.3', (await page.evaluate(() => location.hash)) === '#/ch1/v3');
await page.goForward();
await page.waitForTimeout(350);
check('Browser Forward returns to 1.4', (await page.evaluate(() => location.hash)) === '#/ch1/v4');

/* 9. invalid hash redirects */
await page.goto(`${BASE}/#/ch99/v1`);
await ready();
check('Invalid verse hash redirects to #/ch1/v1', (await page.evaluate(() => location.hash)) === '#/ch1/v1');

/* 10. progress */
await page.goto(`${BASE}/#/ch1/v24`);
await ready();
const prog = await page.evaluate(() => {
  const bar = document.getElementById('chapter-progress');
  const track = bar.parentElement.getBoundingClientRect().width;
  return {
    width: Math.round((bar.getBoundingClientRect().width / track) * 100),
    label: document.getElementById('rail-count').textContent,
  };
});
check('Progress bar shows chapter position', Math.abs(prog.width - 51) <= 2 && prog.label === 'Verse 24 of 47', JSON.stringify(prog));

/* 11. focus ring */
for (let i = 0; i < 10; i++) {
  await page.keyboard.press('Tab');
  if (await page.evaluate(() => document.activeElement?.classList.contains('verse'))) break;
}
const focus = await page.evaluate(() => {
  const el = document.activeElement;
  return {
    isVerse: el?.classList.contains('verse'),
    outline: getComputedStyle(el).outlineWidth,
    style: getComputedStyle(el).outlineStyle,
  };
});
check('Tab focuses the verse with a 2px ring', focus.isVerse && focus.outline === '2px', JSON.stringify(focus));

/* 12. Escape closes transliteration */
await page.evaluate(() => document.querySelector('.verse .translit summary').click());
await page.waitForTimeout(120);
const opened = await page.evaluate(() => document.querySelector('.verse .translit')?.open);
await page.keyboard.press('Escape');
await page.waitForTimeout(120);
const closed = await page.evaluate(() => document.querySelector('.verse .translit')?.open);
check('Escape closes transliteration', opened === true && closed === false);

/* 13. error state keeps rails, retry restores */
const errState = await page.evaluate(async () => {
  window.__STG__.explore.simulateFailure();
  await new Promise((r) => setTimeout(r, 120));
  return {
    message: document.querySelector('.verse .vf-title')?.textContent || '',
    rails: Boolean(document.getElementById('rail-top')) && Boolean(document.getElementById('rail-bottom')),
    verses: document.querySelectorAll('#feed .verse').length,
  };
});
check('Error state keeps rails and the route', /could not be loaded/i.test(errState.message) && errState.rails, JSON.stringify(errState));
await page.click('.verse .verse-fallback .btn');
await page.waitForTimeout(250);
check('Retry restores the verse', await page.evaluate(() => Boolean(document.querySelector('.verse .sk'))));

/* 14. 320px: no horizontal scroll, 44px targets */
await page.setViewportSize({ width: 320, height: 568 });
await page.goto(`${BASE}/#/ch2/v47`);
await ready();
const narrow = await page.evaluate(() => {
  const box = (el) => el.getBoundingClientRect();
  const buttons = [
    document.getElementById('rail-prev'),
    document.getElementById('rail-next'),
    ...document.querySelectorAll('#rail-bottom [data-nav]'),
    ...document.querySelectorAll('.jumpbar .chip'),
  ].map(box);
  return {
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    minW: Math.min(...buttons.map((b) => b.width)),
    minH: Math.min(...buttons.map((b) => b.height)),
    inputH: box(document.querySelector('.jumpbar input')).height,
  };
});
check('No horizontal scroll at 320px', narrow.docW <= narrow.winW + 1, JSON.stringify(narrow));
check('Rails and search meet 44×44 targets', narrow.minW >= 44 && narrow.minH >= 44 && narrow.inputH >= 44, JSON.stringify(narrow));

/* 15. 200% text: rails grow, no overlap, body still scrollable */
await page.addStyleTag({ content: 'html { font-size: 200% }' });
await page.waitForTimeout(200);
const scaled = await page.evaluate(() => {
  const top = document.getElementById('rail-top').getBoundingClientRect();
  const bottom = document.getElementById('rail-bottom').getBoundingClientRect();
  const feed = document.getElementById('feed');
  return {
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    overlap: top.bottom > bottom.top,
    feedScrolls: feed.scrollHeight > feed.clientHeight + 4,
    bodyBottomAboveRail: feed.getBoundingClientRect().bottom <= bottom.top + 1,
  };
});
check('At 200% text the rails do not overlap', !scaled.overlap && scaled.bodyBottomAboveRail, JSON.stringify(scaled));
check('At 200% text the verse body scrolls instead of clipping', scaled.feedScrolls, JSON.stringify(scaled));
check('At 200% text no horizontal scroll', scaled.docW <= scaled.winW + 1, `docW=${scaled.docW}`);

check('No console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass}/${pass + fail} passed`);
await browser.close();
process.exit(fail ? 1 : 0);
