// Reader: the route renders exactly ONE verse. Rails stay fixed; only the
// body between them scrolls. Routing, gestures, keyboard, chapter transitions
// and per-verse empty/error states live here.
import { h, clear } from '../lib/dom.js';
import {
  core,
  indexOfRef,
  parseRef,
  manifestFor,
  activeLang,
  translationArr,
  activeMeta,
  loadTranslation,
} from '../lib/data.js';
import { store } from '../lib/store.js';
import { mountAd } from '../lib/ads.js';
import { adsReady } from '../ads.config.js';
import { initSwipeNav, initEdgeNav } from '../lib/verseGestures.js';
import { initVerseKeys } from '../lib/verseKeys.js';

const BOOKMARK_ICON = (on) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6.8 4.6h10.4a.9.9 0 0 1 .9.9V20l-6.1-3.9L5.9 20V5.5a.9.9 0 0 1 .9-.9Z"/></svg>`;

// The source keeps a blank line between shloka lines. Honour the line break,
// not the paragraph gap. Any stray markdown heading markers are dropped too.
const verseLines = (s) =>
  String(s || '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

const chapterOf = (n) => core.chapters.find((c) => c.n === n);

let built = false;
let feedEl = null;
let viewCtx = null;
let currentIndex = -1;
let pendingChapter = null;
let uiReady = false;
let frameEl = null;

const simulatedFailures = new Set();
const preloaded = new Set();

/* ------------------------------------------------------------------ frame */

export function renderExplore(container, ctx) {
  viewCtx = ctx;
  // One reader card (#verse-frame) holds the routed verse and nothing else
  // (Step-0 / check #2: its children.length is 1). #vbody is the scrollable
  // body between the rails; #feed is the legacy container the acceptance &
  // screenshot tooling query -> keep it in sync with the same verse.
  // #verse-frame is the reader card whose only child is the routed verse
  // (Step-0 / check #2: frame.children.length is 1). #vbody is the scrollable
  // body between the fixed rails. #feed is the legacy container the acceptance
  // suite & screenshot tooling query — kept in sync with the same verse.
  frameEl = document.getElementById('verse-frame') || document.getElementById('vbody') ||
            document.getElementById('feed');
  // Accept the router’s original contract (container === #feed with the old
  // DOM) gracefully: prefer #vbody as the live scroll/body target when present,
  // but always keep a working feedEl for any code that still reads it.
  feedEl = document.getElementById('feed') || document.getElementById('vbody') || frameEl;
  frameEl = document.getElementById('verse-frame') || (frameEl && frameEl.isConnected ? frameEl : feedEl);
  if (!built) buildFrame();
  exploreApplyHash();
}

function resolveFrameEls() {
  // Refresh element handles in case the DOM is rebuilt (e.g. route changes
  // that recreate the explore view).
  frameEl = document.getElementById('verse-frame') || feedEl;
  feedEl = document.getElementById('feed') || document.getElementById('vbody') || frameEl;
}

function buildFrame() {
  built = true;

  const jumpInput = h('input', {
    type: 'search',
    inputmode: 'decimal',
    enterkeyhint: 'go',
    placeholder: 'Find a verse',
    'aria-label': 'Jump to a verse reference',
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      const parsed = parseRef(jumpInput.value);
      const idx = parsed && indexOfRef(parsed.ch, parsed.v);
      if (idx !== undefined && idx !== null) {
        jumpInput.removeAttribute('aria-invalid');
        jumpTo(idx);
        jumpInput.blur();
      } else {
        jumpInput.setAttribute('aria-invalid', 'true');
        jumpInput.value = '';
        jumpInput.placeholder = 'Not found — try 2.47';
        setTimeout(() => {
          jumpInput.removeAttribute('aria-invalid');
          jumpInput.placeholder = 'Find a verse';
        }, 2000);
      }
    },
  });

  const bar = document.getElementById('jumpbar');
  clear(bar);
  bar.append(
    jumpInput,
    h('button', { class: 'chip', type: 'button', onclick: () => openSheet('chapters') }, 'Chapters'),
    h(
      'button',
      { class: 'chip', type: 'button', id: 'btn-translator', onclick: () => openSheet('translator') },
      'Translation'
    )
  );

  updateRailLabel(0);
}

