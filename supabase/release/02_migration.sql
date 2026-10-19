-- ==============================================================================
-- Supabase Database Migration: Website Content Schema Evolution (Release Candidate 02)
-- Script: supabase/release/02_migration.sql
-- Purpose:
--   1. Evolve public.unlisted_shares (slug, category, change metrics, details jsonb)
--   2. Decouple public.drhp_companies filing date (drop NOT NULL), add regulatory status and pricing
--   3. Create public.research_reports table with RLS, grants, and updated_at trigger
--   4. Case-insensitive unique indexes on route slugs (unlisted_shares.slug, research_reports.slug)
--   5. Maintain baseline business rules: DO NOT enforce artificial uniqueness on
--      drhp_companies.company_name or videos.youtube_id (use search indexes instead)
--   6. Harden public.is_admin() (strict search_path, safe JSON parsing, restricted grants)
--   7. Verify change_type & status_type constraints on existing/new data
--   8. Concurrency-safe slug generation with advisory locks for simultaneous inserts
--   9. Zero silent deletions or merges; atomic transaction with rollback on failure
--  10. Baseline Security Remediation: Purges permissive USING (true) policies across all tables
--      and enforces hardened public.is_admin() policies across baseline content and admin tables
--  11. Website Settings Isolation: Isolates private settings (api_base_url) behind public_website_settings view
--  12. Preserve 100% backward compatibility with existing CMS queries
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. FOUNDATIONAL FUNCTIONS & HARDENED SECURITY
-- ------------------------------------------------------------------------------

-- Ensure UUID generation extension is active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Standard automated updated_at timestamp trigger function
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

-- Hardened admin check function:
-- - Strict search_path preventing schema hijacking
-- - Safe JSON extraction: avoids runtime crash if is_admin claim is non-boolean or malformed
-- - Requires authenticated user (auth.uid() IS NOT NULL)
-- - Handles nullable admin_users.user_id and text email safely
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

-- Enforce principle of least privilege: Revoke execute from PUBLIC and anon
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 1. STRUCTURAL VERIFICATION & EVOLUTION: public.unlisted_shares
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unlisted_shares'
  ) THEN
    RAISE EXCEPTION 'Target table public.unlisted_shares does not exist. Run initial schema migration first.';
  END IF;

  -- Verify data type compatibility for existing columns if already present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'unlisted_shares' AND column_name = 'slug'
      AND data_type NOT IN ('text', 'character varying')
  ) THEN
    RAISE EXCEPTION 'Column public.unlisted_shares.slug exists with incompatible data type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'unlisted_shares' AND column_name = 'details'
      AND data_type <> 'jsonb'
  ) THEN
    RAISE EXCEPTION 'Column public.unlisted_shares.details exists with incompatible data type (expected jsonb)';
  END IF;
END $$;

-- Add new columns with safe defaults for CMS backward compatibility
ALTER TABLE public.unlisted_shares
  ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE public.unlisted_shares
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Popular';

ALTER TABLE public.unlisted_shares
  ADD COLUMN IF NOT EXISTS change_percent TEXT DEFAULT '0.0%';

ALTER TABLE public.unlisted_shares
  ADD COLUMN IF NOT EXISTS change_type TEXT DEFAULT 'up';

ALTER TABLE public.unlisted_shares
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.unlisted_shares
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 1b. Verify existing values and constraint for change_type
DO $$
DECLARE
  v_invalid_count INT;
  v_bad_samples TEXT;
  v_condef TEXT;
BEGIN
  -- Verify any existing rows have valid change_type values
  SELECT count(*), string_agg(quote_literal(change_type), ', ')
  INTO v_invalid_count, v_bad_samples
  FROM (
    SELECT change_type FROM public.unlisted_shares
    WHERE change_type IS NOT NULL AND change_type NOT IN ('up', 'down')
    LIMIT 5
  ) invalid_rows;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce change_type constraint: found % records with invalid values (Samples: %)', v_invalid_count, v_bad_samples;
  END IF;

  -- Guard check constraint for change_type
  SELECT pg_get_constraintdef(oid) INTO v_condef
  FROM pg_constraint
  WHERE conrelid = 'public.unlisted_shares'::regclass
    AND conname = 'chk_unlisted_shares_change_type';

  IF FOUND THEN
    IF NOT (v_condef ~* 'change_type.*=.*ANY.*ARRAY.*''up''.*''down''' OR v_condef ~* 'change_type\s+IN\s*\(.*''up''.*''down''.*\)') THEN
      RAISE EXCEPTION 'Constraint chk_unlisted_shares_change_type exists with incompatible definition: %', v_condef;
    END IF;
  ELSE
    ALTER TABLE public.unlisted_shares
      ADD CONSTRAINT chk_unlisted_shares_change_type CHECK (change_type IN ('up', 'down'));
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. COLLISION-SAFE SLUG POPULATION & INTEGRITY CHECKS (unlisted_shares)
-- ------------------------------------------------------------------------------

