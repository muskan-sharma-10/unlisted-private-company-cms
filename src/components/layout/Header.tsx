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
            Administrative Control Panel
          </p>
        </div>
      </div>


    </header>
  );
}