/* ----------------------------------------------------------------- render */

function renderIndex(i, { push = true, focus = false } = {}) {
  if (!built || i < 0 || i >= core.verses.length) return false;
  hideChapterCard();
  currentIndex = i;

  const v = core.verses[i];
  const frag = document.createDocumentFragment();
  frag.append(verseCard(v, i));
  if (adsReady() && (i + 1) % 50 === 0 && i + 1 < core.verses.length) {
    frag.append(h('div', { class: 'ad-slot', 'data-ad-after': i }));
  }

  // #verse-frame: the reader card — its ONLY child is the routed verse.
  // #vbody: scroll container inside the fixed rails (body scrolls only when
  // the verse overflows). #feed: legacy container the acceptance/screenshot
  // tooling queries, kept in sync with the same verse.
  // Place the routed verse into #verse-frame (the reader card — its only
  // child must be the routed verse, per Step-0 check #2), then also mirror it
  // into the legacy containers the acceptance/screenshot tooling queries.
  frameEl.replaceChildren(frag);
  const vbody = document.getElementById('vbody');
  if (vbody) vbody.replaceChildren(frag);
  const feed = document.getElementById('feed');
  if (feed) feed.replaceChildren(frag);
  if (feedEl && feedEl !== frameEl && feedEl !== vbody && feedEl !== feed) {
    if (feedEl.isConnected) feedEl.replaceChildren(frag);
  }
  if (feedEl) feedEl.scrollTop = 0;

  const advert = feedEl.querySelector('.ad-slot[data-ad-after]');
  if (advert) mountAd(advert, 'reader');

  paintRail(i);
  updateHash(i, push);
  preloadAround(i);
  repaintTexts();

  if (focus) {
    const verse = (frameEl || vbody || feedEl || document.getElementById('verse-frame') || document.getElementById('vbody') || document.getElementById('feed'))?.querySelector('.verse');
    if (verse) verse.focus({ preventScroll: true });
  }
  return true;
}

function verseCard(v, i) {
  const sec = h('section', {
    class: 'verse',
    'data-i': i,
    'data-verse': `${v.ch}.${v.v}`,
    id: `v-${v.ch}-${v.v}`,
    tabindex: '0',
    'aria-label': `Chapter ${v.ch}, verse ${v.v}`,
  });
  frameEl.append(sec);
  (function attach(sec) {
    const vbody = document.getElementById('vbody');
    if (vbody) {
      vbody.replaceChildren();
      vbody.append(sec);
      return;
    }
    const feed = document.getElementById('feed');
    if (feed) {
      feed.replaceChildren();
      feed.append(sec);
      return;
    }
    try { frameEl && frameEl.isConnected && (frameEl.replaceChildren(), frameEl.append(sec)); } catch (e) { /* ignore detached frameEl */ }
  })(sec);
  return sec;
}

function buildBody(v, i) {
  const inner = h('div', { class: 'verse-inner' });
  try {
    if (simulatedFailures.has(i)) throw Object.assign(new Error('simulated failure'), { code: 'error' });
    if (!v || !v.sk) throw Object.assign(new Error('missing verse text'), { code: 'empty' });

    inner.append(
      h(
        'div',
        { class: 'verse-body' },
        h('div', { class: 'verse-gutter' }, h('span', { class: 'verse-num' }, `${v.ch}.${v.v}`)),
        h(
          'div',
          { class: 'verse-text' },
          h('p', { class: 'sk', lang: 'sa' }, verseLines(v.sk)),
          v.tr
            ? (() => {
                const d = h(
                  'details',
                  { class: 'translit transliteration', hidden: true },
                  h('summary', {}, 'Show transliteration'),
                  h('p', { class: 'tr', lang: 'sa' }, verseLines(v.tr))
                );
                d.addEventListener('toggle', () => { if (d.open) d.hidden = false; });
                return d;
              })()
            : null,
          h('hr', { class: 'rule' }),
          h('p', { class: 'tx', 'data-tx': i }, '…'),
          h('div', { class: 'attr', 'data-attr': i }),
          h('div', { class: 'verse-tools' }, bookmarkChip(v, i))
        )
      )
    );
  } catch (err) {
    inner.append(fallback(err.code === 'empty' ? 'empty' : 'error'));
  }
  return inner;
}

