'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { fetchWebsiteSettings, updateWebsiteSettings } from '@/lib/supabase/api';
import { initialSettings } from '@/lib/mock-data';
import { WebsiteSettings } from '@/types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Database01Icon,
  SecurityCheckIcon,
  ServerIcon,
  Globe02Icon,
  Key01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';

export default function SettingsPage() {
  const [settings, setSettings] = useState<WebsiteSettings>(initialSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAlert, setSavedAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check Supabase Environment Setup
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [supabaseUrlMasked, setSupabaseUrlMasked] = useState('Not configured');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWebsiteSettings();
      setSettings(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load website settings from Supabase.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (rawUrl && rawKey) {
      setSupabaseConfigured(true);
      const cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, '');
      setSupabaseUrlMasked(
        cleanUrl.replace(/https:\/\/(.{5}).*(\.supabase\.co)/, 'https://$1...$2')
      );
    } else {
      setSupabaseConfigured(false);
      setSupabaseUrlMasked('Pending setup in .env.local');
    }

    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedAlert(false);
    setErrorMessage(null);

    try {
      const updated = await updateWebsiteSettings(settings);
      setSettings(updated);
      setSavedAlert(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings to Supabase.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Website & System Settings
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure site metadata, contact channels, API bridge endpoints, and Supabase database integration.
        </p>
      </div>

      {savedAlert && (
        <Alert
          variant="success"
          title="Settings Updated"
          onClose={() => setSavedAlert(false)}
        >
          Website settings updated successfully and committed to Supabase.
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

      {/* Supabase & API Bridge Status Card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <HugeiconsIcon icon={Database01Icon} size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Supabase PostgreSQL & Auth Bridge Status
              </h3>
              <p className="text-xs text-muted-foreground">
                Connection status and security configuration diagnostics
              </p>
            </div>
          </div>

          <Badge variant={supabaseConfigured ? 'success' : 'warning'}>
            {supabaseConfigured ? 'Supabase Connected' : 'Setup Pending (Preview Mode)'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1">

          </div>

          <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <HugeiconsIcon icon={ServerIcon} size={15} className="text-emerald-600" />
              <span>API Gateway</span>
            </div>
            <p className="text-foreground font-semibold truncate">
              /api/admin/* (Protected Next.js Routes)
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <HugeiconsIcon icon={Key01Icon} size={15} className="text-amber-500" />
              <span>Supabase URL</span>
            </div>
            <p className="text-foreground font-semibold truncate font-tabular">
              {supabaseUrlMasked}
            </p>
          </div>
        </div>

        {/* Security Rule Callout */}
        <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200/60 text-xs text-emerald-950 flex items-start gap-2.5">
          <HugeiconsIcon icon={SecurityCheckIcon} size={18} className="text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-emerald-900">
              Zero Service-Role Leakage Guarantee:
            </span>
            <p className="text-emerald-800 leading-relaxed">
              The CMS client bundle only carries the anonymous public key. Every request to the main website API is authenticated via user JWT tokens verified with Supabase Row Level Security.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center rounded-xl bg-card border border-border flex flex-col items-center justify-center space-y-3 shadow-xs">
          <HugeiconsIcon icon={Loading03Icon} size={30} className="text-primary animate-spin" />
          <p className="text-sm text-foreground font-medium">Loading settings from Supabase...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Contact Info Card */}
          <Card
            title="Contact & Support Channels"
            description="Customer assistance details displayed on the footer and contact pages of the public site."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Support Email"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, supportEmail: e.target.value })
                  }
                  required
                />

                <Input
                  label="Support Phone"
                  value={settings.supportPhone}
                  onChange={(e) =>
                    setSettings({ ...settings, supportPhone: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="WhatsApp Business Number"
                  value={settings.whatsappNumber}
                  onChange={(e) =>
                    setSettings({ ...settings, whatsappNumber: e.target.value })
                  }
                  helperText="International format with country code (e.g. +91 98200 12345)"
                  required
                />

                <Input
                  label="Platform Site Title"
                  value={settings.siteTitle}
                  onChange={(e) =>
                    setSettings({ ...settings, siteTitle: e.target.value })
                  }
                  required
                />
              </div>

              <Input
                label="Registered Office Address"
                value={settings.officeAddress}
                onChange={(e) =>
                  setSettings({ ...settings, officeAddress: e.target.value })
                }
                required
              />
            </div>
          </Card>

          {/* Target API Gateway Configuration */}
          <Card
            title="Target Public Website API Routing"
            description="Designated API route endpoint that the CMS will invoke when updating production content."
          >
            <div className="space-y-4">
              <Input
                label="Main Website API Base URL"
                value={settings.apiBaseUrl}
                onChange={(e) =>
                  setSettings({ ...settings, apiBaseUrl: e.target.value })
                }
                helperText="The base URL where your public Next.js website hosts /api/admin/* endpoints."
                required
              />

              <div className="flex items-center gap-3 pt-2">
                <input
                  id="maintenanceMode"
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) =>
                    setSettings({ ...settings, maintenanceMode: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
                />
                <label
                  htmlFor="maintenanceMode"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  Enable Public Maintenance Mode (Displays temporary under-maintenance banner)
                </label>
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
              Save Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
