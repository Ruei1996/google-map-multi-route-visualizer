/**
 * Supabase server-side client.
 * Uses SERVICE_ROLE_KEY for full database access — only used in API routes.
 * NEVER import this in client components.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // Warn at startup but don't crash — quota will fall back to in-memory
  console.warn(
    '[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. ' +
    'Quota will use in-memory fallback.'
  );
}

export const supabaseServer =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      })
    : null;

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseServiceKey);
