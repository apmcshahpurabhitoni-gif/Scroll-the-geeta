// Core data loading: fast critical path (verse text, ranking, topics, the two
// default translations shown on Today), with explanations and alternate
// translators deferred. Every load is cached; failures propagate so the UI
// can show a real error state with retry instead of loading forever.
import { store } from './store.js';

const cache = new Map();
const cached = (key, loader) => {
  if (!cache.has(key)) {
    cache.set(
      key,
      loader().catch((e) => {
        cache.delete(key); // allow retry
        throw e;
      })
    );
  }
  return cache.get(key);
};

export const core = {
  chapters: [],
  verses: [],
  ranking: null,
  topics: null,
  manifest: [],
  verification: null,
  indexByRef: new Map(),
};

export async function loadCore() {
  const [v, r, t, m, en, hi] = await Promise.all([
    import('../data/verses.json'),
    import('../data/ranking.json'),
    import('../data/topics.json'),
    import('../data/translations/index.json'),
    import('../data/translations/sivananda.json'),
    import('../data/translations/hi-tejomayananda.json'),
  ]);
  core.chapters = v.default.chapters;
  core.verses = v.default.verses;
  core.verification = v.default.verification || null;
  core.ranking = r.default;
  core.topics = t.default;
  core.manifest = m.default;
  core.verses.forEach((verse, i) => core.indexByRef.set(`${verse.ch}.${verse.v}`, i));

  cache.set('tx:sivananda', Promise.resolve(en.default));
  cache.set('tx:hi-tejomayananda', Promise.resolve(hi.default));
  return core;
}

export function loadTranslation(slug) {
  return cached(`tx:${slug}`, () => import(`../data/translations/${slug}.json`).then((m) => m.default));
}

export function loadExplanations() {
  return cached('explanations', () => import('../data/explanations.json').then((m) => m.default));
}

/* ---------------- lookups ---------------- */

export const refOf = (idx) => {
  const v = core.verses[idx];
  return `${v.ch}.${v.v}`;
};

export const indexOfRef = (ch, v) => core.indexByRef.get(`${ch}.${v}`);

export function parseRef(input) {
  const s = String(input).trim().replace(/[·:]/g, '.');
  const m = s.match(/^(\d{1,2})\.(\d{1,3})$/);
  if (m) return { ch: +m[1], v: +m[2] };
  if (/^\d{1,2}$/.test(s)) return { ch: +s, v: 1 };
  return null;
}

/* ---------------- active translation ---------------- */

export const activeLang = () => store.state.settings.lang;
export const activeSlug = (lang = activeLang()) =>
  lang === 'hi' ? store.state.settings.hiSlug : store.state.settings.enSlug;

export function activeMeta(lang = activeLang()) {
  const slug = activeSlug(lang);
  return core.manifest.find((m) => m.slug === slug) || core.manifest[0];
}

export async function translationArr(lang = activeLang()) {
  return loadTranslation(activeSlug(lang));
}

/** Translation text + attribution for a verse in a given language. */
export async function textOf(idx, lang = activeLang()) {
  const arr = await translationArr(lang);
  const meta = activeMeta(lang);
  return { tx: arr[idx] || '', attr: meta.author, lang };
}

export function manifestFor(lang) {
  return core.manifest.filter((m) => m.lang === lang);
}
