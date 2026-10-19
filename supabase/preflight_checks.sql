-- ==============================================================================
-- Supabase Staging Preflight Checks: Comprehensive Conflict & Integrity Audit
-- Script: preflight_checks.sql
-- Purpose:
--   Non-destructive, read-only audit to detect:
--   1. Blank, NULL, exact duplicate, and case-insensitive duplicate values in:
--      - videos.youtube_id
--      - testimonials.client_name
--      - drhp_companies.company_name
--      - unlisted_shares.slug
--      - drhp_companies.slug
--      - research_reports.slug (if table exists)
--      - blogs.slug
--   2. Invalid existing values for change_type ('up', 'down') and status_type ('cleared', 'approved', 'review')
--   3. Detailed structural compatibility audit of existing public.research_reports table
--   4. Function readiness (handle_updated_at, is_admin)
--
-- RUN THIS BEFORE RUNNING THE MIGRATION.
-- This script performs SELECTs only. No data is modified.
-- ==============================================================================

WITH preflight_audits AS (

  -- ----------------------------------------------------------------------------
  -- 1. UNLISTED SHARES AUDITS
  -- ----------------------------------------------------------------------------
  -- 1a. Slugs: NULL, empty, or whitespace-only
  SELECT
    'unlisted_shares' AS table_name,
    'slug_null_or_blank' AS check_name,
    'WARNING' AS severity,
    count(*)::int AS violation_count,
    coalesce(string_agg(id::text, ', ' ORDER BY id), 'None') AS sample_identifiers,
    'Records will be auto-populated with collision-safe slugs during migration' AS resolution_note
  FROM public.unlisted_shares
  WHERE slug IS NULL OR trim(slug) = ''

  UNION ALL

  -- 1b. Slugs: Exact duplicates
  SELECT
    'unlisted_shares',
    'slug_exact_duplicates',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(slug || ' (' || c || 'x)', ', '), 'None'),
    'Exact duplicate slugs will prevent unique index creation. Resolve manually before migration.'
  FROM (
    SELECT slug, count(*) AS c
    FROM public.unlisted_shares
    WHERE slug IS NOT NULL AND trim(slug) <> ''
    GROUP BY slug
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- 1c. Slugs: Case-insensitive duplicates (e.g. 'tatatech' vs 'TATATECH')
  SELECT
    'unlisted_shares',
    'slug_case_insensitive_duplicates',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_slug || ' (' || c || 'x)', ', '), 'None'),
    'Case-insensitive collisions violate idx_unlisted_shares_slug_unique. Resolve manually.'
  FROM (
    SELECT lower(slug) AS lower_slug, count(*) AS c
    FROM public.unlisted_shares
    WHERE slug IS NOT NULL AND trim(slug) <> ''
    GROUP BY lower(slug)
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- 1d. Symbol missing or blank (affects slug derivation)
  SELECT
    'unlisted_shares',
    'symbol_missing_or_blank',
    'WARNING',
    count(*)::int,
    coalesce(string_agg(id::text, ', '), 'None'),
    'If symbol is blank, fallback will use name or UUID.'
  FROM public.unlisted_shares
  WHERE symbol IS NULL OR trim(symbol) = ''

  UNION ALL

  -- 1e. change_type invalid existing values
  SELECT
    'unlisted_shares',
    'change_type_invalid_values',
    'CRITICAL',
    count(*)::int,
    coalesce(string_agg(quote_literal(change_type), ', '), 'None'),
    'Values outside (''up'', ''down'') will fail chk_unlisted_shares_change_type.'
  FROM public.unlisted_shares
  WHERE change_type IS NOT NULL AND change_type NOT IN ('up', 'down')

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 2. DRHP COMPANIES AUDITS
  -- ----------------------------------------------------------------------------
  -- 2a. company_name: NULL or blank
  SELECT
    'drhp_companies',
    'company_name_null_or_blank',
    'CRITICAL',
    count(*)::int,
    coalesce(string_agg(id::text, ', '), 'None'),
    'Blank or NULL company_name cannot have uniqueness enforced safely.'
  FROM public.drhp_companies
  WHERE company_name IS NULL OR trim(company_name) = ''

  UNION ALL

  -- 2b. company_name: Exact duplicates
  SELECT
    'drhp_companies',
    'company_name_exact_duplicates',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(company_name || ' (' || c || 'x)', ', '), 'None'),
    'Duplicate company_name will fail uq_drhp_companies_company_name constraint.'
  FROM (
    SELECT company_name, count(*) AS c
    FROM public.drhp_companies
    WHERE company_name IS NOT NULL AND trim(company_name) <> ''
    GROUP BY company_name
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- 2c. company_name: Case-insensitive duplicates
  SELECT
    'drhp_companies',
    'company_name_case_insensitive_duplicates',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_name || ' (' || c || 'x)', ', '), 'None'),
    'Case differences will cause semantic duplicate filings. Resolve manually.'
  FROM (
    SELECT lower(trim(company_name)) AS lower_name, count(*) AS c
    FROM public.drhp_companies
    WHERE company_name IS NOT NULL AND trim(company_name) <> ''
    GROUP BY lower(trim(company_name))
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- 2d. status_type invalid existing values
  SELECT
    'drhp_companies',
    'status_type_invalid_values',
    'CRITICAL',
    count(*)::int,
    coalesce(string_agg(quote_literal(status_type), ', '), 'None'),
    'Values outside (''cleared'', ''approved'', ''review'') will fail chk_drhp_companies_status_type.'
  FROM public.drhp_companies
  WHERE status_type IS NOT NULL AND status_type NOT IN ('cleared', 'approved', 'review')

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 3. VIDEOS AUDITS
  -- ----------------------------------------------------------------------------
  -- 3a. youtube_id: NULL or blank
  SELECT
    'videos',
    'youtube_id_null_or_blank',
    'CRITICAL',
    count(*)::int,
    coalesce(string_agg(id::text, ', '), 'None'),
    'Blank or NULL youtube_id must be populated or purged before constraint addition.'
  FROM public.videos
  WHERE youtube_id IS NULL OR trim(youtube_id) = ''

  UNION ALL

  -- 3b. youtube_id: Exact duplicates
  SELECT
    'videos',
    'youtube_id_exact_duplicates',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(youtube_id || ' (' || c || 'x)', ', '), 'None'),
    'Duplicate YouTube IDs will cause uq_videos_youtube_id constraint addition to fail.'
  FROM (
    SELECT youtube_id, count(*) AS c
    FROM public.videos
    WHERE youtube_id IS NOT NULL AND trim(youtube_id) <> ''
    GROUP BY youtube_id
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- 3c. youtube_id: Case-insensitive duplicates
  SELECT
    'videos',
    'youtube_id_case_insensitive_duplicates',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_id || ' (' || c || 'x)', ', '), 'None'),
    'Case-insensitive duplicate YouTube IDs found.'
  FROM (
    SELECT lower(trim(youtube_id)) AS lower_id, count(*) AS c
    FROM public.videos
    WHERE youtube_id IS NOT NULL AND trim(youtube_id) <> ''
    GROUP BY lower(trim(youtube_id))
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 4. TESTIMONIALS AUDITS
  -- ----------------------------------------------------------------------------
  -- 4a. client_name: NULL or blank
  SELECT
    'testimonials',
    'client_name_null_or_blank',
    'CRITICAL',
    count(*)::int,
    coalesce(string_agg(id::text, ', '), 'None'),
    'Blank or NULL client_name must be populated or purged before constraint addition.'
  FROM public.testimonials
  WHERE client_name IS NULL OR trim(client_name) = ''

  UNION ALL

  -- 4b. client_name: Exact duplicates
  SELECT
    'testimonials',
    'client_name_exact_duplicates',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(client_name || ' (' || c || 'x)', ', '), 'None'),
    'Duplicate client names will cause uq_testimonials_client_name constraint addition to fail.'
  FROM (
    SELECT client_name, count(*) AS c
    FROM public.testimonials
    WHERE client_name IS NOT NULL AND trim(client_name) <> ''
    GROUP BY client_name
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- 4c. client_name: Case-insensitive duplicates
  SELECT
    'testimonials',
    'client_name_case_insensitive_duplicates',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_name || ' (' || c || 'x)', ', '), 'None'),
    'Case-insensitive duplicate client names found.'
  FROM (
    SELECT lower(trim(client_name)) AS lower_name, count(*) AS c
    FROM public.testimonials
    WHERE client_name IS NOT NULL AND trim(client_name) <> ''
    GROUP BY lower(trim(client_name))
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 5. BLOGS SLUG AUDIT
  -- ----------------------------------------------------------------------------
  SELECT
    'blogs',
    'slug_integrity',
    'CRITICAL',
    coalesce(sum(c)::int, 0),
    coalesce(string_agg(lower_slug || ' (' || c || 'x)', ', '), 'None'),
    'Case-insensitive duplicate slugs in blogs table.'
  FROM (
    SELECT lower(slug) AS lower_slug, count(*) AS c
    FROM public.blogs
    WHERE slug IS NOT NULL AND trim(slug) <> ''
    GROUP BY lower(slug)
    HAVING count(*) > 1
  ) dups

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 6. RESEARCH REPORTS SCHEMA AUDIT (if already exists)
  -- ----------------------------------------------------------------------------
  SELECT
    'research_reports',
    'existing_schema_compatibility',
    CASE WHEN count(*) = 0 THEN 'OK' ELSE 'CRITICAL' END,
    count(*)::int,
    coalesce(string_agg(col_name || ' (found ' || actual_type || ')', '; '), 'None'),
    CASE WHEN count(*) = 0 THEN 'research_reports schema matches or table not yet created.' ELSE 'Table exists with incompatible columns. Manual review required.' END
  FROM (
    SELECT r.col_name, a.data_type AS actual_type
    FROM (
      VALUES
        ('id', 'uuid'), ('title', 'text'), ('slug', 'text'),
        ('report_type', 'text'), ('stock_slug', 'text'), ('analyst', 'text'),
        ('read_time', 'text'), ('views_count', 'integer'), ('summary', 'text'),
        ('key_takeaways', 'ARRAY'), ('content', 'text'), ('pdf_url', 'text'),
        ('cover_image', 'text'), ('status', 'text'), ('published_at', 'timestamp with time zone'),
        ('created_at', 'timestamp with time zone'), ('updated_at', 'timestamp with time zone')
    ) AS r(col_name, expected_type)
    JOIN information_schema.tables t ON t.table_schema = 'public' AND t.table_name = 'research_reports'
    LEFT JOIN information_schema.columns a ON a.table_schema = 'public' AND a.table_name = 'research_reports' AND a.column_name = r.col_name
    WHERE a.column_name IS NULL
       OR (r.expected_type = 'text' AND a.data_type NOT IN ('text', 'character varying'))
       OR (r.expected_type <> 'text' AND r.expected_type <> a.data_type)
  ) schema_diff

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 7. FUNCTION SECURITY & READINESS
  -- ----------------------------------------------------------------------------
  SELECT
    'functions',
    'handle_updated_at_exists',
    CASE WHEN count(*) = 0 THEN 'WARNING' ELSE 'OK' END,
    CASE WHEN count(*) = 0 THEN 1 ELSE 0 END,
    'handle_updated_at',
    CASE WHEN count(*) = 0 THEN 'Function missing; migration creates it.' ELSE 'Function is present.' END
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_updated_at'

  UNION ALL

  SELECT
    'functions',
    'is_admin_exists_and_hardened',
    CASE WHEN count(*) = 0 THEN 'WARNING' ELSE 'OK' END,
    CASE WHEN count(*) = 0 THEN 1 ELSE 0 END,
    'is_admin',
    CASE WHEN count(*) = 0 THEN 'Function missing; migration creates hardened version.' ELSE 'Function is present.' END
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'is_admin'

)
SELECT
  table_name,
  check_name,
  CASE
    WHEN violation_count = 0 THEN 'PASS'
    WHEN severity = 'CRITICAL' THEN 'FAIL (BLOCKER)'
    ELSE 'WARN (AUTO-REPAIRABLE)'
  END AS status,
  violation_count,
  sample_identifiers,
  resolution_note
FROM preflight_audits
ORDER BY
  CASE
    WHEN violation_count > 0 AND severity = 'CRITICAL' THEN 1
    WHEN violation_count > 0 THEN 2
    ELSE 3
  END,
  table_name,
  check_name;
