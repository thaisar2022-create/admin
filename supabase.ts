import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://xqxdcijfyayssdasvpxs.supabase.co';

const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

/**
 * The anon (publishable) key is NOT bundled here. Fill it in your own .env
 * file (copy .env.example -> .env). Without it the app shows the fallback
 * catalog and cannot read/write live Supabase data.
 */
export const isSupabaseConfigured = ANON_KEY.trim().length > 10 && ANON_KEY !== 'YOUR_PUBLISHABLE_KEY_HERE';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  : null;

export const STORAGE_BUCKET = 'thaisar-uploads';
