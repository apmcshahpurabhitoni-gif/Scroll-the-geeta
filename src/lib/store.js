// Persistent local state (no backend): settings, bookmarks, reading history.
// Stored under a single versioned key so schema changes stay explicit.
const KEY = 'stg:v2';

const DEFAULTS = {
  settings: {
    theme: 'auto', // 'auto' | 'light' | 'dark'
    lang: 'en', // translation language shown by default: 'en' | 'hi'
    enSlug: 'sivananda',
    hiSlug: 'hi-tejomayananda',
  },
  bookmarks: [], // verse indices
  completions: [], // 'YYYY-MM-DD' dates the daily reading was completed
  picks: {}, // date -> verse index (daily-quote archive, written once)
  reminder: { enabled: false, time: '08:00', lastFired: '' },
};

let state = load();

const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      ...DEFAULTS,
      ...raw,
      settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
      reminder: { ...DEFAULTS.reminder, ...(raw.reminder || {}) },
      bookmarks: Array.isArray(raw.bookmarks) ? raw.bookmarks : [],
      completions: Array.isArray(raw.completions) ? raw.completions : [],
      picks: raw.picks && typeof raw.picks === 'object' ? raw.picks : {},
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(notify = true) {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — the app still works for this session */
  }
  if (notify) for (const fn of [...listeners]) {
    try {
      fn(state);
    } catch (err) {
      console.error('store listener failed', err);
    }
  }
}

export const store = {
  get state() {
    return state;
  },
  set(path, value) {
    const parts = path.split('.');
    let obj = state;
    for (const p of parts.slice(0, -1)) obj = obj[p];
    obj[parts.at(-1)] = value;
    save();
  },
  /** Replace the whole state (used by cloud sync merges). */
  replace(next, { silent = false } = {}) {
    const raw = next || {};
    state = {
      ...structuredClone(DEFAULTS),
      ...raw,
      settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
      reminder: { ...DEFAULTS.reminder, ...(raw.reminder || {}) },
      bookmarks: Array.isArray(raw.bookmarks) ? raw.bookmarks : [],
      completions: Array.isArray(raw.completions) ? raw.completions : [],
      picks: raw.picks && typeof raw.picks === 'object' ? raw.picks : {},
    };
    save(!silent);
  },
  /** Observe every change (used by cross-device sync). */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  save,
  reset() {
    state = structuredClone(DEFAULTS);
    save();
  },
};

/** Local calendar date as YYYY-MM-DD (user's timezone). */
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return todayKey(dt);
}

export function dayOfWeek(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
