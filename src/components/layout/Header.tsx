'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Menu01Icon,
  ArrowUpRight01Icon,
  Shield01Icon,
  DatabaseIcon,
} from '@hugeicons/core-free-icons';

interface HeaderProps {
  onOpenMobile: () => void;
}

export function Header({ onOpenMobile }: HeaderProps) {
  const pathname = usePathname();

  // Map path to human-readable title
  const getPageTitle = (path: string) => {
    if (path === '/dashboard') return 'Overview Dashboard';
    if (path.includes('unlisted-shares')) return 'Unlisted Shares Directory';
    if (path.includes('drhp-companies')) return 'DRHP Companies & IPO Filings';
    if (path.includes('leads')) return 'Leads & Applications Desk';
    if (path.includes('research-reports')) return 'Research Reports & Insights';
    if (path.includes('blogs')) return 'Blog Articles & Editorial';
    if (path.includes('videos')) return 'Video Library & Media';
    if (path.includes('testimonials')) return 'Client Testimonials';
    if (path.includes('homepage')) return 'Homepage Content & Hero Banner';
    if (path.includes('settings')) return 'CMS & Website Settings';
    return 'CMS Admin';
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-card/85 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Open menu"
        >
          <HugeiconsIcon icon={Menu01Icon} size={20} />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
            {getPageTitle(pathname)}
          </h1>
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Administrative Control Panel &middot; Target:{' '}
            <span className="font-mono text-foreground/80">unlisted-private-company.vercel.app</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Environment / Security Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-medium">
          <HugeiconsIcon icon={Shield01Icon} size={14} className="shrink-0" />
          <span>Standalone CMS</span>
        </div>

        {/* Database Status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border text-foreground text-xs font-medium">
          <HugeiconsIcon icon={DatabaseIcon} size={14} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span className="text-[11px]">Supabase Connected</span>
        </div>

        {/* Link to live public site */}
        <a
          href="https://unlisted-private-company.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-2xs"
          title="Open live public portal in new tab"
        >
          <span>Live Site</span>
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} className="text-muted-foreground" />
        </a>
      </div>
    </header>
  );
}
