-- ==============================================================================
-- Supabase Staging Preflight Checks (v2 Baseline-Safe & Post-Migration Compatible)
-- Script: preflight_checks_v2.sql
-- Purpose:
--   Non-destructive, read-only diagnostic audit designed to execute safely:
--   1. BEFORE migration against the un-migrated baseline schema (does NOT crash if
--      new columns like slug, change_type, status_type do not exist yet).
--   2. ON RERUNS / AFTER migration if verifying ongoing integrity.
--
-- RUN THIS BEFORE RUNNING THE MIGRATION.
-- This script performs read-only checks only. No data is modified.
-- ==============================================================================

DO $$
BEGIN
  -- Temporary table to hold audit diagnostic results
  CREATE TEMP TABLE IF NOT EXISTS _preflight_audit_results (
    table_name text,
    check_name text,
    status text,
    violation_count int,
    sample_identifiers text,
    resolution_note text
  ) ON COMMIT DROP;

  DELETE FROM _preflight_audit_results;

  -- ----------------------------------------------------------------------------
  -- 1. UNLISTED SHARES AUDIT
  -- ----------------------------------------------------------------------------
  -- 1a. Symbol missing or blank (Baseline check)
  INSERT INTO _preflight_audit_results
  SELECT
    'unlisted_shares',
    'symbol_missing_or_blank',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    count(*)::int,
    coalesce(string_agg(id::text, ', ' ORDER BY id), 'None'),
    'Symbol is required as primary baseline identifier and slug source.'
  FROM public.unlisted_shares
  WHERE symbol IS NULL OR trim(symbol) = '';

  -- 1b. Symbol exact duplicates (Baseline check)
  INSERT INTO _preflight_audit_results
  SELECT
    'unlisted_shares',
    'symbol_exact_duplicates',
    CASE WHEN coalesce(sum(c), 0) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(symbol || ' (' || c || 'x)', ', '), 'None'),
    'Duplicate symbols will cause identical slug generation and conflict.'
  FROM (
    SELECT symbol, count(*) AS c
    FROM public.unlisted_shares
    WHERE symbol IS NOT NULL AND trim(symbol) <> ''
    GROUP BY symbol
    HAVING count(*) > 1
  ) dups;

  -- 1c. Symbol case-insensitive collisions (e.g. 'TATATECH' vs 'tatatech')
  INSERT INTO _preflight_audit_results
  SELECT
    'unlisted_shares',
    'symbol_case_insensitive_collisions',
    CASE WHEN coalesce(sum(c), 0) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_sym || ' (' || c || 'x)', ', '), 'None'),
    'Symbols differing only by case will collide under case-insensitive unique slug index.'
  FROM (
    SELECT lower(trim(symbol)) AS lower_sym, count(*) AS c
    FROM public.unlisted_shares
    WHERE symbol IS NOT NULL AND trim(symbol) <> ''
    GROUP BY lower(trim(symbol))
    HAVING count(*) > 1
  ) dups;

  -- 1d. Slug integrity (Dynamic check: safe before and after slug column is added)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'unlisted_shares' AND column_name = 'slug'
  ) THEN
    EXECUTE $dyn$
      INSERT INTO _preflight_audit_results
      SELECT
        'unlisted_shares',
        'slug_integrity_and_duplicates',
        CASE
          WHEN coalesce(sum(c), 0) = 0 AND count(CASE WHEN slug IS NULL OR trim(slug) = '' THEN 1 END) = 0 THEN 'PASS'
          WHEN coalesce(sum(c), 0) > 0 THEN 'FAIL (BLOCKER)'
          ELSE 'WARN (AUTO-REPAIRABLE)'
        END,
        (coalesce(sum(c), 0) + count(CASE WHEN slug IS NULL OR trim(slug) = '' THEN 1 END))::int,
        coalesce(string_agg(lower_slug || ' (' || c || 'x)', ', '), 'None'),
        'Slug column exists: blank or duplicate slugs detected.'
      FROM (
        SELECT lower(slug) AS lower_slug, count(*) AS c, max(slug) as slug
        FROM public.unlisted_shares
        GROUP BY lower(slug)
      ) s
      WHERE lower_slug IS NULL OR lower_slug = '' OR c > 1;
    $dyn$;
  ELSE
    INSERT INTO _preflight_audit_results VALUES (
      'unlisted_shares',
      'slug_column_presence',
      'PASS',
      0,
      'Column not added yet',
      'Column "slug" does not exist yet; will be created and populated from symbol during migration.'
    );
  END IF;

  -- 1e. change_type invalid values (Dynamic check)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'unlisted_shares' AND column_name = 'change_type'
  ) THEN
    EXECUTE $dyn$
      INSERT INTO _preflight_audit_results
      SELECT
        'unlisted_shares',
        'change_type_invalid_values',
        CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
        count(*)::int,
        coalesce(string_agg(quote_literal(change_type), ', '), 'None'),
        'Values outside (''up'', ''down'') will fail check constraint.'
      FROM public.unlisted_shares
      WHERE change_type IS NOT NULL AND change_type NOT IN ('up', 'down');
    $dyn$;
  ELSE
    INSERT INTO _preflight_audit_results VALUES (
      'unlisted_shares',
      'change_type_column_presence',
      'PASS',
      0,
      'Column not added yet',
      'Column "change_type" does not exist yet; will be created with DEFAULT ''up''.'
    );
  END IF;


  -- ----------------------------------------------------------------------------
  -- 2. DRHP COMPANIES AUDIT
  -- ----------------------------------------------------------------------------
  -- 2a. company_name: NULL or blank (Baseline check)
  INSERT INTO _preflight_audit_results
  SELECT
    'drhp_companies',
    'company_name_null_or_blank',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    count(*)::int,
    coalesce(string_agg(id::text, ', '), 'None'),
    'Blank company_name cannot have uniqueness enforced safely.'
  FROM public.drhp_companies
  WHERE company_name IS NULL OR trim(company_name) = '';

  -- 2b. company_name: Exact duplicates (Baseline check)
  INSERT INTO _preflight_audit_results
  SELECT
    'drhp_companies',
    'company_name_exact_duplicates',
    CASE WHEN coalesce(sum(c), 0) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(company_name || ' (' || c || 'x)', ', '), 'None'),
    'Duplicate company_name values will block uq_drhp_companies_company_name constraint.'
  FROM (
    SELECT company_name, count(*) AS c
    FROM public.drhp_companies
    WHERE company_name IS NOT NULL AND trim(company_name) <> ''
    GROUP BY company_name
    HAVING count(*) > 1
  ) dups;

  -- 2c. company_name: Case-insensitive duplicates (Baseline check)
  INSERT INTO _preflight_audit_results
  SELECT
    'drhp_companies',
    'company_name_case_insensitive_duplicates',
    CASE WHEN coalesce(sum(c), 0) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_name || ' (' || c || 'x)', ', '), 'None'),
    'Company names differing only by case will cause duplicate listings.'
  FROM (
    SELECT lower(trim(company_name)) AS lower_name, count(*) AS c
    FROM public.drhp_companies
    WHERE company_name IS NOT NULL AND trim(company_name) <> ''
    GROUP BY lower(trim(company_name))
    HAVING count(*) > 1
  ) dups;

  -- 2d. status_type invalid values (Dynamic check)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drhp_companies' AND column_name = 'status_type'
  ) THEN
    EXECUTE $dyn$
      INSERT INTO _preflight_audit_results
      SELECT
        'drhp_companies',
        'status_type_invalid_values',
        CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
        count(*)::int,
        coalesce(string_agg(quote_literal(status_type), ', '), 'None'),
        'Values outside (''cleared'', ''approved'', ''review'') will fail check constraint.'
      FROM public.drhp_companies
      WHERE status_type IS NOT NULL AND status_type NOT IN ('cleared', 'approved', 'review');
    $dyn$;
  ELSE
    INSERT INTO _preflight_audit_results VALUES (
      'drhp_companies',
      'status_type_column_presence',
      'PASS',
      0,
      'Column not added yet',
      'Column "status_type" does not exist yet; will be created with DEFAULT ''review''.'
    );
  END IF;


  -- ----------------------------------------------------------------------------
  -- 3. VIDEOS TABLE AUDIT
  -- ----------------------------------------------------------------------------
  INSERT INTO _preflight_audit_results
  SELECT
    'videos',
    'youtube_id_null_or_blank',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    count(*)::int,
    coalesce(string_agg(id::text, ', '), 'None'),
    'Blank or NULL youtube_id must be populated before unique constraint.'
  FROM public.videos
  WHERE youtube_id IS NULL OR trim(youtube_id) = '';

  INSERT INTO _preflight_audit_results
  SELECT
    'videos',
    'youtube_id_exact_or_case_duplicates',
    CASE WHEN coalesce(sum(c), 0) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_id || ' (' || c || 'x)', ', '), 'None'),
    'Duplicate YouTube IDs will cause uq_videos_youtube_id constraint to fail.'
  FROM (
    SELECT lower(trim(youtube_id)) AS lower_id, count(*) AS c
    FROM public.videos
    WHERE youtube_id IS NOT NULL AND trim(youtube_id) <> ''
    GROUP BY lower(trim(youtube_id))
    HAVING count(*) > 1
  ) dups;


  -- ----------------------------------------------------------------------------
  -- 4. TESTIMONIALS TABLE AUDIT (Advisory Check)
  -- ----------------------------------------------------------------------------
  INSERT INTO _preflight_audit_results
  SELECT
    'testimonials',
    'client_name_duplicates_advisory',
    'PASS',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(client_name || ' (' || c || 'x)', ', '), 'None'),
    'Advisory note: client_name is intentionally NOT constrained as unique; multiple reviews are allowed.'
  FROM (
    SELECT client_name, count(*) AS c
    FROM public.testimonials
    WHERE client_name IS NOT NULL AND trim(client_name) <> ''
    GROUP BY client_name
    HAVING count(*) > 1
  ) dups;


  -- ----------------------------------------------------------------------------
  -- 5. BLOGS TABLE SLUG AUDIT
  -- ----------------------------------------------------------------------------
  INSERT INTO _preflight_audit_results
  SELECT
    'blogs',
    'slug_integrity',
    CASE WHEN coalesce(sum(c), 0) = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_slug || ' (' || c || 'x)', ', '), 'None'),
    'Case-insensitive duplicate slugs in blogs table.'
  FROM (
    SELECT lower(slug) AS lower_slug, count(*) AS c
    FROM public.blogs
    WHERE slug IS NOT NULL AND trim(slug) <> ''
    GROUP BY lower(slug)
    HAVING count(*) > 1
  ) dups;


  -- ----------------------------------------------------------------------------
  -- 6. RESEARCH REPORTS TABLE STATUS
  -- ----------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'research_reports'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'research_reports',
      'table_presence',
      'WARN (ADVISORY)',
      1,
      'Already exists',
      'Table public.research_reports exists; migration will verify all 17 columns and indexes.'
    );
  ELSE
    INSERT INTO _preflight_audit_results VALUES (
      'research_reports',
      'table_presence',
      'PASS',
      0,
      'Not present yet',
      'Clean state: table does not exist yet and will be created fresh by migration.'
    );
  END IF;


  -- ----------------------------------------------------------------------------
  -- 7. ADMIN USERS TABLE STATUS
  -- ----------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    INSERT INTO _preflight_audit_results
    SELECT
      'admin_users',
      'admin_users_readiness',
      'PASS',
      count(*)::int,
      count(CASE WHEN user_id IS NULL THEN 1 END) || ' unlinked user_id rows',
      'admin_users present; is_admin() handles nullable user_id and text email safely.'
    FROM public.admin_users;
  ELSE
    INSERT INTO _preflight_audit_results VALUES (
      'admin_users',
      'admin_users_readiness',
      'PASS',
      0,
      'Table not present',
      'admin_users table not present; is_admin() will rely on JWT app_metadata.'
    );
  END IF;

END $$;

-- Return consolidated diagnostic report ordered by severity
SELECT
  table_name,
  check_name,
  status,
  violation_count,
  sample_identifiers,
  resolution_note
FROM _preflight_audit_results
ORDER BY
  CASE
    WHEN status LIKE 'FAIL%' THEN 1
    WHEN status LIKE 'WARN%' THEN 2
    ELSE 3
  END,
  table_name,
  check_name;
