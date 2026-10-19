-- ==============================================================================
-- Supabase Database Migration: Initial Baseline Content Schema
-- Version: 20261016_initial_content_schema
-- Purpose:
--   Creates the original baseline tables, constraints, RLS policies, and triggers
--   as documented in README.md and required by the Unlisted CMS application.
--
-- TARGET TABLES CREATED:
--   1. public.unlisted_shares   (baseline without slug, category, change metrics)
--   2. public.drhp_companies    (baseline with filing_date DATE NOT NULL)
--   3. public.blogs             (editorial articles & pre-IPO guides)
--   4. public.videos            (embedded video insights)
--   5. public.testimonials      (investor reviews & quotes)
--   6. public.homepage_content  (hero section & announcement bar)
--   7. public.admin_users       (CMS administrator authorization allowlist)
--   8. public.website_settings  (global platform configuration & contact details)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. FOUNDATIONAL EXTENSIONS & TRIGGER FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Hardened admin authorization function:
-- - Strict search_path preventing schema hijacking
-- - Safe JSON extraction avoiding runtime crash on non-boolean claims
-- - Requires authenticated user (auth.uid() IS NOT NULL)
-- - Safely checks both JWT claims and public.admin_users allowlist
-- - Grants restricted to authenticated and service_role ONLY (revoked from PUBLIC & anon)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_jwt jsonb;
  v_app_meta jsonb;
  v_role text;
  v_uid uuid;
  v_email text;
BEGIN
  -- 1. Must have an authenticated UID
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  v_jwt := auth.jwt();
  IF v_jwt IS NULL THEN
    RETURN false;
  END IF;

  v_app_meta := v_jwt -> 'app_metadata';
  IF v_app_meta IS NOT NULL AND jsonb_typeof(v_app_meta) = 'object' THEN
    -- 2. Verify role claim in app_metadata
    v_role := v_app_meta ->> 'role';
    IF v_role IN ('admin', 'superadmin') THEN
      RETURN true;
    END IF;

    -- 3. Safely verify is_admin claim without runtime cast exceptions
    IF (v_app_meta -> 'is_admin') = 'true'::jsonb
       OR v_app_meta ->> 'is_admin' IN ('true', 't', '1', 'TRUE') THEN
      RETURN true;
    END IF;
  END IF;

  -- 4. Check admin_users table if present
  -- Accounts for admin_users.user_id being nullable and email being TEXT NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    v_email := lower(trim(coalesce(v_jwt ->> 'email', '')));
    IF EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE (user_id IS NOT NULL AND user_id = v_uid)
         OR (v_email <> '' AND email IS NOT NULL AND lower(trim(email)) = v_email)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 1. BASELINE TABLE: public.unlisted_shares
-- ------------------------------------------------------------------------------

CREATE TABLE public.unlisted_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  current_price NUMERIC(12, 2) NOT NULL,
  lot_size INTEGER NOT NULL DEFAULT 50,
  pe_ratio NUMERIC(6, 2),
  market_cap_cr NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_unlisted_shares_updated_at
BEFORE UPDATE ON public.unlisted_shares
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. BASELINE TABLE: public.drhp_companies
-- ------------------------------------------------------------------------------

CREATE TABLE public.drhp_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  issue_size_cr NUMERIC(12, 2) NOT NULL,
  filing_date DATE NOT NULL,
  expected_date DATE,
  lead_managers TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_drhp_companies_updated_at
BEFORE UPDATE ON public.drhp_companies
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. BASELINE TABLE: public.blogs
-- ------------------------------------------------------------------------------

CREATE TABLE public.blogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Research Team',
  read_time TEXT NOT NULL DEFAULT '5 min read',
  excerpt TEXT NOT NULL,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_blogs_updated_at
BEFORE UPDATE ON public.blogs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. BASELINE TABLE: public.videos
-- ------------------------------------------------------------------------------

CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  category TEXT NOT NULL,
  duration TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 5. BASELINE TABLE: public.testimonials
