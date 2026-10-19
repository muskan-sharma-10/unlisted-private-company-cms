/**
 * Supabase client and server configuration helper.
 * Provides safe normalization, sanitization, and diagnostics for Supabase environment variables.
 */

export interface SupabaseConfig {
  url: string | null;
  key: string | null;
  isValid: boolean;
  error?: string;
}

/**
 * Normalizes and validates the Supabase URL.
 * Handles common misconfigurations such as:
 * - Duplicate protocols (e.g., https://https://)
 * - Accidental pasting of Supabase Dashboard project URLs
 * - Surrounding quotes or whitespace
 * - Trailing slashes
 */
export function normalizeSupabaseUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;

  let url = rawUrl.trim().replace(/^["']|["']$/g, '').trim();

  // Strip duplicate protocol typos like "https://https://" or "http://http://"
  url = url.replace(/^(?:https?:\/\/)+/i, 'https://');

  // Detect accidental pasting of Supabase Dashboard URL:
  // e.g. "https://supabase.com/dashboard/project/yxvfciewtuvpljaoukyu/settings/general"
  const dashboardMatch = url.match(
    /supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i
  );
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Detect raw project ref without domain (e.g. "yxvfciewtuvpljaoukyu")
  if (/^[a-z0-9_-]{20}$/i.test(url)) {
    return `https://${url}.supabase.co`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url.replace(/\/+$/, '');
    }
  } catch {
    // Invalid URL format
  }

  return url.replace(/\/+$/, '');
}

/**
 * Sanitizes Supabase API key (publishable or anon key).
 * Strips whitespace and surrounding quotes.
 */
export function sanitizeSupabaseKey(rawKey?: string): string | null {
  if (!rawKey) return null;
  const key = rawKey.trim().replace(/^["']|["']$/g, '').trim();
  return key.length > 0 ? key : null;
}

/**
 * Resolves and validates Supabase credentials.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const url = normalizeSupabaseUrl(rawUrl);
  const key = sanitizeSupabaseKey(rawKey);

  if (!url || !key) {
    return {
      url,
      key,
      isValid: false,
      error:
        'Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in .env.local.',
    };
  }

  // Validate URL structure
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        url,
        key,
        isValid: false,
        error: `Invalid Supabase URL protocol: ${parsed.protocol}. Expected https://`,
      };
    }
  } catch {
    return {
      url,
      key,
      isValid: false,
      error:
        'Malformed NEXT_PUBLIC_SUPABASE_URL. Expected format: https://<project-ref>.supabase.co',
    };
  }

  return {
    url,
    key,
    isValid: true,
  };
}

/**
 * Formats authentication and connection errors into clear, actionable user messages.
 * Prevents generic, cryptic errors like "Failed to fetch" from confusing administrators.
 */
export function formatAuthError(
  err: unknown,
  supabaseUrl?: string | null
): string {
  if (!err) {
    return 'An unknown authentication error occurred.';
  }

  const rawMessage =
    typeof err === 'string'
      ? err
      : err &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : String(err);

  const lower = rawMessage.toLowerCase();

  // 1. Browser offline check
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Network Offline: You appear to be disconnected from the internet. Please reconnect and try again.';
  }

  // 2. Network / DNS / Fetch failures (e.g. "Failed to fetch")
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('fetch failed') ||
    lower.includes('load failed') ||
    lower.includes('err_connection') ||
    lower.includes('err_name_not_resolved') ||
    lower.includes('connection refused')
  ) {
    let hostHint = 'Supabase';
    if (supabaseUrl) {
      try {
        const u = new URL(supabaseUrl);
        hostHint = u.hostname;
      } catch {
        hostHint = supabaseUrl;
      }
    }

    return `Unable to connect to Supabase Auth server (${hostHint}). Please verify your internet connection, confirm that your project is active in the Supabase Dashboard, and check that NEXT_PUBLIC_SUPABASE_URL in .env.local is valid.`;
  }

  // 3. Invalid credentials
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_grant') ||
    lower.includes('invalid credentials')
  ) {
    return 'Invalid email or password. Please verify your credentials or ensure the user is registered in your Supabase Auth dashboard.';
  }

  // 4. Email not confirmed
  if (lower.includes('email not confirmed')) {
    return 'Email Not Confirmed: Please confirm your email address, or disable "Confirm email" under Supabase Dashboard -> Authentication -> Providers -> Email.';
  }

  // 5. Rate limiting
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return 'Rate Limit Exceeded: Too many sign-in attempts in a short period. Please wait a minute before trying again.';
  }

  // 6. User not found
  if (lower.includes('user not found')) {
    return 'User Not Found: No registered account was found with this email. Please invite or create the user in the Supabase Dashboard.';
  }

  // 7. Signup disabled
  if (
    lower.includes('signups not allowed') ||
    lower.includes('signup disabled')
  ) {
    return 'Public signup is disabled for this CMS. Contact an existing administrator for access.';
  }

  return rawMessage;
}

