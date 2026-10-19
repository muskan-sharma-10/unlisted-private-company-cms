import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  const redirectUrl = new URL('/login', request.url);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  const redirectUrl = new URL('/login', request.url);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
