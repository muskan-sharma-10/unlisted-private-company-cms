'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ChartIncreaseIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  BookOpen01Icon,
  VideoReplayIcon,
  Comment01Icon,
  Layout01Icon,
  PlusSignIcon,
  ArrowUpRight01Icon,
  ShieldCheckIcon,
  SparklesIcon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
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
    <div className="space-y-6">
      {/* Welcome Banner - Restrained Financial Presentation */}
      <div className="relative overflow-hidden rounded-xl bg-card border border-border p-6 sm:p-7 shadow-2xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <HugeiconsIcon icon={SparklesIcon} size={14} />
              <span>Financial Content Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Overview &amp; Executive Summary
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Real-time administration for unlisted equity records, DRHP IPO filings, equity research notes, and live homepage content for{' '}
              <a
                href="https://www.unlistedpond.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline inline-flex items-center gap-0.5"
              >
                <span>unlisted-private-company.vercel.app</span>
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
              </a>
              . All records persist to Supabase PostgreSQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link href="/dashboard/unlisted-shares">
              <Button
                variant="primary"
                leftIcon={<HugeiconsIcon icon={PlusSignIcon} size={16} />}
              >
                Add Unlisted Share
              </Button>
            </Link>
            <Link href="/dashboard/drhp-companies">
              <Button
                variant="secondary"
                leftIcon={<HugeiconsIcon icon={FileSpreadsheetIcon} size={16} />}
              >
                Add DRHP Filing
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid - 6 Financial Modules */}
      {isLoading ? (
        <div className="p-8 text-center rounded-xl bg-card border border-border flex items-center justify-center space-x-2.5 text-muted-foreground shadow-2xs">
          <HugeiconsIcon icon={Loading03Icon} size={20} className="text-primary animate-spin" />
          <span className="text-sm font-medium">Loading database metrics...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <StatCard
            title="Unlisted Shares"
            value={metrics.shares.total}
            subtext={`${metrics.shares.published} Live • ${metrics.shares.draft} Draft`}
            icon={<HugeiconsIcon icon={ChartIncreaseIcon} size={20} />}
          />
          <StatCard
            title="DRHP Filings"
            value={metrics.drhp.total}
            subtext={`${metrics.drhp.published} Active • ${metrics.drhp.draft} Pending`}
            icon={<HugeiconsIcon icon={FileSpreadsheetIcon} size={20} />}
          />
          <StatCard
            title="Research Reports"
            value={metrics.reports.total}
            subtext={`${metrics.reports.published} Live • ${metrics.reports.draft} Draft`}
            icon={<HugeiconsIcon icon={FileTextIcon} size={20} />}
          />
          <StatCard
            title="Research Blogs"
            value={metrics.blogs.total}
            subtext={`${metrics.blogs.published} Live • ${metrics.blogs.draft} Draft`}
            icon={<HugeiconsIcon icon={BookOpen01Icon} size={20} />}
          />
          <StatCard
            title="Video Insights"
            value={metrics.videos.total}
            subtext={`${metrics.videos.published} Live • ${metrics.videos.draft} Draft`}
            icon={<HugeiconsIcon icon={VideoReplayIcon} size={20} />}
          />
          <StatCard
            title="Client Reviews"
            value={metrics.testimonials.total}
            subtext={`${metrics.testimonials.published} Live • ${metrics.testimonials.draft} Draft`}
            icon={<HugeiconsIcon icon={Comment01Icon} size={20} />}
          />
        </div>
      )}

      {/* Two Column Layout: Recent Content & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Unlisted Shares Activity (2 Columns) */}
        <div className="lg:col-span-2">
          <Card
            title="Latest Unlisted Shares"
            description="Recently updated equity stocks from Supabase database"
            headerAction={
              <Link
                href="/dashboard/unlisted-shares"
                className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-1"
              >
                <span>View Full Directory</span>
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} />
              </Link>
            }
          >
            {isLoading ? (
              <div className="p-8 text-center">
                <HugeiconsIcon icon={Loading03Icon} size={22} className="text-primary animate-spin mx-auto" />
              </div>
            ) : recentShares.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No unlisted shares found in database. Click &ldquo;Add Unlisted Share&rdquo; above to create one.
              </div>
            ) : (
              <div className="divide-y divide-border/60 -mx-6 -my-2">
                {recentShares.map((share) => (
                  <div
                    key={share.id}
                    className="px-6 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary font-mono">
                        {share.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {share.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {share.sector} &bull; Lot Size: <span className="font-tabular font-medium text-foreground">{share.lotSize}</span> shares
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground font-tabular">
                          ₹{share.currentPrice.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">per share</p>
                      </div>
                      <StatusBadge status={share.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick Launch & System Status (1 Column) */}
        <div className="space-y-6">
          <Card
            title="Management Shortcuts"
            description="Quick access to active editorial workflows"
          >
            <div className="space-y-2">
              <Link
                href="/dashboard/drhp-companies"
                className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-xs font-medium text-foreground group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon icon={FileSpreadsheetIcon} size={16} className="text-emerald-700 dark:text-emerald-400" />
                  <span>Track DRHP IPO Filing</span>
                </div>
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>

              <Link
                href="/dashboard/leads"
                className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-xs font-medium text-foreground group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon icon={ChartIncreaseIcon} size={16} className="text-primary" />
                  <span>Review Inbound Investor Leads</span>
                </div>
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>

              <Link
                href="/dashboard/testimonials"
                className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-xs font-medium text-foreground group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon icon={Comment01Icon} size={16} className="text-amber-700 dark:text-amber-400" />
                  <span>Manage Investor Reviews</span>
                </div>
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>

              <Link
                href="/dashboard/homepage"
                className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-xs font-medium text-foreground group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon icon={Layout01Icon} size={16} className="text-blue-700 dark:text-blue-400" />
                  <span>Hero Headline &amp; Announcement</span>
                </div>
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            </div>
          </Card>

          {/* Architecture Status Card */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <HugeiconsIcon icon={ShieldCheckIcon} size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">
                Production Database Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mutations and status toggles execute securely against Supabase PostgreSQL using strict Row Level Security (RLS).
            </p>
            <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border">
              <span>Security Policy</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">Verified Admin</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