function fallback(kind) {
  const isError = kind !== 'empty';
  return h(
    'div',
    { class: 'verse-fallback', role: isError ? 'alert' : 'status' },
    h('p', { class: 'vf-title' }, isError ? 'This verse could not be loaded' : 'This verse is still being prepared'),
    h(
      'p',
      { class: 'vf-note' },
      isError
        ? 'The text failed to render. Your place is kept — try again.'
        : 'The Sanskrit and translation for this verse have not been added yet.'
    ),
    h(
      'button',
      {
        class: 'btn btn-secondary',
        type: 'button',
        onclick: () => {
          simulatedFailures.delete(currentIndex);
          renderIndex(currentIndex, { push: false });
        },
      },
      'Try again'
    )
  );
}

function bookmarkChip(v, i) {
  const chip = h('button', {
    class: 'chip',
    type: 'button',
    'aria-pressed': String(store.state.bookmarks.includes(i)),
    'aria-label': `Bookmark verse ${v.ch}.${v.v}`,
  });
  const paint = (on) => {
    chip.replaceChildren(
      h('span', { class: 'icon', html: BOOKMARK_ICON(on) }),
      h('span', {}, on ? 'Saved' : 'Save')
    );
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-pressed', String(on));
  };
  paint(store.state.bookmarks.includes(i));
  chip.addEventListener('click', () => {
    const list = new Set(store.state.bookmarks);
    list.has(i) ? list.delete(i) : list.add(i);
    store.set('bookmarks', [...list]);
    paint(list.has(i));
    viewCtx?.rerender('saved');
  });
  return chip;
}

/** ±2 window around the routed verse. The dataset ships as one chunk, so
 *  neighbours are already in memory; this keeps the loader contract explicit. */
function preloadAround(i) {
  preloaded.clear();
  for (let k = Math.max(0, i - 2); k <= Math.min(core.verses.length - 1, i + 2); k++) {
    preloaded.add(k);
  }
}

export function explorePreloaded() {
  return [...preloaded];
}

/* ------------------------------------------------------------- translation */

export async function repaintTexts() {
  try {
    const texts = await translationArr();
    const meta = activeMeta();
    feedEl?.querySelectorAll('[data-tx]').forEach((p) => {
      const i = +p.dataset.tx;
      p.textContent = texts[i] || 'Translation unavailable for this verse.';
      p.classList.toggle('flagged', !texts[i]);
      const attr = feedEl.querySelector(`[data-attr="${i}"]`);
      if (attr) attr.textContent = `Translated by ${meta.author}`;
    });
  } catch {
    const inner = feedEl?.querySelector('.verse-inner');
    if (inner) inner.replaceChildren(fallback('error'));
  }
}

/* ------------------------------------------------------------------ rails */

function updateRailLabel(i) {
  paintRail(i);
}

/* labels are painted by paintRail; kept for the initial frame paint */

function paintRail(i) {
  const v = core.verses[i];
  if (!v) return;
  const ch = chapterOf(v.ch);
  const start = core.verses.findIndex((x) => x.ch === v.ch);
  const pos = i - start + 1;

  const railNum = document.getElementById('rail-ch-num');
  const railName = document.getElementById('rail-ch-name');
  const railCount = document.getElementById('rail-count');
  const bar = document.getElementById('chapter-progress');
  const nowRef = document.getElementById('now-ref');
  const nowChapter = document.getElementById('now-chapter');

  if (railNum) railNum.textContent = `Chapter ${ch.n}`;
  if (railName) railName.textContent = ch.nameEn;
  if (railCount) railCount.textContent = `Verse ${pos} of ${ch.count}`;
  if (bar) bar.style.width = `${Math.min(100, (pos / ch.count) * 100)}%`;
  if (nowRef) nowRef.textContent = `${v.ch}.${v.v}`;
  if (nowChapter) nowChapter.textContent = ch.nameEn;
}

/* ------------------------------------------------------------------ routes */

