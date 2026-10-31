// Supabase client — created lazily so the app runs fine before the project
// is configured. Both values below are PUBLIC (baked into the client bundle
// by design); all user data is protected server-side by row-level security,
// never by hiding these. Fill them in .env to enable accounts:
//   VITE_SUPABASE_URL    https://<project-ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY  the anon/public key of that project
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(url && anon);

let client = null;

export function supabase() {
  if (!supabaseConfigured) return null;
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true, // handles the OAuth ?code=… return
        storageKey: 'stg:auth',
        autoRefreshToken: true,
      },
    });
  }
  return client;
}
