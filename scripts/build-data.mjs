// Merges downloaded source datasets into the app's data files.
// Sources (see DATA-SOURCES.md): gita/gita (Sanskrit, transliteration, translations)
// and AdiyogiArts/gita-json (chapter names, explanations, word meanings).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => JSON.parse(readFileSync(join(root, 'data-src', f), 'utf8'));

const verses = src('gita-verse.json');
const translations = src('gita-translation.json');
const base = src('adiyogi-base.json');

// --- verses: sort by chapter/verse, clean whitespace ---
const sorted = [...verses].sort((a, b) =>
  a.chapter_number - b.chapter_number || a.verse_number - b.verse_number
);
if (sorted.length !== 701) throw new Error(`Expected 701 verses, got ${sorted.length}`);

const clean = (s) =>
  (s || '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim();

/* ---------------- Sanskrit text integrity ----------------
 * The primary source (gita/gita) contains 25 verses whose Devanagari has a
 * malformed codepoint order: a virama directly followed by an i-matra, with
 * the consonant displaced (e.g. "भक्ित" instead of "भक्ति"). This renders as
 * a visible glitch. We repair the ordering mechanically, verify each repair
 * against the independent AdiyogiArts text, and — where the repaired text
 * still disagrees with the second source — adopt the second source's text
 * for that verse. Every affected reference is recorded in verses.json and
 * listed in DATA-SOURCES.md. Nothing is changed silently.
 */
const MALFORMED = /्ि/;
const normalizeDeva = (s) =>
  [...s]
    .filter((c) => c >= 'ऀ' && c <= 'ॿ' && !/[०-९।॥]/.test(c))
    .map((c) => (c === 'ँ' || c === 'ं' ? 'ं' : c))
    .join('');

const repairedRefs = [];
const adoptedRefs = [];

const skTextOf = (v) => {
  const ref = `${v.chapter_number}.${v.verse_number}`;
  const raw = v.text;
  if (!MALFORMED.test(raw)) return raw;
  const adi = base[`${v.chapter_number}-${v.verse_number}`]?.sanskrit || '';
  const repaired = raw.replace(/्ि(.)/g, '्$1ि');
  if (normalizeDeva(repaired) === normalizeDeva(adi)) {
    repairedRefs.push(ref);
    return repaired;
  }
  adoptedRefs.push(ref);
  const parts = adi
    .split('|')
    .map((s) => s.replace(/॥.*$/, '').trim())
    .filter(Boolean);
  return `${parts.join('\n')}।।${v.chapter_number}.${v.verse_number}।।`;
};

// --- chapter names from adiyogi base ---
const chapters = [];
for (let c = 1; c <= 18; c++) {
  const sample = base[`${c}-1`];
  const count = sorted.filter((v) => v.chapter_number === c).length;
  chapters.push({
    n: c,
    name: clean(sample.chapterName),
    nameEn: clean(sample.chapterNameTranslation),
    count,
  });
}

const verseData = sorted.map((v) => ({
  ch: v.chapter_number,
  v: v.verse_number,
  sk: clean(skTextOf(v)),
  tr: clean(v.transliteration),
}));

const stillMalformed = verseData.filter((x) => MALFORMED.test(x.sk));
if (stillMalformed.length) throw new Error('Malformed Devanagari remains after repair');

// --- translations: one file per translator, ordered by (chapter, verse) ---
const byId = new Map(sorted.map((v, i) => [v.id, i]));
const slugs = {
  'Swami Sivananda': 'sivananda',
  'Swami Adidevananda': 'adidevananda',
  'Swami Gambirananda': 'gambirananda',
  'Dr. S. Sankaranarayan': 'sankaranarayan',
  'Shri Purohit Swami': 'purohit',
};
// Hindi translators (full coverage, same join logic as English)
const slugsHi = {
  'Swami Ramsukhdas': 'hi-ramsukhdas',
  'Swami Tejomayananda': 'hi-tejomayananda',
};

const manifest = [];
const outDir = join(root, 'src', 'data');
mkdirSync(join(outDir, 'translations'), { recursive: true });

const emitTranslation = (lang, author, slug) => {
  const rows = translations.filter((t) => t.lang === lang && t.authorName === author);
  const arr = new Array(701).fill('');
  for (const r of rows) {
    const idx = byId.get(r.verse_id);
    if (idx === undefined) throw new Error(`Unknown verse_id ${r.verse_id} for ${author}`);
    arr[idx] = clean(r.description);
  }
  const missing = arr.filter((s) => !s).length;
  if (missing) throw new Error(`${author}: ${missing} verses missing translation`);
  writeFileSync(join(outDir, 'translations', `${slug}.json`), JSON.stringify(arr));
  manifest.push({ author, slug, lang: lang === 'english' ? 'en' : 'hi', chars: arr.join('').length });
};

for (const [author, slug] of Object.entries(slugs)) emitTranslation('english', author, slug);
for (const [author, slug] of Object.entries(slugsHi)) emitTranslation('hindi', author, slug);

// Explanations + word meanings from AdiyogiArts (kept separate from scripture text)
const explain = src('adiyogi-en.json');
const explainData = sorted.map((v) => {
  const rec = explain[`${v.chapter_number}-${v.verse_number}`] || {};
  return { e: clean(rec.explanation), w: clean(rec.wordMeanings) };
});
// Missing explanations are preserved as empty and flagged in the app (never fabricated).
const missingExplain = explainData.filter((x) => !x.e).length;
writeFileSync(join(outDir, 'explanations.json'), JSON.stringify(explainData));

writeFileSync(
  join(outDir, 'verses.json'),
  JSON.stringify({
    verification: {
      primarySource: 'gita/gita',
      crossCheckedWith: 'AdiyogiArts/gita-json',
      repaired: repairedRefs,
      adoptedFromSecondSource: adoptedRefs,
    },
    chapters,
    verses: verseData,
  })
);
writeFileSync(join(outDir, 'translations', 'index.json'), JSON.stringify(manifest, null, 2));

console.log(`Wrote ${verseData.length} verses, ${chapters.length} chapters.`);
console.log(
  `Sanskrit integrity: ${repairedRefs.length} verses repaired in place (cross-checked), ${adoptedRefs.length} adopted from second source.`
);
for (const m of manifest) console.log(`  ${m.slug}: ${m.author} [${m.lang}] (${(m.chars / 1024).toFixed(0)} KB)`);
console.log(`  explanations.json (${(JSON.stringify(explainData).length / 1024).toFixed(0)} KB, ${missingExplain} flagged as missing)`);
