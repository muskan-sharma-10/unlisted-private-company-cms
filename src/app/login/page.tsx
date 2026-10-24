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
import { sanitizeRedirectUrl } from '@/lib/supabase/auth';
import { verifyAdminSessionAction } from './actions';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirect'));
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
    } else if (errorParam === 'config_error') {
      setErrorMessage(
        'Configuration Notice: The CMS authentication credentials are not configured or are invalid. Please verify your environment variables.'
      );
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
            label="Email"
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
                label="Password"
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
            Sign In
          </Button>
        </form>

      </div>


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
