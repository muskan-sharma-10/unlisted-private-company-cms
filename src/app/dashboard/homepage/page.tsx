'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { fetchHomepageContent, updateHomepageContent } from '@/lib/supabase/api';
import { initialHomepageContent } from '@/lib/mock-data';
import { HomepageSection } from '@/types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  SparklesIcon,
  ViewIcon,
  CheckmarkCircle02Icon,
  ArrowUpRight01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';

export default function HomepageContentPage() {
  const [content, setContent] = useState<HomepageSection>(initialHomepageContent);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAlert, setSavedAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHomepageContent();
      setContent(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load homepage content from Supabase.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedAlert(false);
    setErrorMessage(null);

    try {
      const updated = await updateHomepageContent(content);
      setContent(updated);
      setSavedAlert(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save homepage content to Supabase.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Homepage Content Management
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Configure the prominent hero banner, headline copy, announcement bar, and investor call-to-actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://www.unlistedpond.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/80 hover:border-slate-300 shadow-xs transition-colors"
          >
            <HugeiconsIcon icon={ViewIcon} size={15} className="text-muted-foreground" />
            <span>View Live Site</span>
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} className="text-muted-foreground" />
          </a>
        </div>
      </div>

      {savedAlert && (
        <Alert
          variant="success"
          title="Changes Saved"
          onClose={() => setSavedAlert(false)}
        >
          Homepage copy successfully updated and saved to Supabase.
        </Alert>
      )}

      {errorMessage && (
        <Alert
          variant="error"
          title="Database Error"
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </Alert>
      )}

      {isLoading ? (
        <div className="p-12 text-center rounded-xl bg-card border border-border flex flex-col items-center justify-center space-y-3 shadow-xs">
          <HugeiconsIcon icon={Loading03Icon} size={30} className="text-primary animate-spin" />
          <p className="text-sm text-foreground font-medium">Loading homepage configuration from Supabase...</p>
        </div>
      ) : (
        <>
          {/* Live Preview Card */}
          <div className="rounded-xl border border-primary/20 bg-linear-to-b from-blue-50/40 via-card to-card p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                <HugeiconsIcon icon={SparklesIcon} size={16} />
                <span>Interactive Live Hero Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={content.status === 'published' ? 'success' : 'neutral'}>
                  {content.status === 'published' ? 'Live on Portal' : 'Draft Mode'}
                </Badge>
                <span className="text-[11px] text-muted-foreground font-tabular">
                  Last Updated: {content.updatedAt}
                </span>
              </div>
            </div>

            {/* Announcement bar preview */}
            {content.showAnnouncement && content.announcementBar && (
              <div className="py-2.5 px-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs text-center font-medium shadow-xs">
                {content.announcementBar}
              </div>
            )}

            {/* Hero headline preview */}
            <div className="text-center py-6 sm:py-10 max-w-2xl mx-auto space-y-4">
              <h1 className="text-2xl sm:text-3.5xl font-extrabold text-foreground tracking-tight leading-tight">
                {content.heroHeadline || 'Headline goes here'}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
                {content.heroSubheadline || 'Subheadline description goes here...'}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:bg-primary/95 transition-all">
                  {content.ctaText || 'Get Started'} &rarr;
                </span>
              </div>
            </div>
          </div>

          {/* Editor Form */}
          <form onSubmit={handleSave} className="space-y-6">
            <Card
              title="Announcement Top Bar"
              description="Broadcast high-priority ticker alerts and new share allocations across all public pages."
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    id="showAnnouncement"
                    type="checkbox"
                    checked={content.showAnnouncement}
                    onChange={(e) =>
                      setContent({ ...content, showAnnouncement: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
                  />
                  <label
                    htmlFor="showAnnouncement"
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    Enable announcement ticker bar at the top of the website
                  </label>
                </div>

                <Input
                  label="Announcement Message"
                  placeholder="e.g. 🔥 New Pre-IPO Allocation Open: Reliance Retail & NSE Shares available."
                  value={content.announcementBar}
                  onChange={(e) =>
                    setContent({ ...content, announcementBar: e.target.value })
                  }
                  helperText="Keep this concise and engaging for top banner display."
                />
              </div>
            </Card>

            <Card
              title="Primary Hero Section"
              description="Manage high-converting headlines and sub-headlines for first-time visitors."
            >
              <div className="space-y-4">
                <Input
                  label="Main Hero Headline (H1)"
                  value={content.heroHeadline}
                  onChange={(e) =>
                    setContent({ ...content, heroHeadline: e.target.value })
                  }
                  required
                />

                <Textarea
                  label="Hero Subheadline"
                  rows={3}
                  value={content.heroSubheadline}
                  onChange={(e) =>
                    setContent({ ...content, heroSubheadline: e.target.value })
                  }
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Call to Action (CTA) Button Text"
                    value={content.ctaText}
                    onChange={(e) =>
                      setContent({ ...content, ctaText: e.target.value })
                    }
                    required
                  />

                  <Input
                    label="CTA Link Destination"
                    value={content.ctaLink}
                    onChange={(e) =>
                      setContent({ ...content, ctaLink: e.target.value })
                    }
                    helperText="Internal route (e.g. /unlisted-shares) or external URL"
                    required
                  />
                </div>

                <div className="pt-2">
                  <Select
                    label="Publishing Status"
                    value={content.status}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        status: e.target.value as 'draft' | 'published',
                      })
                    }
                    options={[
                      { label: 'Published (Live on public website)', value: 'published' },
                      { label: 'Draft (Internal review only)', value: 'draft' },
                    ]}
                  />
                </div>
              </div>
            </Card>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSaving}
                leftIcon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />}
              >
                Save Homepage Copy
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
