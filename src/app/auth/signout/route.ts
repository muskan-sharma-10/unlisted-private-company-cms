import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.error('[Signout Error] Server signout failed:', err);
  }

  const wantsJson =
    request.headers.get('accept')?.includes('application/json') ||
    request.headers.get('content-type')?.includes('application/json');

  if (wantsJson) {
    return NextResponse.json({
      success: true,
      message: 'Signed out successfully',
    });
  }

  const redirectUrl = new URL('/login', request.url);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.error('[Signout Error] Server signout failed:', err);
  }

  const redirectUrl = new URL('/login', request.url);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

