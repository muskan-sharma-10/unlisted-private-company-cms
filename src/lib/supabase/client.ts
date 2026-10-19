import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './config';

/**
 * Creates a Supabase client for client-side components.
 * Note: Reads NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (with fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * and NEXT_PUBLIC_SUPABASE_URL with robust normalization.
 * Never expose the Supabase service role key here.
 */
export function createClient() {
  const { url, key, isValid } = getSupabaseConfig();

  if (!isValid || !url || !key) {
    return null;
  }

  return createBrowserClient(url, key);
}

