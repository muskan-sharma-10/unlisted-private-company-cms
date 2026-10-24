import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isUserAdmin, sanitizeRedirectUrl } from '@/lib/supabase/auth';
import { getSupabaseConfig } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, key, isValid } = getSupabaseConfig();
  const isProduction = process.env.NODE_ENV === 'production';
  const pathname = request.nextUrl.pathname;

  // 1. Configuration Validation:
  // In production, fail-closed to prevent exposing private routes if credentials are missing
  if (!isValid || !url || !key) {
    if (isProduction && !pathname.startsWith('/login')) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('error', 'config_error');
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // 2. Initialize Supabase SSR Client with Next.js Cookie Synchronization
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // 3. Authoritatively fetch authenticated user with exception-safe recovery
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch (err) {
    console.error('[Middleware Auth Error] Supabase getUser failed:', err);
  }

  const isAuthPage = pathname.startsWith('/login');
  const isSignoutRoute = pathname.startsWith('/auth/signout');
  const isRootPage = pathname === '/';

  // 4. Root Route Optimization: Prevent double-redirect hop
  if (isRootPage) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 5. Public / Allowed Routes:
  // /auth/signout is an active session termination handler
  if (isSignoutRoute) {
    return response;
  }

  // 6. Guest-Only Route (/login):
  // Authenticated administrators visiting /login -> redirect to sanitized target or /dashboard
  // Never intercept Server Actions (POST requests or requests with next-action header)
  const isServerAction =
    request.method !== 'GET' || request.headers.has('next-action');

  if (isAuthPage) {
    if (user && isUserAdmin(user) && !isServerAction) {
      // Only redirect if there isn't an explicit error message being displayed
      if (!request.nextUrl.searchParams.has('error')) {
        const rawTarget = request.nextUrl.searchParams.get('redirect');
        const sanitizedTarget = sanitizeRedirectUrl(rawTarget, '/dashboard');
        return NextResponse.redirect(new URL(sanitizedTarget, request.url));
      }
    }
    return response;
  }

  // 7. Protected Routes (e.g. /dashboard, /dashboard/*, or any other private route):
  // Unauthenticated users trying to access protected routes -> redirect to /login with sanitized return URL
  if (!user) {
    const redirectUrl = new URL('/login', request.url);
    const fullPath = sanitizeRedirectUrl(
      pathname + request.nextUrl.search,
      '/dashboard'
    );
    redirectUrl.searchParams.set('redirect', fullPath);
    return NextResponse.redirect(redirectUrl);
  }

  // 8. Authenticated Users:
  // Pass to Next.js pipeline where DashboardLayout (Server Component) executes
  // authoritative three-tier authorization (app_metadata, allowlist, admin_users table)
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

