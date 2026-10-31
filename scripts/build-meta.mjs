// Builds editorial metadata: verse importance ranking and topic tags.
//
// Ranking — transparent, deterministic, and explicitly INITIAL/UNVERIFIED:
//   score = 30*applicability + 25*centrality + 20*reflection
//         + 15*clarity + 10*context        (each component 0..1)
//
//   * clarity is computed from translation length and line count (short, single-idea
//     verses read better in isolation — matches the spec's "clarity when read
//     individually" criterion).
//   * the spec's seeded review references get high editorial baselines
//     (applicability .95, centrality .95, reflection .90, context .85);
//     every other verse gets documented placeholder baselines of .45 pending
//     editorial review, and context .80 (every verse has value in context).
//
// Tiers follow the spec bands: S 90–100, A 75–89, B 50–74, C 0–49.
// No verse is ever hidden or removed — ranking only affects daily-quote weighting.
//
// Topics — deterministic keyword tags over the English translation and
// transliteration, clearly labelled in the app as auto-generated.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const { chapters, verses } = read('src/data/verses.json');
const en = read('src/data/translations/sivananda.json');

if (verses.length !== 701) throw new Error(`Expected 701 verses, got ${verses.length}`);

/* ---------------- seed references from the implementation brief ---------------- */

const SEED_REFS = [
  '2.14', '2.20', '2.47', '2.48', '2.56', '2.62', '2.63', '2.70',
  '3.19', '3.30', '4.7', '4.8', '4.34', '4.38', '5.18', '6.5', '6.26',
  '6.29', '6.35', '9.22', '9.26', '10.20', '12.13', '12.14', '12.15',
  '12.18', '12.19', '14.22', '14.23', '14.24', '14.25', '16.1', '16.2',
  '16.3', '17.15', '18.47', '18.63', '18.65', '18.66',
];

const countOf = Object.fromEntries(chapters.map((c) => [c.n, c.count]));
const seedSet = new Set();
for (const ref of SEED_REFS) {
  const [c, v] = ref.split('.').map(Number);
  if (!countOf[c] || v < 1 || v > countOf[c]) {
    throw new Error(`Seed reference ${ref} does not exist in the source text (ch ${c} has ${countOf[c] ?? '?'} verses)`);
  }
  seedSet.add(ref);
}
console.log(`Verified ${seedSet.size} seed references against the source text.`);

/* ---------------- scoring ---------------- */

const clamp01 = (x) => Math.min(1, Math.max(0, x));

const clarityOf = (text) => {
  const len = text.length;
  const lines = (text.match(/\n/g) || []).length + 1;
  // Translations run 72–320 chars (median ~145), almost all single-line.
  const lenScore = clamp01(1 - Math.max(0, len - 100) / 300);
  const lineScore = clamp01(1 - Math.max(0, lines - 2) / 6);
  return clamp01(0.8 * lenScore + 0.2 * lineScore);
};

const scores = verses.map((v, i) => {
  const ref = `${v.ch}.${v.v}`;
  const seed = seedSet.has(ref);
  const clarity = clarityOf(en[i] || '');
  const applicability = seed ? 0.95 : 0.45;
  const centrality = seed ? 0.95 : 0.45;
  const reflection = seed ? 0.9 : 0.45;
  const context = seed ? 0.85 : 0.8;
  const score = Math.round(
    30 * applicability + 25 * centrality + 20 * reflection + 15 * clarity + 10 * context
  );
  return Math.max(0, Math.min(100, score));
});

const tierOf = (s) => (s >= 90 ? 'S' : s >= 75 ? 'A' : s >= 50 ? 'B' : 'C');
const tierCounts = { S: 0, A: 0, B: 0, C: 0 };
scores.forEach((s) => tierCounts[tierOf(s)]++);
console.log('Tier distribution:', tierCounts);

