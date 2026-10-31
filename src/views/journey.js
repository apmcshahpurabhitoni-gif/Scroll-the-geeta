// Journey: streak stats, weekly progress, account sync, daily-quote archive,
// reminder opt-in, language/translation settings, and honest credits.
import { h, clear } from '../lib/dom.js';
import { core, refOf, manifestFor, translationArr, loadTranslation } from '../lib/data.js';
import { computeStreaks, recentDays, isRead } from '../lib/streak.js';
import { archive } from '../lib/daily.js';
import { store, todayKey } from '../lib/store.js';
import { reminderSupported, enableReminder, disableReminder } from '../lib/remind.js';
import { ads } from '../ads.config.js';
import { auth, signInWithGoogle, signOut } from '../lib/auth.js';
import { syncStatus, syncNow, onSyncStatus } from '../lib/sync.js';

const GOOGLE_G =
  '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.34-.18-1.96H12v3.71h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.98-4.3 2.98-7.27Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.91a6 6 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.35-2.59Z"/><path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.98 14.7 2 12 2A10 10 0 0 0 3.06 7.5l3.35 2.59C7.2 7.73 9.4 5.98 12 5.98Z"/></svg>';

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let offSyncStatus = null; // unsubscribed at the start of each render

const shortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export async function renderJourney(container, ctx) {
  clear(container);
  const wrap = h('div', { class: 'wrap' });
  const streak = computeStreaks();

  wrap.append(
    h(
      'div',
      { class: 'page-head' },
      h('h1', { class: 'page-title', id: 'journey-title' }, 'Journey'),
      h(
        'p',
        { class: 'page-sub' },
        streak.current > 0
          ? `You have read on ${streak.totalDays} day${streak.totalDays === 1 ? '' : 's'}. Keep going at your own pace.`
          : 'Complete today’s reading to begin — one verse is enough.'
      )
    )
  );

  /* ---------- stats ---------- */
  wrap.append(
    h(
      'div',
      { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'num' }, String(streak.current)), h('div', { class: 'lbl' }, 'Streak')),
      h('div', { class: 'stat' }, h('div', { class: 'num' }, String(streak.longest)), h('div', { class: 'lbl' }, 'Best')),
      h('div', { class: 'stat' }, h('div', { class: 'num' }, String(streak.totalDays)), h('div', { class: 'lbl' }, 'Days read'))
    )
  );

  /* ---------- week ---------- */
  const week = h('div', { class: 'week', role: 'list', 'aria-label': 'This week' });
  for (const day of recentDays(7)) {
    const [y, m, d] = day.key.split('-').map(Number);
    const name = DAY_NAMES[new Date(y, m - 1, d).getDay()];
    week.append(
      h(
        'div',
        { class: `day ${day.read ? 'done' : ''} ${day.key === todayKey() ? 'today' : ''}`, role: 'listitem' },
        h('span', { class: 'dl' }, name),
        h('span', { class: 'dot' }, day.read ? '✓' : String(d))
      )
    );
  }
  wrap.append(
    h(
      'div',
      { class: 'section' },
      week,
      h('p', { class: 'hint', style: 'margin-top:12px' }, 'Reading is counted once per day. A missed day never erases your best streak.')
    )
  );

  /* ---------- account (Google sign-in + cross-device sync) ---------- */
  offSyncStatus?.(); // view may be re-rendered — never stack listeners
  const accountSection = h('div', { class: 'section', id: 'account' }, h('h2', {}, 'Account'));
  const accountBody = h('div', {});
  accountSection.append(accountBody);

  const syncHint = () => {
    if (syncStatus.state === 'error') return `Sync problem: ${syncStatus.error}`;
    if (syncStatus.state === 'syncing') return 'Syncing with your account…';
    if (syncStatus.state === 'synced' && syncStatus.at)
      return `Synced ${new Date(syncStatus.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    if (auth.user) return 'Your progress syncs automatically on this device.';
    return auth.configured
      ? 'Sign in to keep your streak, bookmarks and settings across devices.'
      : 'Sign-in is not configured in this build, so progress stays on this device.';
  };
  const syncLine = h('p', { class: 'hint sync-hint' }, syncHint());

  function paintAccount() {
    accountBody.replaceChildren();
    if (auth.user) {
      const u = auth.user;
      const avatar = u.avatar
        ? h('img', { class: 'avatar', src: u.avatar, alt: '', referrerpolicy: 'no-referrer' })
        : h('span', { class: 'avatar avatar-fallback', 'aria-hidden': 'true' }, (u.name || 'R').slice(0, 1).toUpperCase());
      const syncBtn = h('button', { class: 'btn btn-secondary', disabled: syncStatus.state === 'syncing' }, 'Sync now');
      syncBtn.addEventListener('click', async () => {
        await syncNow();
        ctx.rerender('journey');
      });
      const outBtn = h('button', { class: 'btn btn-ghost' }, 'Sign out');
      outBtn.addEventListener('click', async () => {
        await signOut();
        ctx.rerender('journey');
      });
      accountBody.append(
        h(
          'div',
          { class: 'account-row' },
          avatar,
          h('span', { class: 'account-id' }, h('strong', {}, u.name), h('span', { class: 'account-email' }, u.email || ''))
        ),
        h('div', { class: 'actions', style: 'justify-content:flex-start' }, syncBtn, outBtn)
      );
    } else if (auth.configured) {
      const busy = auth.status === 'busy';
      const inBtn = h(
        'button',
        { class: 'btn-google', disabled: busy },
        busy ? 'Opening Google…' : [h('span', { class: 'g-icon', html: GOOGLE_G }), 'Continue with Google']
      );
      inBtn.addEventListener('click', async () => {
        const res = await signInWithGoogle();
        if (!res.ok) paintAccount(); // show the honest error line below
      });
      accountBody.append(inBtn);
      if (auth.status === 'error' && auth.error) accountBody.append(h('p', { class: 'hint error-hint' }, auth.error));
    } else {
      const inBtn = h(
        'button',
        { class: 'btn-google', disabled: true },
        [h('span', { class: 'g-icon', html: GOOGLE_G }), 'Continue with Google']
      );
      inBtn.title = 'Google sign-in is enabled once the Supabase project keys are configured.';
      accountBody.append(inBtn);
    }
    accountBody.append(syncLine);
    syncLine.textContent = syncHint();
  }

  offSyncStatus = onSyncStatus(() => {
    syncLine.textContent = syncHint();
  });
  paintAccount();
  wrap.append(accountSection);

  /* ---------- archive ---------- */
  const arch = archive();
  const archiveSection = h('div', { class: 'section' }, h('h2', {}, 'Daily quote archive'));
  if (arch.length === 0) {
    archiveSection.append(h('p', { class: 'hint' }, 'Past daily quotes appear here as you visit on different days.'));
  } else {
    const texts = await translationArr('en');
    const list = h('ul', { class: 'list' });
    for (const { date, idx } of arch.slice(0, 30)) {
      const ref = refOf(idx);
      list.append(
        h(
          'li',
          {},
          h(
            'button',
            { class: 'list-item', onclick: () => ctx.exploreAt(idx) },
            h(
              'span',
              { class: 'li-main' },
              h('span', { class: 'li-ref' }, `Bhagavad Gita ${ref}`),
              h('span', { class: 'li-snippet' }, (texts[idx] || core.verses[idx]?.sk || '').slice(0, 160))
            ),
            h('span', { class: 'li-meta' }, shortDate(date), h('span', { html: CHEVRON_ICON }))
          )
        )
      );
    }
    archiveSection.append(list);
  }
  wrap.append(archiveSection);

  /* ---------- reminder ---------- */
  const rem = store.state.reminder;
  const timeInput = h('input', { type: 'time', value: rem.time || '08:00', 'aria-label': 'Reminder time' });
  const status = h(
    'p',
    { class: 'hint' },
    reminderSupported()
      ? 'Reminders fire only while Scroll the Gita is open in this tab — there is no push server, so we don’t claim otherwise.'
      : 'This browser does not support notifications.'
  );

  const toggleBtn = h(
    'button',
    { class: rem.enabled ? 'btn btn-secondary' : 'btn btn-primary' },
    rem.enabled ? 'Turn off reminders' : 'Enable reminders'
  );
  toggleBtn.addEventListener('click', async () => {
    if (store.state.reminder.enabled) {
      disableReminder();
      status.textContent = 'Reminders are off. Nothing will be sent.';
      toggleBtn.textContent = 'Enable reminders';
      toggleBtn.className = 'btn btn-primary';
      return;
    }
    const result = await enableReminder(timeInput.value, () => ctx.rerender('journey'));
    if (result === 'granted') {
      status.textContent = `Reminder set for ${timeInput.value} while the app is open. You can turn it off any time.`;
      toggleBtn.textContent = 'Turn off reminders';
      toggleBtn.className = 'btn btn-secondary';
    } else if (result === 'denied') {
      status.textContent = 'Permission was declined — no notifications will be sent. You can allow them in your browser’s site settings.';
    } else if (result === 'unsupported') {
      status.textContent = 'This browser does not support notifications.';
    }
  });

  wrap.append(
    h(
      'div',
      { class: 'section' },
      h('h2', {}, 'Daily reminder'),
      h('p', { class: 'hint' }, 'Optional. Permission is requested only when you press the button.'),
      h('div', { class: 'field' }, h('span', {}, 'Reminder time'), timeInput),
      h('div', { class: 'actions', style: 'margin-top:12px' }, toggleBtn),
      status
    )
  );

  /* ---------- settings ---------- */
  const langSelect = h(
    'select',
    { 'aria-label': 'Default translation language' },
    h('option', { value: 'en', selected: store.state.settings.lang === 'en' }, 'English'),
    h('option', { value: 'hi', selected: store.state.settings.lang === 'hi' }, 'हिन्दी')
  );
  langSelect.addEventListener('change', async () => {
    store.set('settings.lang', langSelect.value);
    await ctx.rerender('today');
    ctx.repaintExplore();
  });

  const enSelect = h(
    'select',
    { 'aria-label': 'English translator' },
    ...manifestFor('en').map((m) =>
      h('option', { value: m.slug, selected: store.state.settings.enSlug === m.slug }, m.author)
    )
  );
  enSelect.addEventListener('change', async () => {
    await loadTranslation(enSelect.value);
    store.set('settings.enSlug', enSelect.value);
    ctx.repaintExplore();
    await ctx.rerender('today');
  });

  const hiSelect = h(
    'select',
    { 'aria-label': 'Hindi translator' },
    ...manifestFor('hi').map((m) =>
      h('option', { value: m.slug, selected: store.state.settings.hiSlug === m.slug }, m.author)
    )
  );
  hiSelect.addEventListener('change', async () => {
    await loadTranslation(hiSelect.value);
    store.set('settings.hiSlug', hiSelect.value);
    await ctx.rerender('today');
  });

  wrap.append(
    h(
      'div',
      { class: 'section' },
      h('h2', {}, 'Reading settings'),
      h('div', { class: 'field' }, h('span', {}, 'Translation language'), langSelect),
      h('div', { class: 'field' }, h('span', {}, 'English translator'), enSelect),
      h('div', { class: 'field' }, h('span', {}, 'हिन्दी translator'), hiSelect)
    )
  );

  /* ---------- about / honesty notes ---------- */
  wrap.append(
    h(
      'div',
      { class: 'section' },
      h('h2', {}, 'About this app'),
      h(
        'p',
        { class: 'hint' },
        auth.configured
          ? 'Sign in with Google and your progress syncs to your own account — private to you, enforced by row-level security on the server.'
          : 'Everything is stored on this device — accounts are not configured for this build yet.'
      ),
      h(
        'ul',
        { class: 'about-list' },
        h('li', {}, 'Scripture: Sanskrit text with word-by-word and translations by Swami Sivananda, Swami Adidevananda, Swami Gambirananda, Dr. S. Sankaranarayana, Shri Purohit Swami (English) and Swami Ramsukhdas, Swami Tejomayananda (Hindi).'),
        h(
          'li',
          {},
          core.verification
            ? `Sanskrit integrity: cross-checked against a second independent source — ${core.verification.repaired.length} verses had a codepoint-order defect in the primary source and were repaired; ${core.verification.adoptedFromSecondSource.length} adopted the second source’s reading (details in DATA-SOURCES.md).`
            : 'Sanskrit integrity: no cross-source verification record found.'
        ),
        h('li', {}, 'Explanations: community compilation (AdiyogiArts/gita-json, MIT) — editorial, not verified scripture commentary.'),
        h('li', {}, `Verse ranking: ${core.ranking.verification} — used only to weight the daily quote, never to hide verses. All 701 verses remain fully readable.`),
        h('li', {}, `Ads: ${ads.enabled ? 'enabled' : 'not configured in this build'}. ${ads.privacyNote}`),
        h('li', {}, 'Without an account, everything stays on this device: no tracking, no sync between devices.'),
        h('li', {}, 'Daily selection is deterministic for each date and stable across refreshes; recent verses are avoided for 90 days where possible.')
      )
    )
  );

  container.append(wrap);
}
