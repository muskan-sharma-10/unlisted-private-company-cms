'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/supabase/auth';

/**
 * Explicit response contract for admin verification Server Action.
 */
export interface AdminVerificationResult {
  isAdmin: boolean;
  error?: string;
  source?: 'app_metadata' | 'allowlist' | 'none';
}

/**
 * Server Action to verify whether the currently authenticated user has admin privileges.
 *
 * Runs strictly on the server:
 * - Has direct access to process.env.ADMIN_EMAILS.
 * - Accepts an optional accessToken to securely fetch and verify the user directly with Supabase.
 * - Employs the canonical isUserAdmin() authorization check.
 * - Always returns a consistent, explicitly typed object.
 */
export async function verifyAdminSessionAction(
  accessToken?: string
): Promise<AdminVerificationResult> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return {
        isAdmin: false,
        error: 'Database client not configured',
        source: 'none',
      };
    }

    let user = null;

    // 1. Verify user with JWT if provided
    if (accessToken) {
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    // 2. Fall back to cookie session
    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data?.user ?? null;
    }

    if (!user) {
      return {
        isAdmin: false,
        error: 'Authenticated session not found',
        source: 'none',
      };
    }

    let isAdmin = isUserAdmin(user);
    let source: 'app_metadata' | 'allowlist' | 'none' = 'none';

    if (
      user.app_metadata?.role === 'admin' ||
      user.app_metadata?.role === 'superadmin' ||
      user.app_metadata?.is_admin === true
    ) {
      isAdmin = true;
      source = 'app_metadata';
    } else if (isAdmin) {
      source = 'allowlist';
    } else {
      // 3. Fallback: Query actual Supabase admin_users table in database
      const userEmail = user.email ? user.email.trim().toLowerCase() : '';
      const filterConditions = userEmail
        ? `user_id.eq.${user.id},email.ilike.${userEmail}`
        : `user_id.eq.${user.id}`;

      const { data: dbAdmin } = await supabase
        .from('admin_users')
        .select('id')
        .or(filterConditions)
        .maybeSingle();

      if (dbAdmin) {
        isAdmin = true;
        source = 'allowlist';
      }
    }

    return {
      isAdmin,
      source,
    };
  } catch (err) {
    console.error('[Admin Action Error] Verification failed:', err);
    return {
      isAdmin: false,
      error: 'Authorization verification failed',
      source: 'none',
    };
  }
}
