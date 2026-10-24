'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getUserInitials } from '@/lib/supabase/auth';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  UserCheck01Icon,
  ChartIncreaseIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  BookOpen01Icon,
  VideoReplayIcon,
  Comment01Icon,
  Layout01Icon,
  Settings01Icon,
  Logout01Icon,
  ArrowUpRight01Icon,
  ShieldCheckIcon,
  Loading03Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: IconSvgElement;
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Multi-tab logout synchronization: If user logged out in another tab, redirect to /login
      if (event === 'SIGNED_OUT') {
        router.push('/login');
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const navItems: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        {
          label: 'Dashboard',
          href: '/dashboard',
          icon: DashboardSquare01Icon,
        },
        {
          label: 'Leads & Desk',
          href: '/dashboard/leads',
          icon: UserCheck01Icon,
          badge: 'Live',
        },
      ],
    },
    {
      title: 'Financial Portfolios',
      items: [
        {
          label: 'Unlisted Shares',
          href: '/dashboard/unlisted-shares',
          icon: ChartIncreaseIcon,
          badge: 'Shares',
        },
        {
          label: 'DRHP Companies',
          href: '/dashboard/drhp-companies',
          icon: FileSpreadsheetIcon,
          badge: 'IPOs',
        },
        {
          label: 'Research Reports',
          href: '/dashboard/research-reports',
          icon: FileTextIcon,
          badge: 'Reports',
        },
      ],
    },
    {
      title: 'Content & Editorial',
      items: [
        {
          label: 'Blogs & Guides',
          href: '/dashboard/blogs',
          icon: BookOpen01Icon,
        },
        {
          label: 'Videos & Insights',
          href: '/dashboard/videos',
          icon: VideoReplayIcon,
        },
        {
          label: 'Testimonials',
          href: '/dashboard/testimonials',
          icon: Comment01Icon,
        },
      ],
    },
    {
      title: 'System & Config',
      items: [
        {
          label: 'Homepage Content',
          href: '/dashboard/homepage',
          icon: Layout01Icon,
        },
        {
          label: 'Website Settings',
          href: '/dashboard/settings',
          icon: Settings01Icon,
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
      await fetch('/auth/signout', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      }).catch(() => {});
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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-card border-r border-border transition-transform duration-200 ease-in-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand / Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border/80 bg-card">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs tracking-wider shadow-2xs group-hover:bg-primary/90 transition-colors">
              IPO
            </div>
            <div className="leading-tight">
              <span className="text-sm font-semibold tracking-tight text-foreground block">
                Unlisted CMS
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
                Research & Desk
              </span>
            </div>
          </Link>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
              aria-label="Close sidebar"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} />
            </button>
          )}
        </div>

        {/* Live Public Website Indicator */}
        <div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/60">
          <a
            href="https://unlisted-private-company.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-background hover:bg-muted/80 border border-border text-[11px] font-medium text-foreground transition-colors group shadow-2xs"
          >
            <span className="truncate">Public Portal</span>
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={14}
              className="text-muted-foreground group-hover:text-primary shrink-0 ml-1 transition-colors"
            />
          </a>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navItems.map((group) => (
            <div key={group.title} className="space-y-1">
              <h4 className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.title}
              </h4>
              <div className="space-y-0.5 mt-1">
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={cn(
                        'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <HugeiconsIcon
                          icon={item.icon}
                          size={18}
                          className={cn(
                            'shrink-0 transition-colors',
                            isActive
                              ? 'text-primary-foreground'
                              : 'text-muted-foreground group-hover:text-foreground'
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-mono font-medium',
                            isActive
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted border border-border/80 text-muted-foreground'
                          )}
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
        <div className="p-3 border-t border-border bg-card">
          <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {userInitials}
              </div>
              <div className="truncate min-w-0">
                <p
                  className="text-xs font-semibold text-foreground truncate"
                  title={userEmail}
                >
                  {userEmail}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  <HugeiconsIcon icon={ShieldCheckIcon} size={12} className="shrink-0" />
                  <span>Admin Verified</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign Out"
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50 shrink-0 ml-1"
              aria-label="Log out"
            >
              {isLoggingOut ? (
                <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin text-primary" />
              ) : (
                <HugeiconsIcon icon={Logout01Icon} size={16} />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