-- ------------------------------------------------------------------------------

CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  role TEXT NOT NULL,
  company TEXT,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  review TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_testimonials_updated_at
BEFORE UPDATE ON public.testimonials
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. BASELINE TABLE: public.homepage_content
-- ------------------------------------------------------------------------------

CREATE TABLE public.homepage_content (
  id TEXT PRIMARY KEY DEFAULT 'main-hero',
  section_name TEXT NOT NULL DEFAULT 'Hero & Primary Announcement',
  hero_headline TEXT NOT NULL,
  hero_subheadline TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  cta_link TEXT NOT NULL,
  announcement_bar TEXT,
  show_announcement BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_homepage_content_updated_at
BEFORE UPDATE ON public.homepage_content
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. BASELINE TABLE: public.admin_users
-- ------------------------------------------------------------------------------

CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 8. BASELINE TABLE: public.website_settings & SAFE PUBLIC VIEW
-- ------------------------------------------------------------------------------

CREATE TABLE public.website_settings (
  id TEXT PRIMARY KEY DEFAULT 'global-settings',
  site_title TEXT,
  support_email TEXT,
  support_phone TEXT,
  office_address TEXT,
  whatsapp_number TEXT,
  api_base_url TEXT,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_website_settings_updated_at
BEFORE UPDATE ON public.website_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Secure Public Settings View:
-- Excludes sensitive configuration such as api_base_url while providing
-- anonymous and authenticated visitors access to public layout and contact info.
DROP VIEW IF EXISTS public.public_website_settings CASCADE;

CREATE VIEW public.public_website_settings AS
SELECT
  id,
  site_title,
  support_email,
  support_phone,
  office_address,
  whatsapp_number,
  maintenance_mode,
  created_at,
  updated_at
FROM public.website_settings;

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
-- ------------------------------------------------------------------------------

ALTER TABLE public.unlisted_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drhp_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

-- Public Read Policies for published content (anon and authenticated)
CREATE POLICY "Public can view published shares" ON public.unlisted_shares
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "Public can view published drhp" ON public.drhp_companies
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "Public can view published blogs" ON public.blogs
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "Public can view published videos" ON public.videos
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "Public can view published testimonials" ON public.testimonials
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "Public can view published homepage" ON public.homepage_content
  FOR SELECT TO anon, authenticated USING (status = 'published');

-- Authenticated Admin Full Access Policies (Strictly guarded by public.is_admin())
CREATE POLICY "Admins full access shares" ON public.unlisted_shares
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access drhp" ON public.drhp_companies
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access blogs" ON public.blogs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access videos" ON public.videos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access testimonials" ON public.testimonials
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access homepage" ON public.homepage_content
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- admin_users Security:
-- Ordinary authenticated users CANNOT insert, update, or delete records.
-- Only verified admins can manage the allowlist.
-- Authenticated users can view only their own record to verify their admin status.
CREATE POLICY "Admins full access admin_users" ON public.admin_users
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can read own admin record" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (email IS NOT NULL AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))));

-- website_settings Security:
-- Base table is restricted entirely to verified admins.
-- Anonymous visitors read public settings exclusively through public.public_website_settings view.
CREATE POLICY "Admins full access website_settings" ON public.website_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Explicit Role Grants (Principle of Least Privilege)
REVOKE ALL ON public.admin_users FROM anon, PUBLIC;
REVOKE ALL ON public.website_settings FROM anon, PUBLIC;

-- Public read access for content tables and public view
GRANT SELECT ON public.unlisted_shares TO anon;
GRANT SELECT ON public.drhp_companies TO anon;
GRANT SELECT ON public.blogs TO anon;
GRANT SELECT ON public.videos TO anon;
GRANT SELECT ON public.testimonials TO anon;
GRANT SELECT ON public.homepage_content TO anon;
GRANT SELECT ON public.public_website_settings TO anon, authenticated;

-- Authenticated table access governed strictly by RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

COMMIT;