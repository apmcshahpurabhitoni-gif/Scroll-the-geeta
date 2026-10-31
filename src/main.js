// App bootstrap: data loading with real error/retry states, hash routing,
// theme, and service worker registration (production only).
import './style.css';
import { core, loadCore, indexOfRef } from './lib/data.js';
import { store } from './lib/store.js';
import { renderToday } from './views/today.js';
import {
  renderExplore,
  initExploreUi,
  exploreApplyHash,
  exploreActiveIndex,
  exploreSimulateFailure,
  explorePreloaded,
} from './views/explore.js';
import { renderTopics } from './views/topics.js';
import { renderSaved } from './views/saved.js';
import { renderJourney } from './views/journey.js';
import { scheduleReminder } from './lib/remind.js';
import { dailyPick } from './lib/daily.js';
import * as streak from './lib/streak.js';
import { auth, initAuth, onAuthChange } from './lib/auth.js';
import { mergeState, syncNow, syncStatus } from './lib/sync.js';

const ROUTES = ['today', 'explore', 'topics', 'saved', 'journey'];
const loader = document.getElementById('loader');
const loaderText = loader.querySelector('.loader-text');
const retryBtn = document.getElementById('loader-retry');

let booted = false;

const ctx = {
  rerender: (route) => renderRoute(route || currentRoute(), { keepScroll: true }),
  repaintExplore: () => repaintExploreTexts(),
  exploreAt: (idxOrRef) => {
    const idx =
      typeof idxOrRef === 'number' ? idxOrRef : indexOfRef(...String(idxOrRef).split('.').map(Number));
    if (idx == null) return;
    const v = core.verses[idx];
    if (!v) return;
    location.hash = `#/ch${v.ch}/v${v.v}`;
  },
};

async function repaintExploreTexts() {
  const { repaintTexts } = await import('./views/explore.js');
  return repaintTexts();
}

function currentRoute() {
  // `#/ch2/v47` is the reader; every other hash is the first segment.
  const r = (location.hash.replace(/^#\//, '').split('/')[0] || 'explore').toLowerCase();
  return ROUTES.includes(r) ? r : 'explore';
}

async function renderRoute(route, { keepScroll = false } = {}) {
  for (const r of ROUTES) {
    const el = document.getElementById(`view-${r}`);
    if (el) el.hidden = r !== route;
  }
  document.querySelectorAll('.tab').forEach((t) => {
    if (t.dataset.route === route) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  document.getElementById('now').hidden = route !== 'explore';

  const el = document.getElementById(`view-${route}`);
  try {
    if (route === 'today') await renderToday(el, ctx);
    else if (route === 'explore') {
      renderExplore(document.getElementById('feed'), ctx);
      exploreApplyHash();
    } else if (route === 'topics') await renderTopics(el, ctx);
    else if (route === 'saved') await renderSaved(el, ctx);
    else if (route === 'journey') await renderJourney(el, ctx);
  } catch (err) {
    console.error('view render failed', err);
    el.replaceChildren(
      Object.assign(document.createElement('p'), {
        className: 'empty-state',
        textContent: 'This section failed to load. Please go back or refresh.',
      })
    );
  }
}

function applyTheme() {
  const t = store.state.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const btn = document.getElementById('btn-theme');
  btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

function initThemeToggle() {
  document.getElementById('btn-theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    store.set('settings.theme', dark ? 'light' : 'dark');
    applyTheme();
  });
}

const ACCOUNT_ICON = document.getElementById('btn-account').innerHTML;

function paintAccountBtn() {
  const btn = document.getElementById('btn-account');
  if (!btn) return;
  if (auth.user) {
    const img = auth.user.avatar
      ? `<img class="avatar-btn" src="${auth.user.avatar}" alt="" referrerpolicy="no-referrer">`
      : `<span class="avatar-btn avatar-btn-fallback" aria-hidden="true">${(auth.user.name || 'R').slice(0, 1).toUpperCase()}</span>`;
    btn.innerHTML = img;
    btn.setAttribute('aria-label', `Account — ${auth.user.name}`);
    btn.title = `${auth.user.name} — ${auth.user.email || 'signed in'}`;
  } else {
    btn.innerHTML = ACCOUNT_ICON;
    btn.setAttribute('aria-label', 'Account — sign in');
    btn.title = 'Account';
  }
}

function initAccountUi() {
  document.getElementById('btn-account').addEventListener('click', () => {
    location.hash = '#/journey';
    requestAnimationFrame(() =>
      document.getElementById('account')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  });
  paintAccountBtn();
  initAuth(); // resolves any existing Google session (also runs after the OAuth redirect)
  let syncedUserId = null;
  onAuthChange(() => {
    paintAccountBtn();
    if (!auth.user) {
      syncedUserId = null;
      if (booted) renderRoute(currentRoute(), { keepScroll: true });
      return;
    }
    if (auth.user.id !== syncedUserId) {
      // First sight of this account on this device: adopt cloud state, then push ours.
      syncedUserId = auth.user.id;
      syncNow()
        .then((res) => {
          if (booted && res?.merged) renderRoute(currentRoute(), { keepScroll: true });
        })
        .catch(() => {});
    } else if (booted) {
      renderRoute(currentRoute(), { keepScroll: true });
    }
  });
}

function fail(message) {
  loader.classList.add('error');
  loaderText.textContent = message;
  retryBtn.hidden = false;
}

/* Coalesce popstate + hashchange into one render per frame. */
let routeQueued = false;
function scheduleRoute() {
  if (routeQueued) return;
  routeQueued = true;
  requestAnimationFrame(() => {
    routeQueued = false;
    renderRoute(currentRoute());
  });
}

async function boot() {
  // Watchdog: never leave the app "Loading…" forever.
  const watchdog = setTimeout(() => {
    if (!booted) fail('Still loading… check your connection.');
  }, 12000);

  try {
    await loadCore();
    applyTheme();
    initThemeToggle();
    initAccountUi();
    initExploreUi();

    document.querySelectorAll('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        const route = t.dataset.route;
        if (route === currentRoute()) return;
        location.hash = route === 'explore' ? currentVerseHashFor() : `#/${route}`;
      })
    );
    window.addEventListener('hashchange', scheduleRoute);
    window.addEventListener('popstate', scheduleRoute);

    await renderRoute(currentRoute());
    booted = true;
    clearTimeout(watchdog);
    loader.classList.add('done');

    scheduleReminder();

    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support is a bonus — never block the app */
      });
    }

    // Test handle for the acceptance suite (harmless in production).
    window.__STG__ = {
      core,
      store,
      ctx,
      renderRoute,
      dailyPick,
      streak,
      auth,
      mergeState,
      syncStatus,
      explore: { activeIndex: exploreActiveIndex, simulateFailure: exploreSimulateFailure },
      explorePreloaded,
    };
  } catch (err) {
    console.error('boot failed', err);
    clearTimeout(watchdog);
    fail('Could not load the scripture. Check your connection and try again.');
  }
}

function currentVerseHashFor() {
  // "Read" returns to the verse the reader was last on.
  try {
    const i = exploreActiveIndex();
    const v = core.verses[i];
    return v ? `#/ch${v.ch}/v${v.v}` : '#/explore';
  } catch {
    return '#/explore';
  }
}

retryBtn.addEventListener('click', () => location.reload());

boot();
