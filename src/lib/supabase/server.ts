import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route Handlers.
 * Automatically synchronizes cookies with Next.js 14 App Router headers using getAll/setAll.
 *
 * Security: Uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (with fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * and NEXT_PUBLIC_SUPABASE_URL. Service role keys are never exposed here.
 */
export async function createServerSupabaseClient() {
  const cookieStore = cookies();
  const { url, key, isValid } = getSupabaseConfig();

  if (!isValid || !url || !key) {
    return null;
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This is expected and safe when middleware is actively refreshing user sessions.
        }
      },
    },
  });
}