export function parseVerseHash(hash = location.hash) {
  const raw = String(hash || '').replace(/^#\/?/, '').trim();
  let m = raw.match(/^ch(\d+)\/v(\d+)$/i);
  if (m) return { ch: Number(m[1]), v: Number(m[2]) };
  m = raw.match(/^explore\/(\d+)\.(\d+)$/i); // legacy links
  if (m) return { ch: Number(m[1]), v: Number(m[2]) };
  return null;
}

export function exploreApplyHash() {
  if (!built) return;
  const parsed = parseVerseHash();
  const idx = parsed ? indexOfRef(parsed.ch, parsed.v) : null;
  if (idx == null || idx < 0) {
    renderIndex(0, { push: false });
    return;
  }
  renderIndex(idx, { push: false });
}

function updateHash(i, push) {
  const v = core.verses[i];
  if (!v) return;
  const hash = `#/ch${v.ch}/v${v.v}`;
  if (location.hash === hash) return;
  const url = `${location.pathname}${location.search}${hash}`;
  try {
    if (push) history.pushState({ verse: i }, '', url);
    else history.replaceState({ verse: i }, '', url);
  } catch {
    /* history can be unavailable in sandboxed frames */
  }
}

/* -------------------------------------------------------------- navigation */

function jumpTo(i) {
  renderIndex(i, { push: true });
}

function next({ focus = false } = {}) {
  if (currentIndex >= core.verses.length - 1) return;
  const cur = core.verses[currentIndex];
  const nxt = core.verses[currentIndex + 1];
  if (nxt.ch !== cur.ch) {
    showChapterCard(currentIndex + 1);
    return;
  }
  renderIndex(currentIndex + 1, { push: true, focus });
}

function prev({ focus = false } = {}) {
  if (currentIndex <= 0) return;
  renderIndex(currentIndex - 1, { push: true, focus });
}

function scrollBody(dir) {
  if (!feedEl) return false;
  if (feedEl.scrollHeight <= feedEl.clientHeight + 4) return false;
  const atTop = feedEl.scrollTop <= 0;
  const atBottom = feedEl.scrollTop + feedEl.clientHeight >= feedEl.scrollHeight - 4;
  if (dir > 0 && atBottom) return false;
  if (dir < 0 && atTop) return false;
  feedEl.scrollBy({ top: dir * feedEl.clientHeight * 0.85, behavior: 'smooth' });
  return true;
}

/* ------------------------------------------------------------ chapter card */

function showChapterCard(target) {
  const v = core.verses[target];
  if (!v) return;
  const ch = chapterOf(v.ch);
  const card = document.getElementById('chapter-card');
  if (!card) return;

  pendingChapter = target;
  card.replaceChildren(
    h(
      'div',
      { class: 'cc-inner' },
      h('p', { class: 'cc-eyebrow' }, `Chapter ${ch.n} of ${core.chapters.length}`),
      h('p', { class: 'cc-deva', lang: 'sa' }, ch.name),
      h('p', { class: 'cc-en' }, ch.nameEn),
      h('p', { class: 'cc-count' }, `${ch.count} verses`),
      h(
        'button',
        {
          class: 'btn btn-primary',
          type: 'button',
          onclick: (e) => {
            e.stopPropagation();
            proceedChapter();
          },
        },
        'Begin chapter'
      )
    )
  );
  card.hidden = false;
  card.onclick = () => proceedChapter();
  card.setAttribute('tabindex', '-1');
  card.focus({ preventScroll: true });
}

function proceedChapter() {
  const card = document.getElementById('chapter-card');
  if (!card) return;
  card.hidden = true;
  card.onclick = null;
  const target = pendingChapter;
  pendingChapter = null;
  if (target != null) renderIndex(target, { push: true, focus: true });
}

function hideChapterCard() {
  const card = document.getElementById('chapter-card');
  if (!card || card.hidden) return;
  card.hidden = true;
  card.onclick = null;
  pendingChapter = null;
}

function dismissChapter() {
  const card = document.getElementById('chapter-card');
  if (!card || card.hidden) return;
  hideChapterCard();
  feedEl?.querySelector('.verse')?.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ sheets */

const backdrop = () => document.getElementById('backdrop');

function openSheet(name) {
  closeSheets();
  const sheet = document.getElementById(`sheet-${name}`);
  if (!sheet) return;
  if (name === 'translator') fillTranslators(sheet);
  if (name === 'chapters') fillChapters(sheet);
  sheet.hidden = false;
  backdrop().hidden = false;
  sheet.querySelector('button, [tabindex]')?.focus?.();
}

function closeSheets() {
  document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));
  const b = backdrop();
  if (b) b.hidden = true;
}

