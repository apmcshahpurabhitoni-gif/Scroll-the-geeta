// Daily quote selection: one verse per calendar day, stable across refreshes.
//
// No backend exists, so selection is date-seeded and deterministic: the same
// date + the same local pick history always yields the same verse (hence the
// same across languages too). Each date's pick is stored once and never
// recomputed, which also powers the archive.
//
// Weighting follows the ranking metadata: tiers S/A/B/C get configurable
// weights, verses picked within the repeat-avoidance window are excluded
// (all 701 verses stay eligible for the daily quote — nothing is paywalled),
// and editorial overrides in ranking.json take precedence.
import { store, todayKey, addDays } from './store.js';

const DAY_MS = 86400000;

/** Deterministic 32-bit hash → [0,1) PRNG, seeded by date string. */
function seededUnit(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const tierOf = (score) => (score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 50 ? 'B' : 'C');

export function dailyPick({ dateKey = todayKey(), count, scores, ranking } = {}) {
  const override = ranking.overrides?.[dateKey];
  if (override !== undefined && override >= 0 && override < count) {
    remember(dateKey, override);
    return override;
  }

  const cached = store.state.picks[dateKey];
  if (cached !== undefined && cached !== null && cached < count) return cached;

  // Repeat avoidance: skip anything picked within the window when possible.
  const windowDays = ranking.selection?.repeatAvoidanceDays ?? 90;
  const cutoff = addDays(dateKey, -windowDays);
  const recent = new Set();
  for (const [d, idx] of Object.entries(store.state.picks)) {
    if (d >= cutoff && d < dateKey) recent.add(idx);
  }

  const weights = ranking.selection?.tierWeights ?? { S: 8, A: 4, B: 1.5, C: 0.5 };
  const candidates = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (recent.has(i)) continue; // never repeat inside the window
    const w = weights[tierOf(scores[i])] ?? 1;
    total += w;
    candidates.push({ i, acc: total });
  }

  let idx;
  if (candidates.length === 0) {
    // Window larger than the eligible pool — fall back to any verse.
    idx = Math.floor(seededUnit(dateKey) * count) % count;
  } else {
    const r = seededUnit(dateKey) * total;
    idx = candidates.find((c) => c.acc > r)?.i ?? candidates.at(-1).i;
  }

  remember(dateKey, idx);
  return idx;
}

function remember(dateKey, idx) {
  if (store.state.picks[dateKey] === idx) return;
  const picks = { ...store.state.picks, [dateKey]: idx };
  // Keep only the last 400 dates to bound storage.
  const keys = Object.keys(picks).sort().slice(-400);
  const trimmed = Object.fromEntries(keys.map((k) => [k, picks[k]]));
  store.set('picks', trimmed);
}

/** Archive: every stored daily pick, newest first. */
export function archive() {
  return Object.entries(store.state.picks)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, idx]) => ({ date, idx }));
}

export function daysAgo(n) {
  return addDays(todayKey(), -n);
}

export { DAY_MS };
