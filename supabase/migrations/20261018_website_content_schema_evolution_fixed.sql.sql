-- ==============================================================================
-- Supabase Database Migration: Website Content Schema Evolution (Hardened)
-- Version: 20261017_website_content_schema_evolution
-- Purpose:
--   1. Evolve public.unlisted_shares (slug, category, change metrics, details jsonb)
--   2. Decouple public.drhp_companies filing date, add regulatory status and pricing
--   3. Create public.research_reports table with RLS, grants, and updated_at trigger
--   4. Audit NULL, blank, exact, and case-insensitive duplicates before constraints
--   5. Harden public.is_admin() (strict search_path, safe JWT parsing, restricted grants)
--   6. Verify change_type & status_type constraints on existing/new data
--   7. Concurrency-safe slug generation with advisory locks for simultaneous inserts
--   8. Zero silent deletions/merges; atomic rollback on any conflict
--   9. Preserve 100% backward compatibility with existing CMS CRUD queries
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

  -- 4. Check admin_users table if present (case-insensitive email or user_id match)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    v_email := lower(coalesce(v_jwt ->> 'email', ''));
    IF EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = v_uid
         OR (v_email <> '' AND email IS NOT NULL AND lower(email) = v_email)
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
    IF NOT (v_condef ~* 'change_type\s+IN\s*\(.*''up''.*''down''.*\)' OR v_condef ~* 'change_type\s*=\s*ANY\s*\(\s*ARRAY\[.*''up''.*''down''.*\]') THEN
      RAISE EXCEPTION 'Constraint chk_unlisted_shares_change_type exists with incompatible definition: %', v_condef;
    END IF;
  ELSE
    -- Drop un-named inline check if present, then add standardized named constraint
    ALTER TABLE public.unlisted_shares
      ADD CONSTRAINT chk_unlisted_shares_change_type CHECK (change_type IN ('up', 'down'));
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. COLLISION-SAFE SLUG POPULATION & INTEGRITY CHECKS (unlisted_shares)
-- ------------------------------------------------------------------------------

-- Acquire exclusive lock for deterministic batch slug assignment
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
    IF NOT (v_condef ~* 'status_type\s+IN\s*\(.*''cleared''.*''approved''.*''review''.*\)' OR v_condef ~* 'status_type\s*=\s*ANY\s*\(\s*ARRAY\[.*''cleared''.*''approved''.*''review''.*\]') THEN
      RAISE EXCEPTION 'Constraint chk_drhp_companies_status_type exists with incompatible definition: %', v_condef;
    END IF;
  ELSE
    ALTER TABLE public.drhp_companies
      ADD CONSTRAINT chk_drhp_companies_status_type CHECK (status_type IN ('cleared', 'approved', 'review'));
  END IF;
END $$;

-- 3c. Pre-constraint Audit: company_name (NULL, blank, exact, and case-insensitive duplicates)
DO $$
DECLARE
  v_blank_count INT;
  v_dup_exact INT;
  v_dup_case INT;
  v_samples TEXT;
BEGIN
  SELECT count(*) INTO v_blank_count
  FROM public.drhp_companies
  WHERE company_name IS NULL OR trim(company_name) = '';

  IF v_blank_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce uniqueness on drhp_companies.company_name: found % records with NULL or blank company_name', v_blank_count;
  END IF;

  SELECT count(*), string_agg(company_name || ' (' || c || 'x)', ', ')
  INTO v_dup_exact, v_samples
  FROM (
    SELECT company_name, count(*) AS c
    FROM public.drhp_companies
    GROUP BY company_name
    HAVING count(*) > 1
    LIMIT 5
  ) d;

  IF v_dup_exact > 0 THEN
    RAISE EXCEPTION 'Cannot enforce uniqueness: % exact duplicate company_name groups in drhp_companies. Samples: %', v_dup_exact, v_samples;
  END IF;

  SELECT count(*), string_agg(lower_name || ' (' || c || 'x)', ', ')
  INTO v_dup_case, v_samples
  FROM (
    SELECT lower(trim(company_name)) AS lower_name, count(*) AS c
    FROM public.drhp_companies
    GROUP BY lower(trim(company_name))
    HAVING count(*) > 1
    LIMIT 5
  ) d;

  IF v_dup_case > 0 THEN
    RAISE EXCEPTION 'Cannot enforce uniqueness: % case-insensitive duplicate company_name groups in drhp_companies. Samples: %', v_dup_case, v_samples;
  END IF;
END $$;

