-- ==============================================================================
-- Supabase Staging Preflight Checks (Release Candidate 01)
-- Script: supabase/release/01_preflight.sql
-- Purpose:
--   Non-destructive, read-only diagnostic audit designed to execute cleanly:
--   1. IN SUPABASE SQL EDITOR as a single execution batch without transaction-boundary drops.
--   2. BEFORE migration against un-migrated or partially migrated baseline schemas
--      (safely guards against missing base tables and un-added columns via information_schema).
--   3. ON REPEATED RUNS in the same session without "relation already exists" errors.
--
-- RUN THIS BEFORE RUNNING THE MIGRATION.
-- This script performs read-only checks only. No data or permanent schema is modified.
-- ==============================================================================

-- 1. Ensure clean session state for repeated runs without ON COMMIT DROP premature cleanup
CREATE TEMP TABLE IF NOT EXISTS _preflight_audit_results (
  table_name text,
  check_name text,
  status text,
  violation_count int,
  sample_identifiers text,
  resolution_note text
) ON COMMIT PRESERVE ROWS;

TRUNCATE _preflight_audit_results;

-- 2. Populate audit results via dynamic inspection
DO $$
DECLARE
  v_has_id boolean;
  v_count int;
  v_samples text;
  v_diff_count int;
  v_diff_samples text;
