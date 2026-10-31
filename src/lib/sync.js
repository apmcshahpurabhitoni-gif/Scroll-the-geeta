// Cross-device sync: exactly one row per user in the `stg_state` table,
// protected by row-level security (users can only ever read/write their own
// row — enforced on the server, not in this code).
//
// Merge policy (documented, deterministic):
//   bookmarks / completions → union of both sides (nothing is ever lost)
//   picks (daily-quote archive) → merged by date
//   settings / reminder      → the newer snapshot wins for that object
//   reminder.lastFired       → never synced (it is device-local by design)
import { supabase } from './supabase.js';
import { auth } from './auth.js';
import { store } from './store.js';

const TABLE = 'stg_state';

export const syncStatus = {
  state: 'local', // 'local' | 'syncing' | 'synced' | 'error'
  at: 0, // epoch ms of last successful sync
  error: '',
};

const statusListeners = new Set();
export function onSyncStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
function setStatus(state, error = '') {
  syncStatus.state = state;
  syncStatus.error = error;
  if (state === 'synced') syncStatus.at = Date.now();
  for (const fn of [...statusListeners]) {
    try {
      fn(syncStatus);
    } catch (err) {
      console.error('sync listener failed', err);
    }
  }
}

function unionSorted(a = [], b = []) {
  return [...new Set([...a, ...b])].sort((x, y) => (x > y ? 1 : -1));
}

/** Pure merge of two store snapshots. Exposed for tests. */
export function mergeState(local, remote) {
  const l = local || {};
  const r = remote || {};
  const remoteNewer = (r.updatedAt || 0) >= (l.updatedAt || 0);
  const pickNewer = (lo, ro) => (remoteNewer ? { ...lo, ...ro } : { ...ro, ...lo });
  return {
    settings: pickNewer(l.settings, r.settings),
    bookmarks: unionSorted(l.bookmarks, r.bookmarks),
    completions: unionSorted(l.completions, r.completions),
    picks: { ...(r.picks || {}), ...(l.picks || {}) },
    reminder: { ...pickNewer(l.reminder || {}, r.reminder || {}), lastFired: l.reminder?.lastFired || '' },
    updatedAt: Math.max(l.updatedAt || 0, r.updatedAt || 0),
  };
}

/** What leaves this device: everything except device-local reminder state. */
function serializableState() {
  const s = JSON.parse(JSON.stringify(store.state));
  if (s.reminder) delete s.reminder.lastFired;
  return s;
}

function friendly(error) {
  const msg = String(error?.message || error || '');
  if (/permission denied|row-level security|42501/i.test(msg))
    return 'The sync table rejected the write — its security rules are not set up yet.';
  if (/relation .* does not exist|PGRST205|42P01/i.test(msg))
    return 'Sync is not set up on the server yet (missing table).';
  return msg || 'Sync failed.';
}

export async function push() {
  const sb = supabase();
  if (!sb || !auth.user) return { ok: false, skipped: true };
  setStatus('syncing');
  const { error } = await sb
    .from(TABLE)
    .upsert({ user_id: auth.user.id, payload: serializableState(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    setStatus('error', friendly(error));
    return { ok: false, error };
  }
  setStatus('synced');
  return { ok: true };
}

export async function pull() {
  const sb = supabase();
  if (!sb || !auth.user) return { ok: false, skipped: true };
  setStatus('syncing');
  const { data, error } = await sb.from(TABLE).select('payload').eq('user_id', auth.user.id).maybeSingle();
  if (error) {
    setStatus('error', friendly(error));
    return { ok: false, error };
  }
  if (data?.payload) {
    const merged = mergeState(store.state, data.payload);
    store.replace(merged, { silent: true });
    setStatus('synced');
    return { ok: true, merged: true };
  }
  // First sign-in on this account: the cloud row is created by the push below.
  setStatus('synced');
  return { ok: true, merged: false };
}

/** Full round trip: adopt the cloud state, then make sure it has ours too. */
export async function syncNow() {
  const pulled = await pull();
  if (!pulled.ok && !pulled.skipped) return pulled;
  const pushed = await push();
  return { ok: Boolean(pushed.ok || pushed.skipped), merged: Boolean(pulled.merged), error: pushed.error };
}

/* ---------- automatic push: debounce store writes while signed in ---------- */

let debounce = null;

store.subscribe(() => {
  if (!auth.user) return; // pull-merges use store.replace(silent) and never land here
  clearTimeout(debounce);
  debounce = setTimeout(() => push().catch(() => {}), 800);
});
