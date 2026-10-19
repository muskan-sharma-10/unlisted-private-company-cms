import React from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/supabase/auth';

export const metadata = {
  title: 'Dashboard | Unlisted CMS',
  description: 'Content Management Panel for Unlisted Private Company',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  // If Supabase is configured, enforce server-side session and admin validation (Defense-in-Depth)
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect('/login');
    }

    let isAdmin = isUserAdmin(user);
    if (!isAdmin) {
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
      }
    }

    if (!isAdmin) {
      redirect('/login?error=unauthorized');
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}
