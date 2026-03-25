/**
 * Supabase browser-side client.
 * Uses ANON key — safe to expose to the browser.
 * Only used for READ operations (quota status display).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseBrowser =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseBrowserEnabled = Boolean(supabaseUrl && supabaseAnonKey);
