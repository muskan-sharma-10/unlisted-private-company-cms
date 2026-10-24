'use server';

import { getAuthenticatedAdminSession } from '@/lib/supabase/server';
import type { AdminPrivilegeSource } from '@/lib/supabase/auth';

/**
 * Explicit response contract for admin verification Server Action.
 */
export interface AdminVerificationResult {
  isAdmin: boolean;
  error?: string;
  source?: AdminPrivilegeSource;
}

/**
 * Server Action to verify whether the currently authenticated user has admin privileges.
 *
 * Runs strictly on the server:
 * - Has direct access to process.env.ADMIN_EMAILS.
 * - Accepts an optional accessToken to securely fetch and verify the user directly with Supabase Auth server.
 * - Employs centralized verifyUserAdminServer() checking app_metadata, allowlist, and database admin_users.
 * - Always returns a consistent, explicitly typed object.
 */
export async function verifyAdminSessionAction(
  accessToken?: string
): Promise<AdminVerificationResult> {
  const session = await getAuthenticatedAdminSession(accessToken);
  return {
    isAdmin: session.isAdmin,
    error: session.error,
    source: session.source,
  };
}