BEGIN

  -- ----------------------------------------------------------------------------
  -- 1. UNLISTED SHARES AUDIT
  -- ----------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unlisted_shares'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'unlisted_shares',
      'table_existence',
      'FAIL (BLOCKER)',
      1,
      'public.unlisted_shares missing',
      'Base table public.unlisted_shares does not exist. Initial schema migration must be applied first.'
    );
  ELSE
    -- Check if symbol column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'unlisted_shares' AND column_name = 'symbol'
    ) THEN
      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'symbol_column_existence',
        'FAIL (BLOCKER)',
        1,
        'symbol column missing',
        'Required column "symbol" missing from public.unlisted_shares.'
      );
    ELSE
      -- 1a. Symbol missing or blank (Baseline check)
      SELECT count(*), coalesce(string_agg(coalesce(id::text, ctid::text), ', ' ORDER BY id), 'None')
      INTO v_count, v_samples
      FROM public.unlisted_shares
      WHERE symbol IS NULL OR trim(symbol) = '';

      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'symbol_missing_or_blank',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
        v_count,
        v_samples,
        'Symbol is required as primary baseline identifier and slug source.'
      );

      -- 1b. Symbol exact duplicates (Baseline check)
      SELECT coalesce(sum(c), 0)::int, coalesce(string_agg(symbol || ' (' || c || 'x)', ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT symbol, count(*) AS c
        FROM public.unlisted_shares
        WHERE symbol IS NOT NULL AND trim(symbol) <> ''
        GROUP BY symbol
        HAVING count(*) > 1
        LIMIT 5
      ) dups;

      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'symbol_exact_duplicates',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (ADVISORY)' END,
        v_count,
        v_samples,
        'Duplicate symbols detected. Non-blocking: migration automatically disambiguates slugs with numerical suffixes (-2, -3) preserving all records.'
      );

      -- 1c. Symbol case-insensitive collisions (e.g. 'TATATECH' vs 'tatatech')
      SELECT coalesce(sum(c), 0)::int, coalesce(string_agg(lower_sym || ' (' || c || 'x: ' || sym_variants || ')', ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT lower(trim(symbol)) AS lower_sym, count(*) AS c, string_agg(symbol, ' vs ') AS sym_variants
        FROM public.unlisted_shares
        WHERE symbol IS NOT NULL AND trim(symbol) <> ''
        GROUP BY lower(trim(symbol))
        HAVING count(*) > 1
        LIMIT 5
      ) dups;

      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'symbol_case_insensitive_collisions',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (ADVISORY)' END,
        v_count,
        v_samples,
        'Symbols differing only by case detected. Non-blocking: collision-safe slug generator assigns unique lowercase slugs with numerical suffixes.'
      );
    END IF;

    -- 1d. Slug integrity (Dynamic check: safe before and after slug column is added)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'unlisted_shares' AND column_name = 'slug'
    ) THEN
      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'slug_column_presence',
        'NOT CHECKED',
        0,
        'Column not added yet',
        'Column "slug" does not exist yet; will be created and populated from symbol during migration.'
      );
    ELSE
      -- 1d-1. Slugs NULL or blank
      EXECUTE $dyn$
        SELECT count(*)::int, coalesce(string_agg(coalesce(nullif(trim(symbol), ''), id::text), ', '), 'None')
        FROM (
          SELECT symbol, id
          FROM public.unlisted_shares
          WHERE slug IS NULL OR trim(slug) = ''
          LIMIT 5
        ) s;
      $dyn$ INTO v_count, v_samples;

      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'slug_null_or_blank',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (AUTO-REPAIRABLE)' END,
        v_count,
        v_samples,
        'Records with blank/NULL slugs will be auto-populated with collision-safe slugs during migration.'
      );

      -- 1d-2. Case-insensitive duplicate slugs
      EXECUTE $dyn$
        SELECT coalesce(sum(c), 0)::int, coalesce(string_agg(lower_slug || ' (' || c || 'x: ' || samples || ')', ', '), 'None')
        FROM (
          SELECT
            lower(trim(slug)) AS lower_slug,
            count(*) AS c,
            string_agg(slug || ' [id:' || id || ']', ', ') AS samples
          FROM public.unlisted_shares
          WHERE slug IS NOT NULL AND trim(slug) <> ''
          GROUP BY lower(trim(slug))
          HAVING count(*) > 1
          LIMIT 5
        ) dups;
      $dyn$ INTO v_count, v_samples;

      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'slug_case_insensitive_duplicates',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
        v_count,
        v_samples,
        'Case-insensitive duplicate slugs detected in unlisted_shares. Must be resolved before unique index.'
      );
    END IF;

    -- 1e. change_type invalid values (Dynamic check)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'unlisted_shares' AND column_name = 'change_type'
    ) THEN
      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'change_type_column_presence',
        'NOT CHECKED',
        0,
        'Column not added yet',
        'Column "change_type" does not exist yet; will be created with DEFAULT ''up''.'
      );
    ELSE
      EXECUTE $dyn$
        SELECT count(*)::int, coalesce(string_agg(quote_literal(change_type), ', '), 'None')
        FROM (
          SELECT change_type
          FROM public.unlisted_shares
          WHERE change_type IS NOT NULL AND change_type NOT IN ('up', 'down')
          LIMIT 5
        ) bad;
      $dyn$ INTO v_count, v_samples;

      INSERT INTO _preflight_audit_results VALUES (
        'unlisted_shares',
        'change_type_invalid_values',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
        v_count,
        v_samples,
        'Values outside (''up'', ''down'') will fail check constraint.'
      );
    END IF;
  END IF;


  -- ----------------------------------------------------------------------------
  -- 2. DRHP COMPANIES AUDIT
  -- ----------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'drhp_companies'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'drhp_companies',
      'table_existence',
      'FAIL (BLOCKER)',
      1,
      'public.drhp_companies missing',
      'Base table public.drhp_companies does not exist. Initial schema migration must be applied first.'
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'drhp_companies' AND column_name = 'company_name'
    ) THEN
      INSERT INTO _preflight_audit_results VALUES (
        'drhp_companies',
        'company_name_column_existence',
        'FAIL (BLOCKER)',
        1,
        'company_name column missing',
        'Required column "company_name" missing from public.drhp_companies.'
      );
    ELSE
      -- 2a. company_name: NULL or blank (Baseline check)
      SELECT count(*), coalesce(string_agg(coalesce(id::text, ctid::text), ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT id, ctid
        FROM public.drhp_companies
        WHERE company_name IS NULL OR trim(company_name) = ''
        LIMIT 5
      ) b;

      INSERT INTO _preflight_audit_results VALUES (
        'drhp_companies',
        'company_name_null_or_blank',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
        v_count,
        v_samples,
        'Blank company_name cannot have uniqueness enforced safely.'
      );

      -- 2b. company_name: Exact duplicates (Baseline check)
      SELECT coalesce(sum(c), 0)::int, coalesce(string_agg(company_name || ' (' || c || 'x)', ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT company_name, count(*) AS c
        FROM public.drhp_companies
        WHERE company_name IS NOT NULL AND trim(company_name) <> ''
        GROUP BY company_name
        HAVING count(*) > 1
        LIMIT 5
      ) dups;

      INSERT INTO _preflight_audit_results VALUES (
        'drhp_companies',
        'company_name_exact_duplicates',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (ADVISORY)' END,
        v_count,
        v_samples,
        'Duplicate company_name values found. Uniqueness is intentionally not constrained to allow multi-year/refiling records; B-tree search index is created.'
      );

      -- 2c. company_name: Case-insensitive duplicates (Baseline check)
      SELECT coalesce(sum(c), 0)::int, coalesce(string_agg(lower_name || ' (' || c || 'x: ' || name_variants || ')', ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT
          lower(trim(company_name)) AS lower_name,
          count(*) AS c,
          string_agg(company_name, ' vs ') AS name_variants
        FROM public.drhp_companies
        WHERE company_name IS NOT NULL AND trim(company_name) <> ''
        GROUP BY lower(trim(company_name))
        HAVING count(*) > 1
        LIMIT 5
      ) dups;

      INSERT INTO _preflight_audit_results VALUES (
        'drhp_companies',
        'company_name_case_insensitive_duplicates',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (ADVISORY)' END,
        v_count,
        v_samples,
        'Case differences in company names noted; non-unique index will support search without rejecting variants.'
      );
    END IF;

    -- 2d. filing_date column check (Baseline check)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'drhp_companies' AND column_name = 'filing_date'
    ) THEN
      SELECT count(*)::int INTO v_count
      FROM public.drhp_companies
      WHERE filing_date IS NULL;

      INSERT INTO _preflight_audit_results VALUES (
        'drhp_companies',
        'filing_date_status',
        'PASS',
        v_count,
        v_count || ' records with NULL filing_date',
        'filing_date exists; migration will safely drop NOT NULL to support tentative date milestones.'
      );
    END IF;

    -- 2e. status_type invalid values (Dynamic check)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'drhp_companies' AND column_name = 'status_type'
    ) THEN
      INSERT INTO _preflight_audit_results VALUES (
        'drhp_companies',
        'status_type_column_presence',
        'NOT CHECKED',
        0,
        'Column not added yet',
        'Column "status_type" does not exist yet; will be created with DEFAULT ''review''.'
      );
    ELSE
      EXECUTE $dyn$
        SELECT count(*)::int, coalesce(string_agg(quote_literal(status_type), ', '), 'None')
        FROM (
          SELECT status_type
          FROM public.drhp_companies
          WHERE status_type IS NOT NULL AND status_type NOT IN ('cleared', 'approved', 'review')
          LIMIT 5
        ) bad;
      $dyn$ INTO v_count, v_samples;

      INSERT INTO _preflight_audit_results VALUES (
        'drhp_companies',
        'status_type_invalid_values',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
        v_count,
        v_samples,
        'Values outside (''cleared'', ''approved'', ''review'') will fail check constraint.'
      );
    END IF;
  END IF;


  -- ----------------------------------------------------------------------------
  -- 3. VIDEOS TABLE AUDIT
  -- ----------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'videos'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'videos',
      'table_existence',
      'WARN (ADVISORY)',
      1,
      'public.videos missing',
      'Table public.videos does not exist in database.'
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'youtube_id'
    ) THEN
      INSERT INTO _preflight_audit_results VALUES (
        'videos',
        'youtube_id_column_existence',
        'FAIL (BLOCKER)',
        1,
        'youtube_id column missing',
        'Required column "youtube_id" missing from public.videos.'
      );
    ELSE
      SELECT count(*), coalesce(string_agg(coalesce(id::text, ctid::text), ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT id, ctid
        FROM public.videos
        WHERE youtube_id IS NULL OR trim(youtube_id) = ''
        LIMIT 5
      ) b;

      INSERT INTO _preflight_audit_results VALUES (
        'videos',
        'youtube_id_null_or_blank',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (DATA QUALITY)' END,
        v_count,
        v_samples,
        'Blank or NULL youtube_id found. Search index will index existing non-empty values.'
      );

      SELECT coalesce(sum(c), 0)::int, coalesce(string_agg(lower_id || ' (' || c || 'x)', ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT lower(trim(youtube_id)) AS lower_id, count(*) AS c
        FROM public.videos
        WHERE youtube_id IS NOT NULL AND trim(youtube_id) <> ''
        GROUP BY lower(trim(youtube_id))
        HAVING count(*) > 1
        LIMIT 5
      ) dups;

      INSERT INTO _preflight_audit_results VALUES (
        'videos',
        'youtube_id_exact_or_case_duplicates',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (ADVISORY)' END,
        v_count,
        v_samples,
        'Duplicate YouTube IDs found. Uniqueness is intentionally not constrained to permit cross-section references; index idx_videos_youtube_id is created.'
      );
    END IF;
  END IF;


  -- ----------------------------------------------------------------------------
  -- 4. TESTIMONIALS TABLE AUDIT (Advisory Check)
  -- ----------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'testimonials'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'testimonials',
      'table_existence',
      'WARN (ADVISORY)',
      1,
      'public.testimonials missing',
      'Table public.testimonials does not exist in database.'
    );
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'testimonials' AND column_name = 'client_name'
    ) THEN
      SELECT coalesce(sum(c), 0)::int, coalesce(string_agg(client_name || ' (' || c || 'x)', ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT client_name, count(*) AS c
        FROM public.testimonials
        WHERE client_name IS NOT NULL AND trim(client_name) <> ''
        GROUP BY client_name
        HAVING count(*) > 1
        LIMIT 5
      ) dups;

      INSERT INTO _preflight_audit_results VALUES (
        'testimonials',
        'client_name_duplicates_advisory',
        'PASS',
        v_count,
        v_samples,
        'Advisory note: client_name is intentionally NOT constrained as unique; multiple reviews are allowed.'
      );
    END IF;
  END IF;


  -- ----------------------------------------------------------------------------
  -- 5. BLOGS TABLE SLUG AUDIT
  -- ----------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'blogs'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'blogs',
      'table_existence',
      'FAIL (BLOCKER)',
      1,
      'public.blogs missing',
      'Table public.blogs does not exist.'
    );
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'blogs' AND column_name = 'slug'
    ) THEN
      SELECT coalesce(sum(c), 0)::int, coalesce(string_agg(lower_slug || ' (' || c || 'x)', ', '), 'None')
      INTO v_count, v_samples
      FROM (
        SELECT lower(slug) AS lower_slug, count(*) AS c
        FROM public.blogs
        WHERE slug IS NOT NULL AND trim(slug) <> ''
        GROUP BY lower(slug)
        HAVING count(*) > 1
        LIMIT 5
      ) dups;

      INSERT INTO _preflight_audit_results VALUES (
        'blogs',
        'slug_integrity',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL (BLOCKER)' END,
        v_count,
        v_samples,
        'Case-insensitive duplicate slugs in blogs table.'
      );
    END IF;
  END IF;


  -- ----------------------------------------------------------------------------
  -- 6. RESEARCH REPORTS TABLE STATUS
  -- ----------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'research_reports'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'research_reports',
      'table_presence',
      'PASS',
      0,
      'Not present yet',
      'Clean state: table does not exist yet and will be created fresh by migration.'
    );
  ELSE
    -- If table exists, comprehensively verify primary key, nullability, defaults, constraints, and column types
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
    SELECT count(*)::int, coalesce(string_agg(descr, '; '), 'None')
    INTO v_diff_count, v_diff_samples
    FROM mismatches;

    IF v_diff_count = 0 THEN
      INSERT INTO _preflight_audit_results VALUES (
        'research_reports',
        'table_structure_compatibility',
        'PASS',
        0,
        'PK, nullability, defaults, constraints, and all 17 columns match',
        'Table public.research_reports exists and matches required structure and constraints.'
      );
    ELSE
      INSERT INTO _preflight_audit_results VALUES (
        'research_reports',
        'table_structure_compatibility',
        'FAIL (BLOCKER)',
        v_diff_count,
        v_diff_samples,
        'Table exists with incompatible schema. Resolve mismatches before migration.'
      );
    END IF;
  END IF;


  -- ----------------------------------------------------------------------------
  -- 7. ADMIN USERS TABLE STATUS
  -- ----------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'admin_users',
      'admin_users_readiness',
      'NOT CHECKED',
      0,
      'Table not present',
      'admin_users table not present; is_admin() will rely on JWT app_metadata.'
    );
  ELSE
    SELECT count(*)::int, count(CASE WHEN user_id IS NULL THEN 1 END) || ' unlinked user_id rows'
    INTO v_count, v_samples
    FROM public.admin_users;

    INSERT INTO _preflight_audit_results VALUES (
      'admin_users',
      'admin_users_readiness',
      'PASS',
      v_count,
      v_samples,
      'admin_users present; is_admin() handles nullable user_id and text email safely.'
    );
  END IF;


  -- ----------------------------------------------------------------------------
  -- 8. SCHEMA FUNCTIONS READINESS
  -- ----------------------------------------------------------------------------
  SELECT count(*)::int INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_updated_at';

  INSERT INTO _preflight_audit_results VALUES (
    'functions',
    'handle_updated_at_readiness',
    CASE WHEN v_count > 0 THEN 'PASS' ELSE 'WARN (AUTO-REPAIRABLE)' END,
    CASE WHEN v_count > 0 THEN 0 ELSE 1 END,
    'handle_updated_at',
    CASE WHEN v_count > 0 THEN 'Function is already installed.' ELSE 'Function not present; migration creates it.' END
  );

  SELECT count(*)::int INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'is_admin';

  INSERT INTO _preflight_audit_results VALUES (
    'functions',
    'is_admin_readiness',
    CASE WHEN v_count > 0 THEN 'PASS' ELSE 'WARN (AUTO-REPAIRABLE)' END,
    CASE WHEN v_count > 0 THEN 0 ELSE 1 END,
    'is_admin',
    CASE WHEN v_count > 0 THEN 'Function is already installed.' ELSE 'Function not present; migration creates hardened version.' END
  );


  -- ----------------------------------------------------------------------------
  -- 9. ROW LEVEL SECURITY (RLS) WRITE POLICY AUDIT
  -- ----------------------------------------------------------------------------
  SELECT count(*)::int, coalesce(string_agg(tablename || '.' || policyname, ', '), 'None')
  INTO v_count, v_samples
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    AND qual = 'true';

  INSERT INTO _preflight_audit_results VALUES (
    'security_rls',
    'permissive_write_policies',
    CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (AUTO-REPAIRABLE)' END,
    v_count,
    v_samples,
    CASE 
      WHEN v_count = 0 THEN 'No permissive qual=true write policies detected.'
      ELSE 'Permissive USING (true) write policies detected in current schema; 02_migration will drop and replace them with verified is_admin() policies.'
    END
  );


  -- ----------------------------------------------------------------------------
  -- 10. WEBSITE SETTINGS SENSITIVE DATA ISOLATION AUDIT
  -- ----------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'website_settings'
  ) THEN
    INSERT INTO _preflight_audit_results VALUES (
      'website_settings',
      'settings_exposure_audit',
      'NOT CHECKED',
      0,
      'Table not present',
      'website_settings table not present; will be created during baseline / migration.'
    );
  ELSE
    SELECT count(*)::int INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_settings'
      AND cmd = 'SELECT'
      AND ('anon' = ANY(roles::text[]) OR 'public' = ANY(roles::text[]));

    IF has_table_privilege('anon', 'public.website_settings', 'select') THEN
      v_count := v_count + 1;
    END IF;

    INSERT INTO _preflight_audit_results VALUES (
      'website_settings',
      'settings_exposure_audit',
      CASE WHEN v_count = 0 THEN 'PASS' ELSE 'WARN (AUTO-REPAIRABLE)' END,
      v_count,
      CASE WHEN v_count = 0 THEN 'Protected' ELSE 'Direct anon read permitted on base table' END,
      CASE 
        WHEN v_count = 0 THEN 'Base table website_settings is protected from direct public reads.'
        ELSE 'Base table exposes private settings (api_base_url) to direct public read; 02_migration isolates private settings behind public_website_settings view.'
      END
    );
  END IF;

END $$;

-- 3. Return diagnostic table ordered by severity (FAIL -> WARN -> NOT CHECKED -> PASS)
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
    WHEN status LIKE 'NOT CHECKED%' THEN 3
    ELSE 4
  END,
  table_name,
  check_name;