-- Acquire lock for deterministic batch slug assignment
LOCK TABLE public.unlisted_shares IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  rec RECORD;
  v_base_slug TEXT;
  v_candidate_slug TEXT;
  v_counter INT;
  v_exists BOOLEAN;
BEGIN
  -- Backfill only records where slug is NULL, empty, or whitespace-only
  -- Preserves 100% of custom, legitimate slugs already entered
  FOR rec IN
    SELECT id, symbol, name
    FROM public.unlisted_shares
    WHERE slug IS NULL OR trim(slug) = ''
    ORDER BY created_at ASC, id ASC
  LOOP
    v_base_slug := lower(regexp_replace(
      coalesce(nullif(trim(rec.symbol), ''), nullif(trim(rec.name), ''), 'share'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ));
    v_base_slug := trim(both '-' from v_base_slug);

    IF v_base_slug = '' THEN
      v_base_slug := 'share-' || substr(rec.id::text, 1, 8);
    END IF;

    v_candidate_slug := v_base_slug;
    v_counter := 1;

    LOOP
      SELECT EXISTS (
        SELECT 1 FROM public.unlisted_shares
        WHERE id <> rec.id AND lower(slug) = lower(v_candidate_slug)
      ) INTO v_exists;

      EXIT WHEN NOT v_exists;

      v_counter := v_counter + 1;
      v_candidate_slug := v_base_slug || '-' || v_counter;
    END LOOP;

    UPDATE public.unlisted_shares
    SET slug = v_candidate_slug
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Pre-constraint Audit: Verify NULL, empty, exact duplicate, and case-insensitive duplicates
DO $$
DECLARE
  v_null_or_blank INT;
  v_exact_dups INT;
  v_case_dups INT;
  v_samples TEXT;
BEGIN
  -- 1. Check NULL or blank
  SELECT count(*) INTO v_null_or_blank
  FROM public.unlisted_shares
  WHERE slug IS NULL OR trim(slug) = '';

  IF v_null_or_blank > 0 THEN
    RAISE EXCEPTION 'Integrity failure: % unlisted_shares still have NULL or blank slugs after backfill', v_null_or_blank;
  END IF;

  -- 2. Check exact duplicates
  SELECT count(*), string_agg(slug || ' (' || c || 'x)', ', ')
  INTO v_exact_dups, v_samples
  FROM (
    SELECT slug, count(*) AS c
    FROM public.unlisted_shares
    GROUP BY slug
    HAVING count(*) > 1
    LIMIT 5
  ) d;

  IF v_exact_dups > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index: % exact duplicate slug groups in unlisted_shares. Samples: %', v_exact_dups, v_samples;
  END IF;

  -- 3. Check case-insensitive duplicates
  SELECT count(*), string_agg(lower_slug || ' (' || c || 'x)', ', ')
  INTO v_case_dups, v_samples
  FROM (
    SELECT lower(slug) AS lower_slug, count(*) AS c
    FROM public.unlisted_shares
    GROUP BY lower(slug)
    HAVING count(*) > 1
    LIMIT 5
  ) d;

  IF v_case_dups > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index: % case-insensitive duplicate slug groups in unlisted_shares. Samples: %', v_case_dups, v_samples;
  END IF;
END $$;

-- Unique case-insensitive index guard on public.unlisted_shares
DO $$
DECLARE
  v_indexdef TEXT;
BEGIN
  SELECT indexdef INTO v_indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'unlisted_shares'
    AND indexname = 'idx_unlisted_shares_slug_unique';

  IF FOUND THEN
    IF v_indexdef !~* '\mUNIQUE\M' OR v_indexdef !~* '\(\s*lower\s*\(\s*(public\.)?slug(\s*::\s*text)?\s*\)\s*\)' THEN
      RAISE EXCEPTION 'Existing index idx_unlisted_shares_slug_unique has incompatible definition: %', v_indexdef;
    END IF;
  ELSE
    CREATE UNIQUE INDEX idx_unlisted_shares_slug_unique ON public.unlisted_shares (lower(slug));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_unlisted_shares_category ON public.unlisted_shares(category);
CREATE INDEX IF NOT EXISTS idx_unlisted_shares_details_gin ON public.unlisted_shares USING gin (details);

-- Concurrency-Safe Trigger: Uses transaction-level advisory locks
-- Ensures simultaneous inserts computing the same candidate slug are serialized
CREATE OR REPLACE FUNCTION public.fn_unlisted_shares_auto_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_base TEXT;
  v_candidate TEXT;
  v_counter INT := 1;
  v_taken BOOLEAN;
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    v_base := lower(regexp_replace(
      coalesce(nullif(trim(NEW.symbol), ''), nullif(trim(NEW.name), ''), 'share'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ));
    v_base := trim(both '-' from v_base);
    IF v_base = '' THEN
      v_base := 'share';
    END IF;

    -- Concurrency serialization: Acquire advisory transaction lock on base slug hash
    PERFORM pg_advisory_xact_lock(hashtext('unlisted_shares_slug_' || v_base));

    v_candidate := v_base;
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM public.unlisted_shares
        WHERE (TG_OP = 'INSERT' OR id <> NEW.id)
          AND lower(slug) = lower(v_candidate)
      ) INTO v_taken;

      EXIT WHEN NOT v_taken;
      v_counter := v_counter + 1;
      v_candidate := v_base || '-' || v_counter;
    END LOOP;

    NEW.slug := v_candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unlisted_shares_auto_slug ON public.unlisted_shares;
CREATE TRIGGER trg_unlisted_shares_auto_slug
BEFORE INSERT OR UPDATE OF slug, symbol, name ON public.unlisted_shares
FOR EACH ROW EXECUTE FUNCTION public.fn_unlisted_shares_auto_slug();


-- ------------------------------------------------------------------------------
-- 3. STRUCTURAL VERIFICATION & EVOLUTION: public.drhp_companies
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'drhp_companies'
  ) THEN
    RAISE EXCEPTION 'Target table public.drhp_companies does not exist. Run initial schema migration first.';
  END IF;
