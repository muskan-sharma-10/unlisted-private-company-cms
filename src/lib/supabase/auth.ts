import type { User } from '@supabase/supabase-js';

/**
 * Explicitly verifies if an authenticated user is an authorized administrator.
 *
 * Requirements:
 * - Never treat any arbitrary authenticated user as an admin.
 * - Supports app_metadata (cannot be modified by client users; set via Supabase Dashboard or SQL).
 * - Supports user_metadata (configured when creating users in Supabase Dashboard).
 * - Supports optional ADMIN_EMAILS allowlist from environment variables.
 */
/**
 * Normalizes email addresses by trimming whitespace, lowercasing,
 * and stripping Markdown links, mailto prefixes, quotes, or bracket wrappers.
 */
function normalizeEmail(email: string): string {
  let cleaned = email.trim();
  const mdMatch = cleaned.match(/\[([^\]]+)\]\((?:mailto:)?([^\)]+)\)/);
  if (mdMatch) {
    cleaned = mdMatch[2] || mdMatch[1];
  }
  return cleaned
    .replace(/^mailto:/i, '')
    .replace(/^[\[<"']+|[\]>"']+$/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Parses and normalizes the comma-separated admin email allowlist.
 */
function parseAdminAllowlist(rawEnv?: string): string[] {
  if (!rawEnv) return [];
  return rawEnv
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter((email) => email.length > 0 && email.includes('@'));
}

/**
 * Explicitly verifies if an authenticated user is an authorized administrator.
 *
 * Security Requirements:
 * - Never treat arbitrary authenticated users as administrators.
 * - Only trust server-side claims:
 *   1. app_metadata.role / app_metadata.is_admin (cannot be altered by client SDK; set via Supabase Dashboard / SQL).
 *   2. Server-side ADMIN_EMAILS allowlist from environment variables.
 * - DO NOT trust user.user_metadata.role because users can modify user_metadata via the client SDK.
 */
export function isUserAdmin(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }

  // 1. Check app_metadata (Tamper-proof claim stored in auth.users.raw_app_meta_data)
  const appRole = user.app_metadata?.role;
  const appIsAdmin = user.app_metadata?.is_admin;
  const hasAppAdmin =
    appRole === 'admin' || appRole === 'superadmin' || appIsAdmin === true;

  if (hasAppAdmin) {
    console.log(
      `[Admin Auth] app_metadata_admin=true, allowlist_configured=${Boolean(
        process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS
      )}, email_allowlist_matched=false, result=true`
    );
    return true;
  }

  // 2. Server-side Admin Email Allowlist via environment variables (case-insensitive & normalized)
  const adminEmailsEnv =
    process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  const allowlistConfigured = Boolean(adminEmailsEnv && adminEmailsEnv.trim());
  let isEmailAllowed = false;

  if (allowlistConfigured && user.email) {
    const allowedEmails = parseAdminAllowlist(adminEmailsEnv);
    const normalizedUserEmail = normalizeEmail(user.email);
    isEmailAllowed = allowedEmails.includes(normalizedUserEmail);
  }

  // Safe diagnostic log: Reveals only whether allowlist is configured and whether email matched.
  // NEVER logs credentials, emails, tokens, or secret values.
  console.log(
    `[Admin Auth] app_metadata_admin=false, allowlist_configured=${allowlistConfigured}, email_allowlist_matched=${isEmailAllowed}, result=${isEmailAllowed}`
  );

  return isEmailAllowed;
}

/**
 * Returns a friendly display name for the authenticated user.
 */
export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return 'Admin User';
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Admin User'
  );
}

/**
 * Returns initials (e.g. "AD") for the user avatar.
 */
export function getUserInitials(user: User | null | undefined): string {
  if (!user) return 'AD';
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    'AD';
  const parts = name.trim().split(/[\s@._-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
