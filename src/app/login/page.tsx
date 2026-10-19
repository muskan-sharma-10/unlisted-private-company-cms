'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/25 mb-1">
          UC
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Unlisted CMS Admin
        </h1>
        <p className="text-xs text-slate-400">
          Secure admin authentication & content management portal
        </p>
      </div>

      {/* Security notice: Invite-Only & No Public Signup */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
        <ShieldAlert className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block font-medium">
            Invite-Only Administrator Access
          </strong>
          <span className="text-slate-400">
            Public signups are strictly disabled. Only administrators created in
            Supabase Auth with verified admin privileges can access this panel.
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/40 backdrop-blur-sm space-y-5">
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
            leftIcon={<Mail className="h-4 w-4" />}
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
                leftIcon={<Lock className="h-4 w-4" />}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-200 focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
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
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Sign In to Dashboard
          </Button>
        </form>

        {/* Collapsible Supabase Admin User Guide */}
        <div className="pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowHelpGuide(!showHelpGuide)}
            className="w-full flex items-center justify-between text-xs text-indigo-400 hover:text-indigo-300 font-medium py-1 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              How to create your first admin in Supabase
            </span>
            {showHelpGuide ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showHelpGuide && (
            <div className="mt-2.5 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-300 space-y-2 leading-relaxed">
              <p className="font-semibold text-slate-200">
                Quick Setup Steps:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>
                  Open your <strong className="text-slate-300">Supabase Dashboard</strong> &rarr; <strong className="text-slate-300">Authentication</strong> &rarr; <strong className="text-slate-300">Users</strong>.
                </li>
                <li>
                  Click <strong className="text-slate-300">Add user</strong> &rarr; <strong className="text-slate-300">Create user</strong> with your email & password.
                </li>
                <li>
                  Add your email to{' '}
                  <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded font-mono">
                    ADMIN_EMAILS
                  </code>{' '}
                  in <code className="text-slate-300">.env.local</code>.
                </li>
                <li>
                  Or set <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded font-mono">{`{"role": "admin"}`}</code> in <strong className="text-slate-300">app_metadata</strong> via the Supabase SQL Editor.
                </li>
              </ol>
              <div className="flex items-center gap-1.5 text-emerald-400 pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Non-admin accounts are automatically blocked.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Target site footer */}
      <p className="text-center text-xs text-slate-400">
        Connected Website:{' '}
        <a
          href="https://unlisted-private-company.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-300 underline hover:text-white"
        >
          unlisted-private-company.vercel.app
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400">
            Loading authentication portal...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