END $$;

ALTER TABLE public.drhp_companies
  ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE public.drhp_companies
  ADD COLUMN IF NOT EXISTS regulatory_status TEXT NOT NULL DEFAULT 'Under Review';

ALTER TABLE public.drhp_companies
  ADD COLUMN IF NOT EXISTS status_type TEXT NOT NULL DEFAULT 'review';

-- Decouple calendar filing date to support textual/tentative milestones (e.g. "Board Cleared")
ALTER TABLE public.drhp_companies
  ALTER COLUMN filing_date DROP NOT NULL;

ALTER TABLE public.drhp_companies
  ADD COLUMN IF NOT EXISTS filing_date_text TEXT;

ALTER TABLE public.drhp_companies
  ADD COLUMN IF NOT EXISTS indicative_price NUMERIC(12, 2) CHECK (indicative_price IS NULL OR indicative_price >= 0);

ALTER TABLE public.drhp_companies
  ADD COLUMN IF NOT EXISTS min_lot INTEGER DEFAULT 1 CHECK (min_lot IS NULL OR min_lot >= 1);

ALTER TABLE public.drhp_companies
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 3b. Verify existing values and constraint for status_type
DO $$
DECLARE
  v_invalid_count INT;
  v_bad_samples TEXT;
  v_condef TEXT;
BEGIN
  SELECT count(*), string_agg(quote_literal(status_type), ', ')
  INTO v_invalid_count, v_bad_samples
  FROM (
    SELECT status_type FROM public.drhp_companies
    WHERE status_type IS NOT NULL AND status_type NOT IN ('cleared', 'approved', 'review')
    LIMIT 5
  ) invalid_rows;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce status_type constraint: found % records with invalid values (Samples: %)', v_invalid_count, v_bad_samples;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_condef
  FROM pg_constraint
  WHERE conrelid = 'public.drhp_companies'::regclass
    AND conname = 'chk_drhp_companies_status_type';

  IF FOUND THEN
    IF NOT (v_condef ~* 'status_type.*=.*ANY.*ARRAY.*''cleared''.*''approved''.*''review''' OR v_condef ~* 'status_type\s+IN\s*\(.*''cleared''.*''approved''.*''review''.*\)') THEN
      RAISE EXCEPTION 'Constraint chk_drhp_companies_status_type exists with incompatible definition: %', v_condef;
    END IF;
  ELSE
    ALTER TABLE public.drhp_companies
      ADD CONSTRAINT chk_drhp_companies_status_type CHECK (status_type IN ('cleared', 'approved', 'review'));
  END IF;
