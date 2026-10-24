import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
import {
  verifyUserAdminServer,
  type AdminPrivilegeSource,
} from './auth';

/**
 * Authoritative session verification contract.
 */
export interface AuthenticatedAdminSession {
  user: User | null;
  isAdmin: boolean;
  error?: string;
  source: AdminPrivilegeSource;
}

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

/**
 * Authoritative, server-side session and admin validation.
 * Safely verifies:
 * 1. Supabase Auth session via supabase.auth.getUser() (contacting Supabase Auth server)
 * 2. Admin authorization via verifyUserAdminServer (app_metadata, ADMIN_EMAILS, and admin_users table)
 * 3. Graceful handling of network, expired, or missing sessions.
 */
export async function getAuthenticatedAdminSession(
  accessToken?: string
): Promise<AuthenticatedAdminSession> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return {
        user: null,
        isAdmin: false,
        error: 'Database client not configured',
        source: 'none',
      };
    }

    let user: User | null = null;

    // 1. Explicit JWT verification if accessToken provided
    if (accessToken) {
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    // 2. Cookie session verification
    if (!user) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      return {
        user: null,
        isAdmin: false,
        error: 'Authenticated session not found',
        source: 'none',
      };
    }

    // 3. Authoritative admin privilege check
    const authDetails = await verifyUserAdminServer(supabase, user);

    return {
      user,
      isAdmin: authDetails.isAdmin,
      error: authDetails.error,
      source: authDetails.source,
    };
  } catch (err: unknown) {
    // Next.js internal control-flow exceptions must be rethrown
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      typeof (err as { digest: unknown }).digest === 'string' &&
      ['NEXT_REDIRECT', 'NEXT_NOT_FOUND', 'DYNAMIC_SERVER_USAGE'].includes(
        (err as { digest: string }).digest
      )
    ) {
      throw err;
    }

    console.error('[Session Error] Session validation failed:', err);
    return {
      user: null,
      isAdmin: false,
      error: 'Authorization verification failed',
      source: 'none',
    };
  }
}
