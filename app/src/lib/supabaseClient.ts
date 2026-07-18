import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function getSupabaseUrl() {
  return import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '') || '';
}

function getSupabaseAnonKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

/** Browser Supabase client (session truth source). Null when Auth env is missing. */
export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;

  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
