import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isUserAdmin } from '@/lib/supabase/auth';
import { getSupabaseConfig } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, key, isValid } = getSupabaseConfig();

  // If Supabase keys are not configured or invalid, allow UI inspection during local dev
  if (!isValid || !url || !key) {
    return response;
  }

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

  // getUser securely contacts the Supabase Auth server to validate the JWT
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/login');
  const isDashboardPage = pathname.startsWith('/dashboard');

  // 1. Unauthenticated users trying to access protected /dashboard routes -> redirect to /login
  if (isDashboardPage && !user) {
    const redirectUrl = new URL('/login', request.url);
    const fullPath = pathname + request.nextUrl.search;
    redirectUrl.searchParams.set('redirect', fullPath);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated users lacking explicit admin privileges -> block and redirect to /login
  if (isDashboardPage && user && !isUserAdmin(user)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Authenticated administrators visiting /login -> redirect to /dashboard
  // Do NOT intercept Server Actions (POST requests or requests with next-action header)
  const isServerAction =
    request.method !== 'GET' || request.headers.has('next-action');

  if (isAuthPage && user && isUserAdmin(user) && !isServerAction) {
    // Only redirect if there isn't an explicit error message being displayed
    if (!request.nextUrl.searchParams.has('error')) {
      const target = request.nextUrl.searchParams.get('redirect') || '/dashboard';
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

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
