'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  FileSpreadsheet,
  FileText,
  BookOpen,
  Video,
  MessageSquareQuote,
  LayoutTemplate,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { StatCard, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import {
  fetchDashboardMetrics,
  fetchUnlistedShares,
  DashboardMetrics,
} from '@/lib/supabase/api';
import { UnlistedShare } from '@/types';

export default function DashboardOverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    shares: { published: 0, draft: 0, total: 0 },
    drhp: { published: 0, draft: 0, total: 0 },
    reports: { published: 0, draft: 0, total: 0 },
    blogs: { published: 0, draft: 0, total: 0 },
    videos: { published: 0, draft: 0, total: 0 },
    testimonials: { published: 0, draft: 0, total: 0 },
  });
  const [recentShares, setRecentShares] = useState<UnlistedShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      try {
        const [metricData, sharesData] = await Promise.all([
          fetchDashboardMetrics(),
          fetchUnlistedShares(),
        ]);
        setMetrics(metricData);
        setRecentShares(sharesData.slice(0, 4));
      } catch (err) {
        console.error('[Dashboard Error] Failed to fetch metrics:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>CMS Administration Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back to your Content Hub
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Manage unlisted shares, upcoming DRHP IPO filings, research articles, video insights, and public homepage content for{' '}
              <a
                href="https://unlisted-private-company.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 underline hover:text-indigo-300"
              >
                unlisted-private-company.vercel.app
              </a>
              . All records persist to Supabase.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link href="/dashboard/unlisted-shares">
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                Add Unlisted Share
              </Button>
            </Link>
            <Link href="/dashboard/research-reports">
              <Button variant="secondary" leftIcon={<FileText className="h-4 w-4" />}>
                Add Research Note
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid - 6 Core Content Modules */}
      {isLoading ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center space-x-3">
          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
          <span className="text-sm text-slate-400">Loading Supabase metrics...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            title="Unlisted Shares"
            value={metrics.shares.total}
            subtext={`${metrics.shares.published} Published • ${metrics.shares.draft} Drafts`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="DRHP Filings"
            value={metrics.drhp.total}
            subtext={`${metrics.drhp.published} Active • ${metrics.drhp.draft} Pending`}
            icon={<FileSpreadsheet className="h-5 w-5" />}
          />
          <StatCard
            title="Research Reports"
            value={metrics.reports.total}
            subtext={`${metrics.reports.published} Published • ${metrics.reports.draft} Drafts`}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            title="Research Blogs"
            value={metrics.blogs.total}
            subtext={`${metrics.blogs.published} Published • ${metrics.blogs.draft} Drafts`}
            icon={<BookOpen className="h-5 w-5" />}
          />
          <StatCard
            title="Video Guides"
            value={metrics.videos.total}
            subtext={`${metrics.videos.published} Published • ${metrics.videos.draft} Drafts`}
            icon={<Video className="h-5 w-5" />}
          />
          <StatCard
            title="Testimonials"
            value={metrics.testimonials.total}
            subtext={`${metrics.testimonials.published} Published • ${metrics.testimonials.draft} Drafts`}
            icon={<MessageSquareQuote className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Two Column Layout: Recent Content & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Unlisted Shares Activity (2 Columns) */}
        <div className="lg:col-span-2">
          <Card
            title="Latest Unlisted Shares"
            description="Recently updated equity stocks from Supabase"
            headerAction={
              <Link
                href="/dashboard/unlisted-shares"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin mx-auto" />
              </div>
            ) : recentShares.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No unlisted shares found in database. Click &ldquo;Add Unlisted Share&rdquo; above to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 -mx-6 -my-2">
                {recentShares.map((share) => (
                  <div
                    key={share.id}
                    className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-indigo-400">
                        {share.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {share.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {share.sector} &bull; Lot: {share.lotSize} shares
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-100">
                          ₹{share.currentPrice.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[11px] text-slate-400">per share</p>
                      </div>
                      <StatusBadge status={share.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick Launch & Architecture Guard (1 Column) */}
        <div className="space-y-6">
          <Card
            title="Management Shortcuts"
            description="Frequently accessed administrative workflows"
          >
            <div className="space-y-2.5">
              <Link
                href="/dashboard/drhp-companies"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900 transition-all text-xs font-medium text-slate-200 group"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <span>Track New DRHP IPO Filing</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/dashboard/videos"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900 transition-all text-xs font-medium text-slate-200 group"
              >
                <div className="flex items-center gap-2.5">
                  <Video className="h-4 w-4 text-rose-400" />
                  <span>Publish Video Insight</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/dashboard/testimonials"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900 transition-all text-xs font-medium text-slate-200 group"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquareQuote className="h-4 w-4 text-amber-400" />
                  <span>Manage Investor Reviews</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/dashboard/homepage"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900 transition-all text-xs font-medium text-slate-200 group"
              >
                <div className="flex items-center gap-2.5">
                  <LayoutTemplate className="h-4 w-4 text-indigo-400" />
                  <span>Hero Headline & Announcement</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-colors" />
              </Link>
            </div>
          </Card>

          {/* Architecture Status Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-950 border border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Production Database Connected
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Mutations and status toggles execute securely against Supabase PostgreSQL using Row Level Security.
            </p>
            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80">
              <span>Environment</span>
              <span className="font-mono text-emerald-400 font-medium">Supabase Auth & RLS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