const ranking = {
  verification: 'initial-editorial-unverified',
  note:
    'Scores are editorial guidance for daily-quote weighting only. Every verse stays fully readable regardless of score. ' +
    'Formula: 30% broad applicability, 25% centrality to major teachings, 20% reflection value, 15% clarity when read alone, ' +
    '10% value for understanding the wider text. Clarity is computed from translation length; other components use documented ' +
    'baselines (seed references high, all others .45) pending editorial review. Seed references were verified to exist in the source text.',
  weights: { applicability: 0.3, centrality: 0.25, reflection: 0.2, clarity: 0.15, context: 0.1 },
  baselines: { seed: { applicability: 0.95, centrality: 0.95, reflection: 0.9, context: 0.85 }, other: { applicability: 0.45, centrality: 0.45, reflection: 0.45, context: 0.8 } },
  tiers: { S: [90, 100], A: [75, 89], B: [50, 74], C: [0, 49] },
  selection: { tierWeights: { S: 8, A: 4, B: 1.5, C: 0.5 }, repeatAvoidanceDays: 90 },
  seedRefs: [...seedSet],
  scores,
};
writeFileSync(join(root, 'src/data/ranking.json'), JSON.stringify(ranking));

/* ---------------- topics ---------------- */

const TOPICS = {
  karma: ['karma', 'action', 'act ', 'work', 'deed', 'fruit', 'doer', 'doing'],
  dharma: ['dharma', 'duty', 'righteous', 'virtue', 'moral', 'ethical', 'law of'],
  detachment: ['detachment', 'detached', 'renounce', 'renunciation', 'unattached', 'non-attachment', 'give up', 'abandon', 'nonattachment'],
  equanimity: ['equanimity', 'even-minded', 'even minded', 'alike', 'pleasure and pain', 'success and failure', 'balanced', 'unchanged', 'heat and cold', 'honor and disgrace'],
  meditation: ['meditat', 'concentration', 'contemplat', 'focused mind', 'mind fixed', 'breath', 'yoga of meditation', 'samadhi', 'steady posture'],
  'self-knowledge': ['soul', 'atman', 'self-knowledge', 'knower', 'consciousness', 'spirit', 'the self', 'my nature', 'know me', 'i am', 'birthless', 'indestructible'],
  'desire-anger': ['desire', 'lust', 'anger', 'wrath', 'craving', 'greed', 'lustful'],
  devotion: ['devotee', 'worship', 'bhakti', 'devotion', 'devoted', 'surrender', 'prayer', 'faithful', 'my devotee', 'offer'],
  compassion: ['compassion', 'merciful', 'kindness', 'friendly', 'benevolent', 'harm', 'non-violence', 'ahimsa', 'friend'],
  wisdom: ['wisdom', 'knowledge', 'jnana', 'wise', 'understand', 'learn', 'teacher', 'insight', 'illumined'],
  discipline: ['discipline', 'disciplined', 'practice', 'restraint', 'control', 'austerity', 'tapas', 'steady', 'regulated', 'self-control'],
  fear: ['fear', 'fearless', 'afraid', 'terror', 'brave'],
  peace: ['peace', 'peaceful', 'calm', 'tranquil', 'still', 'serene', 'silence'],
  character: ['character', 'pride', 'ego', 'arrogant', 'humble', 'hypocrite', 'honour', 'honor', 'noble', 'ignoble', 'quality', 'qualities', 'guna', 'nature of'],
};

const topicsByVerse = verses.map((v, i) => {
  const hay = `${en[i] || ''} ${v.tr || ''}`.toLowerCase();
  const tags = Object.entries(TOPICS)
    .filter(([, words]) => words.some((w) => hay.includes(w)))
    .map(([tag]) => tag);
  return tags;
});

const topicCounts = {};
for (const tags of topicsByVerse) for (const t of tags) topicCounts[t] = (topicCounts[t] || 0) + 1;
const untagged = topicsByVerse.filter((t) => t.length === 0).length;
console.log('Topic coverage:', topicCounts, '| untagged verses:', untagged);

writeFileSync(
  join(root, 'src/data/topics.json'),
  JSON.stringify({ label: 'Auto-generated keyword tags — editorial review pending', topics: Object.keys(TOPICS), byVerse: topicsByVerse })
);

console.log('Wrote ranking.json and topics.json');
