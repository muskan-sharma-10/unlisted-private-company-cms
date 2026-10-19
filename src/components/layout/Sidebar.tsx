'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getUserInitials } from '@/lib/supabase/auth';
import {
  LayoutDashboard,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  BookOpen,
  Video,
  MessageSquareQuote,
  LayoutTemplate,
  Settings,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Loader2,
  X,
  UserCheck,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    // Fetch initial user
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
      }
    });

    // Listen to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const navItems: NavGroup[] = [
    {
      title: 'Core',
      items: [
        {
          label: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          label: 'Leads & Desk',
          href: '/dashboard/leads',
          icon: UserCheck,
          badge: 'Live',
        },
      ],
    },
    {
      title: 'Financial Content',
      items: [
        {
          label: 'Unlisted Shares',
          href: '/dashboard/unlisted-shares',
          icon: TrendingUp,
          badge: 'Shares',
        },
        {
          label: 'DRHP Companies',
          href: '/dashboard/drhp-companies',
          icon: FileSpreadsheet,
          badge: 'IPOs',
        },
        {
          label: 'Research Reports',
          href: '/dashboard/research-reports',
          icon: FileText,
          badge: 'Reports',
        },
      ],
    },
    {
      title: 'Editorial & Media',
      items: [
        {
          label: 'Blogs & Guides',
          href: '/dashboard/blogs',
          icon: BookOpen,
        },
        {
          label: 'Videos & Insights',
          href: '/dashboard/videos',
          icon: Video,
        },
        {
          label: 'Testimonials',
          href: '/dashboard/testimonials',
          icon: MessageSquareQuote,
        },
      ],
    },
    {
      title: 'Site Configuration',
      items: [
        {
          label: 'Homepage Content',
          href: '/dashboard/homepage',
          icon: LayoutTemplate,
        },
        {
          label: 'Website Settings',
          href: '/dashboard/settings',
          icon: Settings,
        },
      ],
    },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      // Also invoke server signout endpoint to guarantee cookie synchronization
      await fetch('/auth/signout', { method: 'POST' }).catch(() => {});
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.push('/login');
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  const userEmail = user?.email || 'admin@unlisted-cms.local';
  const userInitials = getUserInitials(user);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-slate-950 border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80 bg-slate-950">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20">
              UC
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white block">
                Unlisted CMS
              </span>
              <span className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider block">
                Admin Control
              </span>
            </div>
          </Link>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Live Public Website Indicator */}
        <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-800/50">
          <a
            href="https://unlisted-private-company.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-[11px] font-medium text-slate-300 hover:text-white transition-colors group"
          >
            <span className="truncate">Public Live Website</span>
            <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-indigo-400 shrink-0 ml-1" />
          </a>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navItems.map((group) => (
            <div key={group.title} className="space-y-1">
              <h4 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </h4>
              <div className="space-y-0.5 mt-1.5">
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            isActive
                              ? 'bg-indigo-700/80 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Session Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80">
          <div className="flex items-center justify-between px-2 py-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                {userInitials}
              </div>
              <div className="truncate">
                <p
                  className="text-xs font-semibold text-slate-200 truncate"
                  title={userEmail}
                >
                  {userEmail}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Admin Verified</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Log out"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
