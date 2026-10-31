// Today's verse: the daily quote, its explanation, and reading actions.
import { h, clear } from '../lib/dom.js';
import { core, refOf, loadExplanations, textOf, activeLang } from '../lib/data.js';
import { dailyPick } from '../lib/daily.js';
import { markRead, isRead, computeStreaks } from '../lib/streak.js';
import { shareText, shareCard } from '../lib/share.js';
import { store } from '../lib/store.js';
import { mountAd } from '../lib/ads.js';

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

const verseLines = (s) => String(s || '').replace(/\n{2,}/g, '\n').trim();

export async function renderToday(container, ctx) {
  clear(container);
  const { verses, ranking } = core;
  const idx = dailyPick({ count: verses.length, scores: ranking.scores, ranking });
  const verse = verses[idx];
  const ref = refOf(idx);
  const lang = activeLang();
  const otherLang = lang === 'en' ? 'hi' : 'en';

  const [main, other, streak] = await Promise.all([
    textOf(idx, lang),
    textOf(idx, otherLang),
    Promise.resolve(computeStreaks()),
  ]);

  const wrap = h('div', { class: 'wrap' });

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const streakChip = h(
    'span',
    {
      class: `streak-chip ${streak.current > 0 ? '' : 'is-empty'}`,
      title: 'Consecutive days with a completed reading',
    },
    streak.current > 0 ? `${streak.current} day streak` : 'No streak yet'
  );

  wrap.append(
    h(
      'div',
      { class: 'page-head' },
      h('div', { class: 'today-head' }, h('span', { class: 'today-date', id: 'today-title' }, dateLabel), streakChip),
      h('h1', { class: 'page-title' }, 'Today’s verse'),
      h('p', { class: 'page-sub' }, 'One verse to sit with — read it slowly.')
    )
  );

  /* ---------- verse card ---------- */
  const card = h('div', { class: 'card quote-card' });

  card.append(
    h('div', { class: 'verse-mark' }, `Bhagavad Gita ${ref}`),
    h('p', { class: 'sk', lang: 'sa' }, verseLines(verse.sk)),
    h('p', { class: 'tr', lang: 'sa' }, verseLines(verse.tr)),
    h('hr', { class: 'rule' }),
    h(
      'div',
      { class: 'label-row' },
      h('span', {}, lang === 'hi' ? 'अनुवाद' : 'Translation'),
      h('span', { class: 'attr' }, main.attr)
    ),
    h('p', { class: `tx ${lang === 'hi' ? 'hi' : ''}`, lang: lang === 'hi' ? 'hi' : 'en' }, main.tx)
  );

  // The other language stays one tap away rather than doubling the card.
  const otherBlock = h(
    'details',
    { class: 'other-lang' },
    h(
      'summary',
      {},
      h('span', {}, otherLang === 'hi' ? 'हिंदी अर्थ' : 'English meaning'),
      h('span', { class: 'attr', style: 'margin:0 0 0 auto' }, other.attr)
    ),
    h(
      'p',
      { class: `tx ${otherLang === 'hi' ? 'hi' : ''}`, lang: otherLang === 'hi' ? 'hi' : 'en' },
      other.tx || 'Not available for this verse.'
    )
  );
  card.append(otherBlock);

  /* ---------- explanation (deferred load) ---------- */
  const details = h('details', { class: 'explain-block' });
  details.append(h('summary', {}, 'Why it matters'));
  const explainBody = h(
    'p',
    { class: 'flagged' },
    'Explanation loads on demand — the verse above is the complete, verified text.'
  );
  details.append(explainBody);
  card.append(details);

  let explainLoaded = false;
  const loadExplanation = async () => {
    if (explainLoaded) return;
    explainLoaded = true;
    explainBody.textContent = 'Loading explanation…';
    try {
      const exps = await loadExplanations();
      const rec = exps[idx] || {};
      explainBody.replaceWith(
        rec.e
          ? h('p', {}, rec.e)
          : h(
              'p',
              { class: 'flagged' },
              'No explanation is available for this verse yet — flagged for editorial review. The scripture above is complete and verified.'
            )
      );
      if (rec.w) {
        details.after(
          h(
            'details',
            { class: 'words' },
            h('summary', {}, 'Word-by-word meaning'),
            h('p', {}, rec.w)
          )
        );
      }
    } catch {
      explainLoaded = false;
      explainBody.textContent = 'Explanation unavailable right now — tap to retry.';
    }
  };
  details.addEventListener('toggle', () => details.open && loadExplanation());
  // Warm the chunk off the critical path once the page is idle.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
  idle(() => loadExplanations().catch(() => {}));

  /* ---------- actions ---------- */
  const saved = () => store.state.bookmarks.includes(idx);
  const saveBtn = h(
    'button',
    {
      class: 'btn btn-secondary',
      'aria-pressed': String(saved()),
      onclick: (e) => {
        const list = new Set(store.state.bookmarks);
        list.has(idx) ? list.delete(idx) : list.add(idx);
        store.set('bookmarks', [...list]);
        const on = list.has(idx);
        e.currentTarget.textContent = on ? 'Saved' : 'Save';
        e.currentTarget.setAttribute('aria-pressed', String(on));
        ctx.rerender('saved');
      },
    },
    saved() ? 'Saved' : 'Save'
  );

  const sharePayload = { ref, sk: verse.sk, tx: main.tx, attr: main.attr };
  const shareBtn = h('button', { class: 'btn btn-secondary', onclick: () => shareText(sharePayload) }, 'Share');
  const cardBtn = h(
    'button',
    {
      class: 'btn btn-secondary',
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        await shareCard(sharePayload);
        e.currentTarget.disabled = false;
      },
    },
    'Share card'
  );

  const readToday = isRead();
  const readBtn = h(
    'button',
    {
      class: 'btn btn-primary btn-block',
      disabled: readToday,
      onclick: (e) => {
        const first = markRead();
        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = `${CHECK_ICON}<span>Read today</span>`;
        if (first) {
          const s = computeStreaks();
          streakChip.textContent = s.current > 1 ? `${s.current} day streak` : 'Day 1';
          streakChip.classList.remove('is-empty');
          ctx.rerender('journey');
        }
      },
    },
    readToday ? [h('span', { class: 'icon', html: CHECK_ICON }), h('span', {}, 'Read today')] : 'Mark as read'
  );

  if (readToday) readBtn.title = 'Today’s reading is already counted — see you tomorrow.';

  card.append(
    h(
      'div',
      { class: 'card-actions' },
      h('div', { class: 'actions', style: 'margin-top:0' }, readBtn),
      h('div', { class: 'actions' }, saveBtn, shareBtn, cardBtn)
    )
  );

  wrap.append(card);

  /* ---------- read in context ---------- */
  wrap.append(
    h(
      'div',
      { class: 'actions', style: 'margin-top:0;justify-content:flex-start' },
      h('button', { class: 'btn btn-ghost', onclick: () => ctx.exploreAt(idx) }, 'Read in context')
    )
  );

  /* ---------- ad slot (real units only; quiet label when unconfigured) ---------- */
  const adBox = h('div', { class: 'ad-slot' });
  wrap.append(adBox);
  requestAnimationFrame(() => mountAd(adBox, 'daily'));

  container.append(wrap);
}
