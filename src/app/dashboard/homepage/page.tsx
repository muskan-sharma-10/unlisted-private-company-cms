'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { fetchHomepageContent, updateHomepageContent } from '@/lib/supabase/api';
import { initialHomepageContent } from '@/lib/mock-data';
import { HomepageSection } from '@/types';
import { Sparkles, Eye, Check, ExternalLink, Loader2 } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Homepage Content Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure the prominent hero banner, headline copy, announcement bar, and call-to-actions. Changes commit directly to Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://unlisted-private-company.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Eye className="h-4 w-4" />
            <span>View Live Site</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
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
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-300 font-medium">Loading homepage configuration from Supabase...</p>
        </div>
      ) : (
        <>
          {/* Live Preview Card */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                <span>Interactive Live Hero Preview</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Last Updated: {content.updatedAt}
              </span>
            </div>

            {/* Announcement bar preview */}
            {content.showAnnouncement && content.announcementBar && (
              <div className="py-2 px-4 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-200 text-xs text-center font-medium">
                {content.announcementBar}
              </div>
            )}

            {/* Hero headline preview */}
            <div className="text-center py-6 sm:py-10 max-w-2xl mx-auto space-y-4">
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {content.heroHeadline || 'Headline goes here'}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed max-w-xl mx-auto">
                {content.heroSubheadline || 'Subheadline description goes here...'}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm shadow-md shadow-indigo-600/30">
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
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950"
                  />
                  <label
                    htmlFor="showAnnouncement"
                    className="text-sm font-medium text-slate-200 cursor-pointer"
                  >
                    Enable announcement bar at the top of the website
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
                leftIcon={<Check className="h-4 w-4" />}
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