END $$;

-- Drop artificial unique constraint on company_name if it was added by an earlier patch attempt.
-- Indian market DRHP filings allow multiple draft updates across fiscal years or subsidiary names.
ALTER TABLE public.drhp_companies
  DROP CONSTRAINT IF EXISTS uq_drhp_companies_company_name;

-- Add search index for company_name and regulatory_status
CREATE INDEX IF NOT EXISTS idx_drhp_companies_company_name ON public.drhp_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_drhp_companies_regulatory_status ON public.drhp_companies(regulatory_status);


-- ------------------------------------------------------------------------------
-- 4. THOROUGH STRUCTURAL VERIFICATION & CREATION: public.research_reports
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_missing_cols TEXT;
BEGIN
  -- If table already exists, perform exhaustive structure check (PK, nullability, defaults, constraints, types)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'research_reports'
  ) THEN
    WITH required_columns(col_name, expected_type, req_nullable, req_default_pattern) AS (
      VALUES
        ('id', 'uuid', 'NO', 'gen_random_uuid|uuid_generate'),
        ('title', 'text', 'NO', NULL),
        ('slug', 'text', 'NO', NULL),
        ('report_type', 'text', 'NO', 'Valuation Note'),
        ('stock_slug', 'text', 'YES', NULL),
        ('analyst', 'text', 'NO', 'Private Market Research Desk'),
        ('read_time', 'text', 'NO', '6 min read'),
        ('views_count', 'integer', 'NO', '0'),
        ('summary', 'text', 'NO', NULL),
        ('key_takeaways', 'ARRAY', 'NO', '\{\}'),
        ('content', 'text', 'YES', NULL),
        ('pdf_url', 'text', 'YES', NULL),
        ('cover_image', 'text', 'YES', NULL),
        ('status', 'text', 'NO', 'draft'),
        ('published_at', 'timestamp with time zone', 'YES', NULL),
        ('created_at', 'timestamp with time zone', 'NO', 'now'),
        ('updated_at', 'timestamp with time zone', 'NO', 'now')
    ),
    actual_columns AS (
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'research_reports'
    ),
    pk_check AS (
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'research_reports'
        AND tc.constraint_type = 'PRIMARY KEY'
    ),
    status_chk AS (
      SELECT pg_get_constraintdef(c.oid) AS condef
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'research_reports' AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ~* 'status'
    ),
    mismatches AS (
      SELECT r.col_name || ' (expected ' || r.expected_type || ', found ' || coalesce(a.data_type, 'MISSING') || ')' AS descr
      FROM required_columns r
      LEFT JOIN actual_columns a ON r.col_name = a.column_name
      WHERE a.column_name IS NULL
         OR (r.expected_type = 'text' AND a.data_type NOT IN ('text', 'character varying'))
         OR (r.expected_type <> 'text' AND r.expected_type <> a.data_type)
      UNION ALL
      SELECT r.col_name || ' (expected is_nullable=' || r.req_nullable || ', found ' || a.is_nullable || ')' AS descr
      FROM required_columns r
      JOIN actual_columns a ON r.col_name = a.column_name
      WHERE a.is_nullable <> r.req_nullable
      UNION ALL
      SELECT r.col_name || ' (missing expected default matching ' || r.req_default_pattern || ')' AS descr
      FROM required_columns r
      JOIN actual_columns a ON r.col_name = a.column_name
      WHERE r.req_default_pattern IS NOT NULL
        AND (a.column_default IS NULL OR a.column_default !~* r.req_default_pattern)
      UNION ALL
      SELECT 'Primary key is missing or not id' AS descr
      WHERE NOT EXISTS (SELECT 1 FROM pk_check WHERE column_name = 'id')
      UNION ALL
      SELECT 'Missing status check constraint covering draft and published' AS descr
      WHERE NOT EXISTS (
        SELECT 1 FROM status_chk
        WHERE condef ~* 'draft' AND condef ~* 'published'
      )
    )
    SELECT string_agg(descr, '; ')
    INTO v_missing_cols
    FROM mismatches;

    IF v_missing_cols IS NOT NULL THEN
      RAISE EXCEPTION 'Existing public.research_reports table has an incompatible schema: %', v_missing_cols;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'Valuation Note',
  stock_slug TEXT,
  analyst TEXT NOT NULL DEFAULT 'Private Market Research Desk',
  read_time TEXT NOT NULL DEFAULT '6 min read',
  views_count INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_research_reports_views_count CHECK (views_count >= 0),
  summary TEXT NOT NULL,
  key_takeaways TEXT[] NOT NULL DEFAULT '{}',
  content TEXT,
  pdf_url TEXT,
  cover_image TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CONSTRAINT chk_research_reports_status CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive unique index guard for research_reports.slug (URL routing integrity)
