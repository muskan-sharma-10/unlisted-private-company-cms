'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Menu, ExternalLink, Shield, Database } from 'lucide-react';

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
    if (path.includes('blogs')) return 'Blog Articles & Editorial';
    if (path.includes('videos')) return 'Video Library & Media';
    if (path.includes('testimonials')) return 'Client Testimonials';
    if (path.includes('homepage')) return 'Homepage Content & Hero Banner';
    if (path.includes('settings')) return 'CMS & Website Settings';
    return 'CMS Admin';
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 focus:outline-none"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {getPageTitle(pathname)}
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Management Panel &middot; Target: <span className="text-slate-300">unlisted-private-company.vercel.app</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Environment / Security Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
          <Shield className="h-3.5 w-3.5 text-indigo-400" />
          <span>Standalone CMS</span>
        </div>

        {/* Database Status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs">
          <Database className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[11px]">Supabase Ready</span>
        </div>

        {/* Link to live public site */}
        <a
          href="https://unlisted-private-company.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
          title="Open live public website in new tab"
        >
          <span>Live Site</span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </a>
      </div>
    </header>
  );
}