-- Enforce uniqueness on company_name safely with constraint guard
DO $$
DECLARE
  v_condef TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_condef
  FROM pg_constraint
  WHERE conrelid = 'public.drhp_companies'::regclass
    AND conname = 'uq_drhp_companies_company_name';

  IF FOUND THEN
    IF v_condef !~* '^UNIQUE\s*\(\s*company_name\s*\)$' THEN
      RAISE EXCEPTION 'Constraint uq_drhp_companies_company_name exists with incompatible definition: %', v_condef;
    END IF;
  ELSE
    ALTER TABLE public.drhp_companies
      ADD CONSTRAINT uq_drhp_companies_company_name UNIQUE (company_name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drhp_companies_regulatory_status ON public.drhp_companies(regulatory_status);


-- ------------------------------------------------------------------------------
-- 4. THOROUGH STRUCTURAL VERIFICATION & CREATION: public.research_reports
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_col_count INT;
  v_missing_cols TEXT;
BEGIN
  -- If table already exists, perform exhaustive structure check
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'research_reports'
  ) THEN
    -- Verify all 17 required columns exist with compatible types
    WITH required_columns(col_name, expected_type) AS (
      VALUES
        ('id', 'uuid'),
        ('title', 'text'),
        ('slug', 'text'),
        ('report_type', 'text'),
        ('stock_slug', 'text'),
        ('analyst', 'text'),
        ('read_time', 'text'),
        ('views_count', 'integer'),
        ('summary', 'text'),
        ('key_takeaways', 'ARRAY'),
        ('content', 'text'),
        ('pdf_url', 'text'),
        ('cover_image', 'text'),
        ('status', 'text'),
        ('published_at', 'timestamp with time zone'),
        ('created_at', 'timestamp with time zone'),
        ('updated_at', 'timestamp with time zone')
    ),
    actual_columns AS (
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'research_reports'
    )
    SELECT string_agg(r.col_name || ' (expected ' || r.expected_type || ', found ' || coalesce(a.data_type, 'MISSING') || ')', '; ')
    INTO v_missing_cols
    FROM required_columns r
    LEFT JOIN actual_columns a ON r.col_name = a.column_name
    WHERE a.column_name IS NULL
       OR (r.expected_type = 'text' AND a.data_type NOT IN ('text', 'character varying'))
       OR (r.expected_type <> 'text' AND r.expected_type <> a.data_type);

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
  views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  summary TEXT NOT NULL,
  key_takeaways TEXT[] NOT NULL DEFAULT '{}',
  content TEXT,
  pdf_url TEXT,
  cover_image TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive unique index guard for research_reports.slug
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
-- 5. REINFORCE UNIQUENESS CONSTRAINTS ON REMAINING TABLES
-- ------------------------------------------------------------------------------

-- 5a. Videos table: Audit NULL, blank, exact, and case-insensitive duplicates
DO $$
DECLARE
  v_blank_count INT;
  v_dup_exact INT;
  v_dup_case INT;
  v_samples TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'videos'
  ) THEN
    SELECT count(*) INTO v_blank_count
    FROM public.videos
    WHERE youtube_id IS NULL OR trim(youtube_id) = '';

    IF v_blank_count > 0 THEN
      RAISE EXCEPTION 'Cannot enforce constraint uq_videos_youtube_id: % records have NULL or blank youtube_id', v_blank_count;
    END IF;

    SELECT count(*), string_agg(youtube_id || ' (' || c || 'x)', ', ')
    INTO v_dup_exact, v_samples
    FROM (
      SELECT youtube_id, count(*) AS c
      FROM public.videos
      GROUP BY youtube_id
      HAVING count(*) > 1
      LIMIT 5
    ) d;

    IF v_dup_exact > 0 THEN
      RAISE EXCEPTION 'Cannot enforce constraint uq_videos_youtube_id: % exact duplicate youtube_id groups found. Samples: %', v_dup_exact, v_samples;
    END IF;

    SELECT count(*), string_agg(lower_id || ' (' || c || 'x)', ', ')
    INTO v_dup_case, v_samples
    FROM (
      SELECT lower(trim(youtube_id)) AS lower_id, count(*) AS c
      FROM public.videos
      GROUP BY lower(trim(youtube_id))
      HAVING count(*) > 1
      LIMIT 5
    ) d;

    IF v_dup_case > 0 THEN
      RAISE EXCEPTION 'Cannot enforce constraint uq_videos_youtube_id: % case-insensitive duplicate youtube_id groups found. Samples: %', v_dup_case, v_samples;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  v_condef TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'videos'
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_condef
    FROM pg_constraint
    WHERE conrelid = 'public.videos'::regclass
      AND conname = 'uq_videos_youtube_id';

    IF FOUND THEN
      IF v_condef !~* '^UNIQUE\s*\(\s*youtube_id\s*\)$' THEN
        RAISE EXCEPTION 'Constraint uq_videos_youtube_id exists with incompatible definition: %', v_condef;
      END IF;
    ELSE
      ALTER TABLE public.videos
        ADD CONSTRAINT uq_videos_youtube_id UNIQUE (youtube_id);
    END IF;
  END IF;
END $$;

-- Testimonials client_name is intentionally NOT unique.
-- Multiple testimonials may legitimately share the same display name.
-- Keep any duplicate-name auditing as a warning in preflight; do not block migration.

COMMIT;