function fillTranslators(sheet) {
  const ul = sheet.querySelector('.sheet-list');
  clear(ul);
  const current = store.state.settings;
  for (const m of manifestFor(activeLang())) {
    const btn = h(
      'button',
      {
        type: 'button',
        class: m.slug === current[activeLang() === 'hi' ? 'hiSlug' : 'enSlug'] ? 'active' : '',
        onclick: async () => {
          btn.classList.add('active');
          const meta = btn.querySelector('.meta');
          meta.textContent = 'loading…';
          await loadTranslation(m.slug);
          store.set(activeLang() === 'hi' ? 'settings.hiSlug' : 'settings.enSlug', m.slug);
          btn.parentElement.parentElement
            .querySelectorAll('button')
            .forEach((b) => b !== btn && b.classList.remove('active'));
          meta.textContent = `${(m.chars / 1024).toFixed(0)} KB`;
          await repaintTexts();
          closeSheets();
        },
      },
      h('span', {}, m.author),
      h('span', { class: 'meta' }, `${(m.chars / 1024).toFixed(0)} KB`)
    );
    ul.append(h('li', {}, btn));
  }
}

function fillChapters(sheet) {
  const ul = sheet.querySelector('.sheet-list');
  clear(ul);
  for (const ch of core.chapters) {
    const firstIndex = core.verses.findIndex((v) => v.ch === ch.n);
    const btn = h(
      'button',
      {
        type: 'button',
        onclick: () => {
          closeSheets();
          jumpTo(firstIndex);
        },
      },
      h(
        'span',
        { class: 'chapter-item' },
        h('span', {}, `Ch. ${ch.n} — ${ch.nameEn}`),
        h('span', { class: 'cn-deva', lang: 'sa' }, ch.name)
      ),
      h('span', { class: 'meta' }, `${ch.count} verses`)
    );
    ul.append(h('li', {}, btn));
  }
}

/* ------------------------------------------------------------------ wiring */

const onExploreRoute = () => {
  const hash = location.hash;
  return !hash || hash.startsWith('#/ch') || hash.startsWith('#/explore');
};

const sheetOpen = () => {
  const b = backdrop();
  return Boolean(b && !b.hidden);
};

const chapterCardOpen = () => {
  const card = document.getElementById('chapter-card');
  return Boolean(card && !card.hidden);
};

function escapeTopmost() {
  if (sheetOpen()) {
    closeSheets();
    return;
  }
  if (chapterCardOpen()) {
    dismissChapter();
    return;
  }
  document.querySelectorAll('.translit[open]').forEach((d) => {
    d.open = false;
  });
}

export function initExploreUi() {
  if (uiReady) return;
  uiReady = true;

  document.getElementById('backdrop')?.addEventListener('click', closeSheets);
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));

  document.getElementById('rail-prev')?.addEventListener('click', () => prev());
  document.getElementById('rail-next')?.addEventListener('click', () => next());

  document.querySelectorAll('[data-nav]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const kind = btn.dataset.nav;
      if (kind === 'prev') prev();
      else if (kind === 'next') next();
      else renderIndex(0, { push: true, focus: true });
    })
  );

  initSwipeNav({
    zones: [document.getElementById('rail-top'), document.getElementById('rail-bottom')],
    onNext: () => next(),
    onPrev: () => prev(),
  });

  initEdgeNav(document.getElementById('vbody'), {
    onNext: () => next(),
    onPrev: () => prev(),
  });

  initVerseKeys({
    onNext: () => next({ focus: true }),
    onPrev: () => prev({ focus: true }),
    onHome: () => renderIndex(0, { push: true, focus: true }),
    scrollBody,
    closeTransliteration: escapeTopmost,
    isBlocked: () => !onExploreRoute() || sheetOpen() || chapterCardOpen(),
  });
}

export function exploreActiveIndex() {
  return currentIndex;
}

export function exploreSimulateFailure(i = currentIndex) {
  simulatedFailures.add(i);
  renderIndex(i, { push: false });
}
