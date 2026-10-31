// Google sign-in via Supabase Auth (OAuth). The session is persisted in
// localStorage by supabase-js. When Supabase is not configured for this
// build, every call reports that honestly instead of failing silently.
import { supabase, supabaseConfigured } from './supabase.js';

export const auth = {
  user: null, // { id, email, name, avatar } once signed in
  status: 'signedout', // 'signedout' | 'signedin' | 'busy' | 'error'
  error: '',
  configured: supabaseConfigured,
};

const listeners = new Set();
export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of [...listeners]) {
    try {
      fn(auth);
    } catch (err) {
      console.error('auth listener failed', err);
    }
  }
}

function normalize(session) {
  const u = session?.user;
  if (!u) return null;
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email || meta.email || '',
    name: meta.full_name || meta.name || (u.email || 'Reader').split('@')[0],
    avatar: meta.avatar_url || meta.picture || '',
  };
}

/** Subscribe to session changes and resolve the current session, if any. */
export async function initAuth() {
  if (!supabaseConfigured) return null;
  const sb = supabase();
  sb.auth.onAuthStateChange((_event, session) => {
    auth.user = normalize(session);
    auth.status = auth.user ? 'signedin' : 'signedout';
    if (auth.user) auth.error = '';
    emit();
  });
  const { data } = await sb.auth.getSession();
  auth.user = normalize(data.session);
  auth.status = auth.user ? 'signedin' : 'signedout';
  emit();
  return auth.user;
}

/** Redirect the browser to Google's consent screen (returns after sign-in). */
export async function signInWithGoogle() {
  if (!supabaseConfigured) {
    auth.status = 'error';
    auth.error = 'Sign-in is not configured for this deployment yet.';
    emit();
    return { ok: false, error: auth.error };
  }
  auth.status = 'busy';
  auth.error = '';
  emit();
  const { error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'openid email profile',
      redirectTo: `${location.origin}${location.pathname}#/journey`,
    },
  });
  if (error) {
    auth.status = 'error';
    auth.error = error.message || 'Could not start Google sign-in.';
    emit();
    return { ok: false, error: auth.error };
  }
  return { ok: true }; // navigation to Google takes over from here
}

export async function signOut() {
  if (supabaseConfigured) {
    try {
      await supabase().auth.signOut();
    } catch (err) {
      console.error('sign-out failed', err); // local state still clears below
    }
  }
  auth.user = null;
  auth.status = 'signedout';
  auth.error = '';
  emit();
}
