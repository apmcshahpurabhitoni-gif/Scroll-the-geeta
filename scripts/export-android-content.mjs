// Export the canonical generated scripture data for the native Android app.
// This script copies JSON bytes unchanged; it never normalizes or edits Scripture.
import { readFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'src', 'data');
const outputDir = join(root, 'android', 'app', 'src', 'main', 'assets', 'scripture');

const files = [
  'verses.json',
  'ranking.json',
  'topics.json',
  'explanations.json',
  'translations/index.json',
  'translations/sivananda.json',
  'translations/adidevananda.json',
  'translations/gambirananda.json',
  'translations/sankaranarayan.json',
  'translations/purohit.json',
  'translations/hi-ramsukhdas.json',
  'translations/hi-tejomayananda.json',
];

const fail = (message) => { throw new Error(`Android content export: ${message}`); };
const readJson = (path) => {
  try { return JSON.parse(readFileSync(join(sourceDir, path), 'utf8')); }
  catch (error) { fail(`cannot read/parse src/data/${path}: ${error.message}`); }
};
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const verseData = readJson('verses.json');
const ranking = readJson('ranking.json');
const topics = readJson('topics.json');
const explanations = readJson('explanations.json');
const translators = readJson('translations/index.json');

if (!Array.isArray(verseData.chapters) || verseData.chapters.length !== 18) {
  fail('expected exactly 18 chapter records');
}
if (!Array.isArray(verseData.verses) || verseData.verses.length !== 701) {
  fail(`expected exactly 701 verses, got ${verseData.verses?.length ?? 'non-array'}`);
}

const expectedCounts = [47,72,43,42,29,47,30,28,34,42,55,20,35,27,20,24,28,78];
const chapterCounts = new Map(verseData.chapters.map((chapter) => [chapter.n, chapter.count]));
for (let i = 0; i < 18; i++) {
  const chapter = verseData.chapters[i];
  if (chapter.n !== i + 1 || chapter.count !== expectedCounts[i]) {
    fail(`chapter ${i + 1} has unexpected order/count`);
  }
}
if (expectedCounts.reduce((sum, count) => sum + count, 0) !== 701) fail('internal chapter-count fixture is invalid');

const refs = new Set();
let previous = { ch: 0, v: 0 };
for (const verse of verseData.verses) {
  const ref = `${verse.ch}.${verse.v}`;
  if (!Number.isInteger(verse.ch) || !Number.isInteger(verse.v) ||
      verse.ch < 1 || verse.ch > 18 || verse.v < 1 ||
      verse.v > (chapterCounts.get(verse.ch) ?? 0)) fail(`invalid verse reference ${ref}`);
  if (refs.has(ref)) fail(`duplicate verse reference ${ref}`);
  if (!verse.sk?.trim()) fail(`empty Sanskrit text at ${ref}`);
  if (!verse.tr?.trim()) fail(`empty transliteration at ${ref}`);
  if (verse.ch < previous.ch || (verse.ch === previous.ch && verse.v <= previous.v)) {
    fail(`verses are not in strict chapter/verse order at ${ref}`);
  }
  refs.add(ref);
  previous = verse;
}

if (!Array.isArray(ranking.scores) || ranking.scores.length !== 701) {
  fail('ranking.scores must contain exactly 701 entries');
}
if (!Array.isArray(topics.byVerse) || topics.byVerse.length !== 701) {
  fail('topics.byVerse must contain exactly 701 entries');
}
if (!Array.isArray(explanations) || explanations.length !== 701) {
  fail('explanations must contain exactly 701 entries');
}
if (!Array.isArray(translators) || translators.length !== 7) {
  fail('translation index must contain exactly seven translator records');
}

for (const translator of translators) {
  if (!translator.slug || !translator.author || !['en', 'hi'].includes(translator.lang)) {
    fail('translation index contains an invalid translator record');
  }
  const path = `translations/${translator.slug}.json`;
  const rows = readJson(path);
  if (!Array.isArray(rows) || rows.length !== 701) {
    fail(`${path} must contain exactly 701 entries`);
  }
  const missing = rows.findIndex((value) => typeof value !== 'string' || !value.trim());
  if (missing !== -1) fail(`${path} has an empty/non-string translation at verse index ${missing}`);
}

const verification = verseData.verification ?? {};
if (!Array.isArray(verification.repaired) || !Array.isArray(verification.adoptedFromSecondSource)) {
  fail('verse verification provenance arrays are missing');
}

// Validate everything before touching the destination directory.
mkdirSync(outputDir, { recursive: true });
const manifestFiles = [];
for (const path of files) {
  const source = join(sourceDir, path);
  const destination = join(outputDir, path);
  mkdirSync(dirname(destination), { recursive: true });
  const bytes = readFileSync(source);
  copyFileSync(source, destination);
  manifestFiles.push({
    path,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
}

const manifest = {
  schemaVersion: 1,
  sourceCommit: process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || 'working-tree',
  generatedAt: new Date().toISOString(),
  counts: {
    chapters: verseData.chapters.length,
    verses: verseData.verses.length,
    translations: translators.length,
    repairedSanskritRefs: verification.repaired.length,
    adoptedSecondSourceRefs: verification.adoptedFromSecondSource.length,
  },
  verseReferenceFormat: 'chapter.verse',
  files: manifestFiles,
};
writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Exported ${manifest.counts.verses} verses, ${manifest.counts.chapters} chapters and ${manifest.counts.translations} translations.`);
console.log(`Destination: ${relative(root, outputDir)}`);
console.log(`Manifest: ${join(relative(root, outputDir), 'manifest.json')}`);
