'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  SquareLock01Icon,
  Mail01Icon,
  Alert02Icon,
  ArrowRight01Icon,
  ViewIcon,
  ViewOffSlashIcon,
  SecurityCheckIcon,
  HelpCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseConfig, formatAuthError } from '@/lib/supabase/config';
import { verifyAdminSessionAction } from './actions';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  useEffect(() => {
    if (errorParam === 'unauthorized') {
      setErrorMessage(
        'Access Denied: Your account does not have administrator privileges to access this CMS. Ensure role="admin" is assigned in Supabase.'
      );
    } else if (errorParam === 'session_expired') {
      setErrorMessage('Your session has expired. Please log in again.');
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const config = getSupabaseConfig();

    try {
      if (!config.isValid) {
        setErrorMessage(
          config.error ||
            'Supabase credentials are not configured. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env.local file.'
        );
        setIsLoading(false);
        return;
      }

      const supabase = createClient();

      if (!supabase) {
        setErrorMessage(
          'Supabase client failed to initialize. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env.local file.'
        );
        setIsLoading(false);
        return;
      }

      // 1. Authenticate with Supabase Auth (Email + Password)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(formatAuthError(error, config.url));
        setIsLoading(false);
        return;
      }

      // 2. Explicit Admin Authorization Check (Verified on Server)
      // Requirement: Check role="admin" in app_metadata or server-side ADMIN_EMAILS allowlist
      const adminVerification = await verifyAdminSessionAction(
        data.session?.access_token
      );

      // Safe check: Defend against undefined or malformed responses
      const isAuthorized = Boolean(adminVerification?.isAdmin);

      if (!isAuthorized) {
        // Immediately invalidate session and sign out unprivileged user
        await supabase.auth.signOut();
        setErrorMessage(
          adminVerification?.error ||
            'Access Denied: Your account is authenticated, but does not have administrator privileges. Only users with role="admin" in app_metadata or listed in ADMIN_EMAILS can access the CMS.'
        );
        setIsLoading(false);
        return;
      }

      // 3. Authorized Admin: Proceed to Dashboard
      setSuccessMessage('Authentication successful! Loading CMS dashboard...');
      setTimeout(() => {
        router.push(redirectUrl);
        router.refresh();
      }, 500);
    } catch (err: unknown) {
      setErrorMessage(formatAuthError(err, config.url));
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md relative z-10 space-y-6">
      {/* Brand header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 rounded-xl bg-primary items-center justify-center text-primary-foreground font-black text-xl shadow-md shadow-primary/25 mb-1 tracking-tight">
          UC
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Unlisted CMS Admin
        </h1>
        <p className="text-xs text-muted-foreground">
          Institutional access & capital markets content management
        </p>
      </div>

      {/* Security notice: Invite-Only & No Public Signup */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-start gap-3 text-xs text-blue-950">
        <HugeiconsIcon icon={Alert02Icon} size={16} className="text-primary shrink-0 mt-0.5" />
        <div>
          <strong className="text-blue-950 block font-semibold">
            Invite-Only Administrator Access
          </strong>
          <span className="text-blue-800 leading-relaxed">
            Public signups are strictly disabled. Only administrators created in
            Supabase Auth with verified admin privileges can access this panel.
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-5">
        {errorMessage && (
          <Alert variant="error" title="Authentication Notice">
            {errorMessage}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" title="Success">
            {successMessage}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Admin Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@yourcompany.com"
            leftIcon={<HugeiconsIcon icon={Mail01Icon} size={16} />}
            required
            disabled={isLoading}
            autoComplete="email"
          />

          <div className="space-y-1">
            <div className="relative">
              <Input
                label="Admin Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                leftIcon={<HugeiconsIcon icon={SquareLock01Icon} size={16} />}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <HugeiconsIcon icon={ViewOffSlashIcon} size={16} />
                ) : (
                  <HugeiconsIcon icon={ViewIcon} size={16} />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={isLoading}
            rightIcon={<HugeiconsIcon icon={ArrowRight01Icon} size={16} />}
          >
            Sign In to Dashboard
          </Button>
        </form>

        {/* Collapsible Supabase Admin User Guide */}
        <div className="pt-3 border-t border-border">
          <button
            type="button"
            onClick={() => setShowHelpGuide(!showHelpGuide)}
            className="w-full flex items-center justify-between text-xs text-primary hover:text-primary/80 font-medium py-1 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <HugeiconsIcon icon={HelpCircleIcon} size={15} />
              How to configure your admin account in Supabase
            </span>
            {showHelpGuide ? (
              <HugeiconsIcon icon={ArrowUp01Icon} size={15} />
            ) : (
              <HugeiconsIcon icon={ArrowDown01Icon} size={15} />
            )}
          </button>

          {showHelpGuide && (
            <div className="mt-2.5 p-3.5 rounded-lg bg-muted/40 border border-border text-[11px] text-foreground space-y-2 leading-relaxed">
              <p className="font-semibold text-foreground">
                Quick Setup Steps:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  Open your <strong className="text-foreground">Supabase Dashboard</strong> &rarr; <strong className="text-foreground">Authentication</strong> &rarr; <strong className="text-foreground">Users</strong>.
                </li>
                <li>
                  Click <strong className="text-foreground">Add user</strong> &rarr; <strong className="text-foreground">Create user</strong> with your email & password.
                </li>
                <li>
                  Add your email to{' '}
                  <code className="text-primary bg-primary/10 px-1 py-0.5 rounded font-mono font-medium">
                    ADMIN_EMAILS
                  </code>{' '}
                  in <code className="text-foreground font-semibold">.env.local</code>.
                </li>
                <li>
                  Or set <code className="text-primary bg-primary/10 px-1 py-0.5 rounded font-mono font-medium">{`{"role": "admin"}`}</code> in <strong className="text-foreground">app_metadata</strong> via the Supabase SQL Editor.
                </li>
              </ol>
              <div className="flex items-center gap-1.5 text-emerald-700 pt-1 font-medium">
                <HugeiconsIcon icon={SecurityCheckIcon} size={14} />
                <span>Non-admin accounts are automatically blocked.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Target site footer */}
      <p className="text-center text-xs text-muted-foreground">
        Connected Website:{' '}
        <a
          href="https://unlisted-private-company.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
        >
          unlisted-private-company.vercel.app
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-foreground flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle modern financial gradient backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-slate-200/40 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 bg-card border border-border rounded-xl text-center text-muted-foreground shadow-xs">
            Loading authentication portal...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