DO $$
DECLARE
  v_indexdef TEXT;
BEGIN
  SELECT indexdef INTO v_indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'research_reports'
    AND indexname = 'idx_research_reports_slug_unique';

  IF FOUND THEN
    IF v_indexdef !~* '\mUNIQUE\M' OR v_indexdef !~* '\(\s*lower\s*\(\s*(public\.)?slug(\s*::\s*text)?\s*\)\s*\)' THEN
      RAISE EXCEPTION 'Existing index idx_research_reports_slug_unique has incompatible definition: %', v_indexdef;
    END IF;
  ELSE
    CREATE UNIQUE INDEX idx_research_reports_slug_unique ON public.research_reports (lower(slug));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_research_reports_status ON public.research_reports(status);
CREATE INDEX IF NOT EXISTS idx_research_reports_stock_slug ON public.research_reports(stock_slug);
CREATE INDEX IF NOT EXISTS idx_research_reports_published_at ON public.research_reports(published_at DESC);

-- Automated updated_at trigger
DROP TRIGGER IF EXISTS set_research_reports_updated_at ON public.research_reports;
CREATE TRIGGER set_research_reports_updated_at
BEFORE UPDATE ON public.research_reports
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Table Grants: Authenticated users can write only when authorized by RLS
GRANT SELECT ON public.research_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_reports TO authenticated;
GRANT ALL ON public.research_reports TO service_role;

-- Row Level Security (RLS)
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

-- Public can view ONLY published research reports
DROP POLICY IF EXISTS "Public can view published research reports" ON public.research_reports;
CREATE POLICY "Public can view published research reports"
ON public.research_reports FOR SELECT
TO anon, authenticated
USING (status = 'published');

-- Admins have full access to research reports (using verified is_admin function)
DROP POLICY IF EXISTS "Admins have full access to research reports" ON public.research_reports;
CREATE POLICY "Admins have full access to research reports"
ON public.research_reports FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5. VIDEOS & TESTIMONIALS INDEXATION WITHOUT ARTIFICIAL CONSTRAINTS
-- ------------------------------------------------------------------------------

-- Videos table:
-- Drop any previous artificial unique constraint if present, to permit legitimate
-- multi-section embedding (e.g. video reused across educational guides and analysis).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'videos'
  ) THEN
    ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS uq_videos_youtube_id;
    CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON public.videos(youtube_id);
  END IF;
END $$;

-- Testimonials: client_name is intentionally NOT constrained as unique.
-- Legitimate reviews may share common display names or clients may submit multiple reviews.
-- No unique constraint is placed on public.testimonials(client_name).


-- ------------------------------------------------------------------------------
-- 6. SECURITY REMEDIATION: PURGE PERMISSIVE POLICIES & ENFORCE ADMIN-ONLY WRITES
-- ------------------------------------------------------------------------------

-- 6a. UNLISTED SHARES RLS POLICIES
DROP POLICY IF EXISTS "Admins full access shares" ON public.unlisted_shares;
DROP POLICY IF EXISTS "Admins have full access to shares" ON public.unlisted_shares;
DROP POLICY IF EXISTS "Public can view published shares" ON public.unlisted_shares;

CREATE POLICY "Public can view published shares" ON public.unlisted_shares
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admins have full access to shares" ON public.unlisted_shares
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6b. DRHP COMPANIES RLS POLICIES
DROP POLICY IF EXISTS "Admins full access drhp" ON public.drhp_companies;
DROP POLICY IF EXISTS "Admins have full access to drhp" ON public.drhp_companies;
DROP POLICY IF EXISTS "Public can view published drhp" ON public.drhp_companies;

