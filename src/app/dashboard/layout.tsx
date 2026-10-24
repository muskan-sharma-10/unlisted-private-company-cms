import React from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { getAuthenticatedAdminSession } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard | Unlisted CMS',
  description: 'Content Management Panel for Unlisted Private Company',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isValid } = getSupabaseConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  // In production or whenever Supabase is configured, enforce authoritative server session & admin checks (Defense-in-Depth)
  if (isValid || isProduction) {
    const session = await getAuthenticatedAdminSession();

    if (!session.user) {
      redirect('/login');
    }

    if (!session.isAdmin) {
      redirect('/login?error=unauthorized');
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}

