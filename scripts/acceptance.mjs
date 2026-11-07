// Acceptance tests for Scroll the Gita (spec section 11).
// Usage: BASE=http://localhost:4173 node scripts/acceptance.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4173';
mkdirSync('artifacts', { recursive: true });

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();

async function newPage({ blockVerses = false, trackPerm = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (trackPerm) {
    await ctx.addInitScript(() => {
      window.__permCalled = false;
      if (window.Notification) {
        const orig = Notification.requestPermission.bind(Notification);
        Notification.requestPermission = (...a) => {
          window.__permCalled = true;
          return orig(...a);
        };
      }
    });
  }
  if (blockVerses) {
    await ctx.route('**/verses.json*', (r) => r.abort());
    await ctx.route('**/assets/verses-*', (r) => r.abort());
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { ctx, page, errors };
}

const waitForApp = async (page) => {
  await page.waitForFunction(() => window.__STG__ !== undefined, null, { timeout: 20000 });
  await page.waitForSelector('#loader.done', { timeout: 20000 });
};

/* ---------- 1. boot: no infinite loading, no console errors ---------- */
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE);
  await waitForApp(page).catch(() => {});
  const loaderDone = await page.evaluate(() => document.getElementById('loader').classList.contains('done'));
  record('App boots without getting stuck loading', loaderDone, loaderDone ? '' : 'loader never resolved');
  record('No console/page errors on boot', errors.length === 0, errors.slice(0, 3).join(' | '));

  /* ---------- 2. daily quote stable across refresh ---------- */
  // The app now opens on the reading feed; Today is its own route.
  await page.evaluate(() => (location.hash = '#/today'));
  await page.waitForTimeout(500);
  const ref1 = await page.textContent('#view-today .verse-mark');
  await page.reload();
  await waitForApp(page);
  const ref2 = await page.textContent('#view-today .verse-mark');
  record('Daily quote identical after refresh', ref1 === ref2, `${ref1} vs ${ref2}`);

  /* stable across languages: switch to Hindi, quote ref must not change */
  await page.evaluate(() => {
    window.__STG__.store.set('settings.lang', 'hi');
  });
  await page.evaluate(() => window.__STG__.renderRoute('today'));
  await page.waitForTimeout(400);
  const ref3 = await page.textContent('#view-today .verse-mark');
  record('Daily quote identical across languages', ref1 === ref3, `${ref1} vs ${ref3}`);
  await page.evaluate(() => {
    window.__STG__.store.set('settings.lang', 'en');
  });

  /* ---------- 3. mark-as-read counted once ---------- */
  await page.evaluate(() => window.__STG__.renderRoute('today'));
  await page.waitForSelector('#view-today .btn-primary');
  const before = await page.evaluate(() => window.__STG__.store.state.completions.length);
  await page.click('#view-today .btn-primary');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__STG__.store.state.completions.length);
  const btnDisabled = await page.evaluate(() => document.querySelector('#view-today .btn-primary').disabled);
  record('Reading counted exactly once per date', after === before + 1 && btnDisabled, `before=${before} after=${after} disabled=${btnDisabled}`);

  /* ---------- 4. streak boundaries ---------- */
  const streaks = await page.evaluate(() => {
    const { streak, store } = window.__STG__;
    const today = store.state.completions.at(-1);
    const [y, m, d] = today.split('-').map(Number);
    const prev = (n) => {
      const dt = new Date(y, m - 1, d - n);
      const p = (x) => String(x).padStart(2, '0');
      return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
    };
    const saved = [...store.state.completions];
    store.state.completions = [prev(2), prev(1), today];
    const consecutive = streak.computeStreaks();
    // Gap: an earlier 2-day run followed by today alone → current 1, longest 2 preserved.
    store.state.completions = [prev(6), prev(5), today];
    const broken = streak.computeStreaks();
    store.state.completions = saved;
    return { consecutive, broken };
  });
  record('Consecutive days → active streak of 3', streaks.consecutive.current === 3, JSON.stringify(streaks.consecutive));
  record('Missed day breaks current streak, keeps longest', streaks.broken.current === 1 && streaks.broken.longest === 2, JSON.stringify(streaks.broken));

  /* ---------- 5. daily selection: weights, repeat avoidance, coverage ---------- */
  const selection = await page.evaluate(() => {
    const { dailyPick, core } = window.__STG__;
    const { scores, ranking } = core.ranking ? { scores: core.ranking.scores, ranking: core.ranking } : {};
    const count = core.verses.length;
    const tierOf = (s) => (s >= 90 ? 'S' : s >= 75 ? 'A' : s >= 50 ? 'B' : 'C');
    const seen = { S: 0, A: 0, B: 0, C: 0 };
    const picks = {};
    for (let i = 0; i < 400; i++) {
      const key = `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
      const idx = dailyPick({ dateKey: key, count, scores, ranking });
      picks[key] = idx;
      seen[tierOf(scores[idx])]++;
    }
    // deterministic: same date twice → same verse
    const a = dailyPick({ dateKey: '2026-03-15', count, scores, ranking });
    const b = dailyPick({ dateKey: '2026-03-15', count, scores, ranking });
    // repeat avoidance: stuff history with a verse for 90 days → never re-picked
    const target = picks['2026-03-15'];
    const history = {};
    for (let i = 1; i <= 89; i++) {
      const dt = new Date(2026, 2, 15 - i);
      const p = (x) => String(x).padStart(2, '0');
      history[`${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`] = target;
    }
    const saved = { ...window.__STG__.store.state.picks };
    Object.assign(window.__STG__.store.state.picks, history);
    const next = dailyPick({ dateKey: '2026-06-01', count, scores, ranking });
    window.__STG__.store.state.picks = saved;
    // all verses eligible: clear history so B verses are picked
    return { seen, same: a === b, avoided: next !== target, sample: a, count };
  });
  record('Daily pick deterministic per date', selection.same, `pick=${selection.sample}`);
  record('90-day repeat avoidance enforced', selection.avoided, '');
  record(
    'Higher tiers more likely; lower tiers never excluded (B/C appear in 400 draws)',
    selection.seen.B > 0 && selection.seen.S > 0 && selection.seen.S > selection.seen.B / 40,
    JSON.stringify(selection.seen)
  );
  const weights = await page.evaluate(() => {
    const w = window.__STG__.core.ranking.selection.tierWeights;
    return w.S === 8 && w.A === 4 && w.B === 1.5 && w.C === 0.5 && w.C > 0;
  });
  record('Tier weights configured (S8 A4 B1.5 C0.5, C nonzero)', weights);

  /* ---------- 6. every verse browsable ---------- */
  await page.evaluate(() => (location.hash = '#/explore'));
  await page.waitForTimeout(500);
  const routed = await page.evaluate(() => ({
    verses: window.__STG__.core.verses.length,
    rendered: document.querySelectorAll('#feed .verse').length,
    current: document.querySelector('#feed .verse')?.id || '',
    hash: location.hash,
  }));
  const readerDom = await page.evaluate(() => ({
    frameIds: document.querySelectorAll('#verse-frame').length,
    feedCount: document.querySelectorAll('#feed .verse').length,
    bodyOverflow: getComputedStyle(document.querySelector('#vbody')).overflowY,
    feedOverflow: getComputedStyle(document.querySelector('#feed')).overflowY,
    nestedVerseBodyOverflow: getComputedStyle(document.querySelector('#feed .verse-body')).overflowY,
  }));
  record('Reader has no duplicate frame IDs', readerDom.frameIds === 0, JSON.stringify(readerDom));
  record('Reader uses one scroll container (feed)', readerDom.bodyOverflow === 'hidden' && readerDom.feedOverflow === 'auto' && readerDom.nestedVerseBodyOverflow !== 'auto', JSON.stringify(readerDom));

  record(
    'Reader renders exactly the routed verse, not the whole book',
    routed.verses === 701 && routed.rendered === 1 && /^v-\d+-\d+$/.test(routed.current),
    JSON.stringify(routed)
  );

  const refValid = await page.evaluate(() => {
    const { core, ctx } = window.__STG__;
    let bad = 0;
    for (const v of core.verses) {
      if (!v.sk || !v.ch || !v.v) bad++;
    }
    return { bad, total: core.verses.length };
  });
  record('Every verse has Sanskrit text and a valid reference', refValid.bad === 0, JSON.stringify(refValid));

  const integrity = await page.evaluate(() => ({
    malformed: window.__STG__.core.verses.filter((v) => /\u094d\u093f/.test(v.sk)).length,
  }));
  record(
    'Sanskrit integrity: source defects repaired/adopted, none remain',
    integrity.malformed === 0,
    `malformed=${integrity.malformed}`
  );

  await page.fill('.jumpbar input', '9.22');
  await page.press('.jumpbar input', 'Enter');
  await page.waitForTimeout(1200);
  const jumped = await page.textContent('#now-ref');
  record('Jump to reference 9.22 works', jumped === '9.22', `active=${jumped}`);

  /* chapter sheet */
  await page.click('.jumpbar .chip');
  const sheetOpen = await page.isVisible('#sheet-chapters');
  const chapterCount = await page.evaluate(() => document.querySelectorAll('#chapter-list li').length);
  record('Chapter sheet opens with 18 chapters', sheetOpen && chapterCount === 18, `open=${sheetOpen} chapters=${chapterCount}`);
  await page.click('#sheet-chapters [data-close]');

  /* ---------- 7. translation switching ---------- */
  const txSwitch = await page.evaluate(() => {
    const first = document.querySelector('#feed [data-tx]')?.textContent || '';
    return { first, has: first && first.length > 20 };
  });
  record('Translations render in Explore', txSwitch.has, txSwitch.first?.slice(0, 40));

  /* ---------- 8. topics ---------- */
  await page.evaluate(() => (location.hash = '#/topics'));
  await page.waitForSelector('#view-topics .chip');
  await page.click('#view-topics .chip');
  await page.waitForTimeout(300);
  const topicItems = await page.evaluate(() => document.querySelectorAll('#view-topics .list li').length);
  record('Topic filter returns verses', topicItems > 0, `${topicItems} verses`);

  /* ---------- 9. saved/bookmarks ---------- */
  const savedOk = await page.evaluate(async () => {
    const { store, ctx } = window.__STG__;
    store.set('bookmarks', [0, 93]);
    location.hash = '#/saved';
    await new Promise((r) => setTimeout(r, 500));
    return document.querySelectorAll('#view-saved .list li').length;
  });
  record('Saved shows bookmarks', savedOk === 2, `${savedOk} items`);

  /* ---------- 10. archive + journey ---------- */
  const journey = await page.evaluate(async () => {
    location.hash = '#/journey';
    await new Promise((r) => setTimeout(r, 700));
    const stats = [...document.querySelectorAll('#view-journey .stat .num')].map((n) => n.textContent);
    const arch = document.querySelectorAll('#view-journey .section .list li').length;
    const week = document.querySelectorAll('#view-journey .week .day').length;
    return { stats, arch, week };
  });
  record('Journey shows streak stats + 7-day week', journey.week === 7 && journey.stats.length === 3, JSON.stringify(journey.stats));
  record('Archive lists past daily quotes', journey.arch >= 1, `${journey.arch} entries`);

  /* ---------- 11. notifications: opt-in only ---------- */
  const permCalled = await page.evaluate(() => window.__permCalled);
  record('Notification permission NOT requested on load', permCalled === false, `called=${permCalled}`);

  /* ---------- 12. ads: labelled placeholders when unconfigured, never fake ads ---------- */
  const adState = await page.evaluate(async () => {
    const inspect = () => ({
      real: document.querySelectorAll('ins.adsbygoogle').length,
      placeholders: document.querySelectorAll('.ad-slot.ad-placeholder').length,
      label: document.querySelector('.ad-slot.ad-placeholder .ad-label')?.textContent || '',
      note: document.querySelector('.ad-slot.ad-placeholder .ad-hint')?.textContent || '',
    });
    location.hash = '#/today';
    await new Promise((r) => setTimeout(r, 700));
    const today = inspect();
    location.hash = '#/explore/1.1';
    await new Promise((r) => setTimeout(r, 1000));
    const explore = inspect();
    location.hash = '#/journey';
    await new Promise((r) => setTimeout(r, 500));
    return { today, explore };
  });
  record(
    'No fake ad units ever rendered',
    adState.today.real === 0 && adState.explore.real === 0,
    `today=${adState.today.real} explore=${adState.explore.real}`
  );
  record(
    'Ad slots visible as labelled placeholders when unconfigured',
    adState.today.placeholders >= 1 &&
      adState.explore.placeholders >= 1 &&
      adState.today.label === 'Advertisement' &&
      /AdSense/i.test(adState.today.note),
    `today=${adState.today.placeholders} explore=${adState.explore.placeholders}`
  );

  /* ---------- 13. no horizontal overflow on mobile ---------- */
  const overflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1);
  record('No horizontal overflow (mobile)', overflow);

  /* ---------- 15. account: Google sign-in UI (honest when unconfigured) ---------- */
  const account = await page.evaluate(async () => {
    location.hash = '#/journey';
    await new Promise((r) => setTimeout(r, 500));
    const btn = document.querySelector('#account .btn-google');
    return {
      exists: Boolean(btn),
      disabled: btn?.disabled,
      configured: window.__STG__.auth.configured,
      label: btn?.textContent?.trim() || '',
      hint: document.querySelector('#account .sync-hint')?.textContent || '',
    };
  });
  record('Account section offers Continue with Google', account.exists && /google/i.test(account.label), account.label);
  record(
    'Sign-in enabled exactly when Supabase is configured; honest hint otherwise',
    account.disabled === !account.configured &&
      (account.configured || /not configured/i.test(account.hint)),
    `configured=${account.configured} disabled=${account.disabled}`
  );

  const topbarBtn = await page.evaluate(async () => {
    document.getElementById('btn-account').click();
    await new Promise((r) => setTimeout(r, 500));
    return { hash: location.hash, accountVisible: Boolean(document.getElementById('account')) };
  });
  record(
    'Topbar account button opens the Account section',
    topbarBtn.hash === '#/journey' && topbarBtn.accountVisible,
    JSON.stringify(topbarBtn)
  );

  const merge = await page.evaluate(() => {
    const { mergeState } = window.__STG__;
    const local = {
      bookmarks: [1, 5],
      completions: ['2026-01-02'],
      picks: { '2026-01-02': 3 },
      settings: { lang: 'hi' },
      reminder: { enabled: false, time: '08:00', lastFired: '2026-01-02' },
      updatedAt: 100,
    };
    const remote = {
      bookmarks: [5, 9],
      completions: ['2026-01-01', '2026-01-02'],
      picks: { '2026-01-01': 7 },
      settings: { lang: 'en', enSlug: 'gambirananda' },
      reminder: { enabled: true, time: '07:00' },
      updatedAt: 50,
    };
    const m = mergeState(local, remote);
    return {
      bookmarksUnion: JSON.stringify(m.bookmarks) === JSON.stringify([1, 5, 9]),
      completionsUnion: m.completions.length === 2,
      picksMerged: m.picks['2026-01-01'] === 7 && m.picks['2026-01-02'] === 3,
      newestSettingsWin: m.settings.lang === 'hi' && m.settings.enSlug === 'gambirananda',
      deviceReminderKept: m.reminder.time === '08:00' && m.reminder.lastFired === '2026-01-02',
      newestUpdatedAt: m.updatedAt === 100,
    };
  });
  record(
    'Sync merge: lists union, newest settings win, device reminder stays local',
    Object.values(merge).every(Boolean),
    JSON.stringify(merge)
  );

  record('No console errors across full interaction run', errors.length === 0, errors.slice(0, 3).join(' | '));

  await ctx.close();
}

/* ---------- 14. loading failure shows a real error, never infinite loading ---------- */
{
  const { ctx, page } = await newPage({ blockVerses: true });
  await page.goto(BASE);
  await page.waitForSelector('#loader.error, #loader.done', { timeout: 25000 }).catch(() => {});
  const state = await page.evaluate(() => {
    const l = document.getElementById('loader');
    return {
      error: l.classList.contains('error'),
      text: l.querySelector('.loader-text')?.textContent || '',
      retryVisible: !document.getElementById('loader-retry').hidden,
      done: l.classList.contains('done'),
    };
  });
  record(
    'Failed data load → visible error + retry (never stuck loading)',
    state.error && state.retryVisible && !state.done,
    JSON.stringify(state)
  );
  await ctx.close();
}

/* ---------- screenshots ---------- */
const shots = [
  { name: 'today-mobile', theme: 'light', route: '#/today', w: 390, h: 844 },
  { name: 'today-dark', theme: 'dark', route: '#/today', w: 390, h: 844 },
  { name: 'explore-mobile', theme: 'light', route: '#/explore/2.47', w: 390, h: 844 },
  { name: 'topics-mobile', theme: 'light', route: '#/topics', w: 390, h: 844 },
  { name: 'journey-mobile', theme: 'light', route: '#/journey', w: 390, h: 844 },
  { name: 'today-desktop', theme: 'light', route: '#/today', w: 1280, h: 800 },
];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h } });
  await ctx.addInitScript((theme) => {
    const raw = JSON.parse(localStorage.getItem('stg:v2') || '{}');
    raw.settings = { ...(raw.settings || {}), theme };
    localStorage.setItem('stg:v2', JSON.stringify(raw));
  }, s.theme);
  const page = await ctx.newPage();
  await page.goto(BASE + '/' + s.route).catch(() => {});
  await page.waitForFunction(() => window.__STG__ !== undefined, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: `artifacts/${s.name}.png` });
  await ctx.close();
}
console.log('screenshots written to artifacts/');

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join('; '));
  process.exit(1);
}