CREATE POLICY "Public can view published drhp" ON public.drhp_companies
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admins have full access to drhp" ON public.drhp_companies
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6c. BLOGS RLS POLICIES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blogs') THEN
    DROP POLICY IF EXISTS "Admins full access blogs" ON public.blogs;
    DROP POLICY IF EXISTS "Admins have full access to blogs" ON public.blogs;
    DROP POLICY IF EXISTS "Public can view published blogs" ON public.blogs;

    CREATE POLICY "Public can view published blogs" ON public.blogs
      FOR SELECT TO anon, authenticated
      USING (status = 'published');

    CREATE POLICY "Admins have full access to blogs" ON public.blogs
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- 6d. VIDEOS RLS POLICIES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'videos') THEN
    DROP POLICY IF EXISTS "Admins full access videos" ON public.videos;
    DROP POLICY IF EXISTS "Admins have full access to videos" ON public.videos;
    DROP POLICY IF EXISTS "Public can view published videos" ON public.videos;

    CREATE POLICY "Public can view published videos" ON public.videos
      FOR SELECT TO anon, authenticated
      USING (status = 'published');

    CREATE POLICY "Admins have full access to videos" ON public.videos
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- 6e. TESTIMONIALS RLS POLICIES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'testimonials') THEN
    DROP POLICY IF EXISTS "Admins full access testimonials" ON public.testimonials;
    DROP POLICY IF EXISTS "Admins have full access to testimonials" ON public.testimonials;
    DROP POLICY IF EXISTS "Public can view published testimonials" ON public.testimonials;

    CREATE POLICY "Public can view published testimonials" ON public.testimonials
      FOR SELECT TO anon, authenticated
      USING (status = 'published');

    CREATE POLICY "Admins have full access to testimonials" ON public.testimonials
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- 6f. HOMEPAGE CONTENT RLS POLICIES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'homepage_content') THEN
    DROP POLICY IF EXISTS "Admins full access homepage" ON public.homepage_content;
    DROP POLICY IF EXISTS "Admins have full access to homepage" ON public.homepage_content;
    DROP POLICY IF EXISTS "Public can view published homepage" ON public.homepage_content;

    CREATE POLICY "Public can view published homepage" ON public.homepage_content
      FOR SELECT TO anon, authenticated
      USING (status = 'published');

    CREATE POLICY "Admins have full access to homepage" ON public.homepage_content
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- 6g. ADMIN USERS TABLE SECURITY
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
    DROP POLICY IF EXISTS "Admins full access admin_users" ON public.admin_users;
    DROP POLICY IF EXISTS "Admins have full access to admin_users" ON public.admin_users;
    DROP POLICY IF EXISTS "Users can read own admin record" ON public.admin_users;

    -- Only verified admins can insert, update, or delete in admin_users
    CREATE POLICY "Admins have full access to admin_users" ON public.admin_users
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- Authenticated users can view only their own record to verify authorization
    CREATE POLICY "Users can read own admin record" ON public.admin_users
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR (email IS NOT NULL AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))));

    REVOKE ALL ON public.admin_users FROM anon, PUBLIC;
  END IF;
END $$;

-- 6h. WEBSITE SETTINGS ISOLATION & PUBLIC SETTINGS VIEW
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'website_settings') THEN
    -- Drop all legacy/permissive policies on base table
    DROP POLICY IF EXISTS "Public can view website settings" ON public.website_settings;
    DROP POLICY IF EXISTS "Admins full access website_settings" ON public.website_settings;
    DROP POLICY IF EXISTS "Admins have full access to website_settings" ON public.website_settings;

    -- Base table is restricted exclusively to verified admins (protects api_base_url)
    CREATE POLICY "Admins have full access to website_settings" ON public.website_settings
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    REVOKE ALL ON public.website_settings FROM anon, PUBLIC;

    -- Drop existing view first to avoid PostgreSQL error 42P16 (cannot drop columns from view)
    DROP VIEW IF EXISTS public.public_website_settings CASCADE;

    -- Create safe public view without private settings (api_base_url)
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

    GRANT SELECT ON public.public_website_settings TO anon, authenticated;
  END IF;
END $$;

-- 6i. PERMISSIVE WRITE POLICY AUDIT ASSERTION:
-- Ensures no insecure 'USING (true)' write policy survives anywhere in public schema
DO $$
DECLARE
  v_insecure_policies INT;
  v_policy_names TEXT;
BEGIN
  SELECT count(*), string_agg(tablename || '.' || policyname, ', ')
  INTO v_insecure_policies, v_policy_names
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    AND qual = 'true';

  IF v_insecure_policies > 0 THEN
    RAISE EXCEPTION 'Migration security failure: % insecure permissive write policies detected: %', v_insecure_policies, v_policy_names;
  END IF;
END $$;

-- 6j. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
