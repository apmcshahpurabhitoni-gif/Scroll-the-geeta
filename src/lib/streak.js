// Streak logic. A day counts once (date-keyed, idempotent), consecutive local
// calendar days extend the streak, a missed full day ends the active streak,
// and the longest streak is preserved forever.
import { store, todayKey, addDays } from './store.js';

export function markRead(dateKey = todayKey()) {
  const completions = store.state.completions;
  if (completions.includes(dateKey)) return false; // duplicate clicks never double-count
  completions.push(dateKey);
  completions.sort();
  store.set('completions', completions);
  return true;
}

export function isRead(dateKey = todayKey()) {
  return store.state.completions.includes(dateKey);
}

export function computeStreaks(completions = store.state.completions) {
  const set = new Set(completions);
  const totalDays = set.size;

  // Longest consecutive run
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const key of [...set].sort()) {
    run = prev && addDays(prev, 1) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = key;
  }

  // Current streak: walk back from today; if today isn't read yet, from yesterday
  // (today can still be completed later without having "missed" it).
  const today = todayKey();
  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  if (set.has(cursor)) {
    while (set.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }

  return { current, longest, totalDays };
}

/** Last `n` calendar days (oldest first) with read state — for the weekly view. */
export function recentDays(n = 7) {
  const set = new Set(store.state.completions);
  const out = [];
  let key = todayKey();
  for (let i = 0; i < n; i++) {
    out.unshift({ key, read: set.has(key) });
    key = addDays(key, -1);
  }
  return out;
}
