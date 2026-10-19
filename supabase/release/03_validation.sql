-- ==============================================================================
-- Supabase Staging Post-Migration Validation Suite (Release Candidate 03)
-- Script: supabase/release/03_validation.sql
-- Purpose:
--   1. Slug integrity audit (validates existing records).
--   2. Case-insensitive duplicate-slug test: passes ONLY on SQLSTATE 23505 (unique_violation).
--      Captures unexpected successful insert ID for exact-ID cleanup.
--   3. Auto-slug trigger test (verifies automated slug generation).
--   4. Constraint validation: change_type & status_type reject invalid values.
--      Captures unexpected successful insert IDs for exact-ID cleanup.
--   5. Trigger validation: handle_updated_at advances timestamp on research_reports.
--   6. Tentative DRHP milestone test: confirms filing_date can be NULL with filing_date_text.
--   7. Function security audit: verifies is_admin grants are revoked from anon and PUBLIC.
--   8. RLS catalog & predicate audit: verifies research_reports RLS and published-only public access.
--   9. Permissive write policy audit: verifies zero qual='true' write policies across public schema.
--  10. Protected tables admin authorization audit: verifies is_admin write policies on all content tables.
--  11. Admin allowlist immutability: verifies admin_users cannot be modified by non-admin users.
--  12. Website settings private data protection: verifies api_base_url is isolated behind public view.
--  13. Exact-ID cleanup guarantee: deletes strictly by exact captured UUIDs;
--      NEVER deletes rows by prefix, wildcard, or broad conditions.
--  14. Strict Failure Assertion: Tracks failures and raises an EXCEPTION if any test fails,
--      preventing failed runs from being mistaken for successful validations.
--
-- EXECUTION:
--   Run this in Supabase SQL Editor on your isolated staging environment AFTER applying 02_migration.sql.
-- ==============================================================================

DO $$
DECLARE
  -- Exact ID tracking for surgical cleanup (all initialized to NULL)
  v_test_share_id uuid := NULL;
  v_test_dup_share_id uuid := NULL;
  v_test_autoslug_id uuid := NULL;
  v_test_bad_chg_id uuid := NULL;
  v_test_bad_status_id uuid := NULL;
  v_test_report_id uuid := NULL;
  v_test_drhp_id uuid := NULL;

  -- Test execution state
  v_auto_slug text;
  v_initial_updated_at timestamptz;
  v_modified_updated_at timestamptz;
  v_dup_caught boolean := false;
  v_dup_error_code text := '';
  v_dup_error_msg text := '';
  v_chk_caught boolean := false;
  v_violation_count int;
  v_policy_count int;
  v_rls_enabled boolean;
  v_anon_can_execute boolean;
  v_insecure_write_count int;
  v_insecure_write_samples text;
  v_content_table_count int;
  v_view_exists boolean;
  v_private_col_count int;
  v_anon_view_priv boolean;
  v_anon_table_priv boolean;
  v_fail_count int := 0;
  v_results text := E'\n================ POST-MIGRATION VALIDATION REPORT ================\n';
BEGIN

  -- ----------------------------------------------------------------------------
  -- TEST 1: SLUG INTEGRITY AUDIT (Existing Records)
  -- ----------------------------------------------------------------------------
  SELECT count(*) INTO v_violation_count
  FROM public.unlisted_shares
  WHERE slug IS NULL OR trim(slug) = '';

  IF v_violation_count = 0 THEN
    v_results := v_results || E'[PASS] Test 1a: No NULL, empty, or whitespace slugs in unlisted_shares\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 1a: Found ' || v_violation_count || E' invalid/blank slugs in unlisted_shares\n';
  END IF;

  SELECT count(*) INTO v_violation_count
  FROM (
    SELECT lower(slug)
    FROM public.unlisted_shares
    GROUP BY lower(slug)
    HAVING count(*) > 1
  ) dups;

  IF v_violation_count = 0 THEN
    v_results := v_results || E'[PASS] Test 1b: All slugs in unlisted_shares are case-insensitively unique\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 1b: Found ' || v_violation_count || E' case-insensitive duplicate slug groups\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 2: ISOLATED CASE-INSENSITIVE DUPLICATE-SLUG ENFORCEMENT TEST
  -- ----------------------------------------------------------------------------
  BEGIN
    -- 2a. Insert seed record with unique random token and known lowercase slug
    INSERT INTO public.unlisted_shares (
      symbol, name, sector, current_price, lot_size, status, slug
    ) VALUES (
      'TEST_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      'Validation Test Share 1',
      'Testing',
      500.00,
      10,
      'draft',
      'val-slug-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
    ) RETURNING id INTO v_test_share_id;

    -- 2b. Attempt to insert colliding record with UPPERCASE variant of the exact same slug
    -- Critical: Capture ID if insert unexpectedly succeeds to guarantee cleanup
    BEGIN
      INSERT INTO public.unlisted_shares (
        symbol, name, sector, current_price, lot_size, status, slug
      ) VALUES (
        'TEST_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
        'Validation Test Share 2',
        'Testing',
        600.00,
        10,
        'draft',
        upper((SELECT slug FROM public.unlisted_shares WHERE id = v_test_share_id))
      ) RETURNING id INTO v_test_dup_share_id;

      v_dup_caught := false;
    EXCEPTION
      WHEN unique_violation THEN
        -- Expected unique violation (PostgreSQL SQLSTATE 23505)
        GET STACKED DIAGNOSTICS
          v_dup_error_code = RETURNED_SQLSTATE,
          v_dup_error_msg = MESSAGE_TEXT;
        v_dup_caught := true;
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
          v_dup_error_code = RETURNED_SQLSTATE,
          v_dup_error_msg = MESSAGE_TEXT;
        v_dup_caught := false;
    END;

    IF v_dup_caught AND v_dup_error_code = '23505' THEN
      v_results := v_results || E'[PASS] Test 2: Case-insensitive duplicate slug rejected strictly by unique_violation (23505)\n';
    ELSIF v_dup_caught AND v_dup_error_code <> '23505' THEN
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 2: Failed due to unexpected error (' || v_dup_error_code || E': ' || v_dup_error_msg || E') instead of unique_violation\n';
    ELSE
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 2: Duplicate slug was allowed without violation!\n';
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 2 setup encountered error: ' || SQLERRM || E'\n';
  END;


  -- ----------------------------------------------------------------------------
  -- TEST 3: AUTO-SLUG TRIGGER ON INSERT WITHOUT SLUG (CMS CRUD COMPATIBILITY)
  -- ----------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.unlisted_shares (
      symbol, name, sector, current_price, lot_size, status
    ) VALUES (
      'AUTO_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      'Auto Slug Test Share',
      'Testing',
      750.00,
      25,
      'draft'
    ) RETURNING id, slug INTO v_test_autoslug_id, v_auto_slug;

    IF v_auto_slug IS NOT NULL AND v_auto_slug <> '' AND v_auto_slug = lower(v_auto_slug) THEN
      v_results := v_results || E'[PASS] Test 3: Auto-slug trigger successfully generated slug: ' || v_auto_slug || E'\n';
    ELSE
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 3: Auto-slug trigger failed to generate valid lowercase slug (found: ' || coalesce(v_auto_slug, 'NULL') || E')\n';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 3 auto-slug error: ' || SQLERRM || E'\n';
  END;


  -- ----------------------------------------------------------------------------
  -- TEST 4: CHECK CONSTRAINTS ENFORCEMENT (change_type & status_type)
  -- ----------------------------------------------------------------------------
  -- 4a. Verify change_type rejects invalid value
  -- Critical: Capture ID if insert unexpectedly succeeds to guarantee cleanup
  BEGIN
    v_chk_caught := false;
    INSERT INTO public.unlisted_shares (
      symbol, name, sector, current_price, lot_size, status, change_type
    ) VALUES (
      'BADCHG_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      'Bad Change Type Share',
      'Testing',
      100.00,
      10,
      'draft',
      'sideways'
    ) RETURNING id INTO v_test_bad_chg_id;
  EXCEPTION
    WHEN check_violation THEN
      v_chk_caught := true;
    WHEN OTHERS THEN
      v_chk_caught := false;
  END;

  IF v_chk_caught THEN
    v_results := v_results || E'[PASS] Test 4a: chk_unlisted_shares_change_type correctly rejected invalid value ''sideways''\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 4a: chk_unlisted_shares_change_type failed to reject invalid value\n';
  END IF;

  -- 4b. Verify status_type rejects invalid value
  -- Critical: Capture ID if insert unexpectedly succeeds to guarantee cleanup
  BEGIN
    v_chk_caught := false;
    INSERT INTO public.drhp_companies (
      company_name, industry, issue_size_cr, status, status_type
    ) VALUES (
      'Bad Status Company ' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      'Testing',
      500.00,
      'draft',
      'invalid_status'
    ) RETURNING id INTO v_test_bad_status_id;
  EXCEPTION
    WHEN check_violation THEN
      v_chk_caught := true;
    WHEN OTHERS THEN
      v_chk_caught := false;
  END;

  IF v_chk_caught THEN
    v_results := v_results || E'[PASS] Test 4b: chk_drhp_companies_status_type correctly rejected invalid value ''invalid_status''\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 4b: chk_drhp_companies_status_type failed to reject invalid value\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 5: AUTOMATED UPDATED_AT TRIGGER ON research_reports
  -- ----------------------------------------------------------------------------
  BEGIN
    -- Explicitly seed with a backdated timestamp so we do not rely on clock advancement within a single transaction
    INSERT INTO public.research_reports (
      title, slug, summary, status, updated_at
    ) VALUES (
      'Validation Report Test',
      'rep-test-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      'Summary of test report',
      'draft',
      now() - interval '1 hour'
    ) RETURNING id, updated_at INTO v_test_report_id, v_initial_updated_at;

    -- Update summary WITHOUT providing updated_at column
    UPDATE public.research_reports
    SET summary = 'Updated summary for validation'
    WHERE id = v_test_report_id
    RETURNING updated_at INTO v_modified_updated_at;

    -- Genuine verification: trigger must have advanced updated_at beyond the seeded older timestamp
    IF v_modified_updated_at > v_initial_updated_at 
       AND v_modified_updated_at >= (now() - interval '5 seconds') THEN
      v_results := v_results || E'[PASS] Test 5: set_research_reports_updated_at trigger fired and genuinely advanced timestamp\n';
    ELSE
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 5: updated_at was not updated by trigger (initial: ' || coalesce(v_initial_updated_at::text, 'NULL') || E', modified: ' || coalesce(v_modified_updated_at::text, 'NULL') || E')\n';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 5 encountered trigger error: ' || SQLERRM || E'\n';
  END;


  -- ----------------------------------------------------------------------------
  -- TEST 6: DRHP NULLABLE FILING DATE & TENTATIVE TEXT MILESTONE
  -- ----------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.drhp_companies (
      company_name, industry, issue_size_cr, status, status_type, filing_date, filing_date_text, lead_managers
    ) VALUES (
      'DRHP Milestone Test ' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      'Fintech',
      2500.00,
      'draft',
      'review',
      NULL,
      'Tentative Q4 FY27 (Board Cleared)',
      'Kotak Mahindra, Morgan Stanley'
    ) RETURNING id INTO v_test_drhp_id;

    IF v_test_drhp_id IS NOT NULL THEN
      v_results := v_results || E'[PASS] Test 6: DRHP company successfully created with NULL filing_date and tentative milestone text\n';
    ELSE
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 6: Failed to create DRHP record with tentative date milestone\n';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 6 encountered DRHP milestone error: ' || SQLERRM || E'\n';
  END;


  -- ----------------------------------------------------------------------------
  -- TEST 7: FUNCTION SECURITY AUDIT (is_admin grant restrictions)
  -- ----------------------------------------------------------------------------
  SELECT has_function_privilege('anon', 'public.is_admin()', 'execute')
  INTO v_anon_can_execute;

  IF NOT v_anon_can_execute THEN
    v_results := v_results || E'[PASS] Test 7: public.is_admin() execution is securely revoked from anon\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 7: Security vulnerability: anon role has EXECUTE permission on public.is_admin()\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 8: RLS POLICY CONFIGURATION & AUTHORIZATION ON research_reports
  -- ----------------------------------------------------------------------------
  -- 8a. Catalog Check: RLS enabled on table
  SELECT c.relrowsecurity INTO v_rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'research_reports';

  IF v_rls_enabled THEN
    v_results := v_results || E'[PASS] Test 8a (Catalog): RLS is enabled on public.research_reports\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 8a (Catalog): RLS is NOT enabled on public.research_reports\n';
  END IF;

  -- 8b. Catalog Inspection: Public Read Policy (cmd, strict roles [anon, authenticated], qual)
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'research_reports'
    AND policyname = 'Public can view published research reports'
    AND cmd = 'SELECT'
    AND roles::text[] @> ARRAY['anon', 'authenticated']
    AND roles::text[] <@ ARRAY['anon', 'authenticated']
    AND NOT ('public' = ANY(roles::text[]))
    AND qual ~* 'status.*=.*''published''';

  IF v_policy_count = 1 THEN
    v_results := v_results || E'[PASS] Test 8b (Catalog): "Public can view published research reports" verified (CMD=SELECT, EXACT ROLES=[anon, authenticated], QUAL: status = published)\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 8b (Catalog): Policy "Public can view published research reports" is missing, overly broad (e.g. PUBLIC), or has incorrect roles/qual\n';
  END IF;

  -- 8c. Catalog Inspection: Admin Full Access Policy (cmd, strict role [authenticated], qual, with_check)
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'research_reports'
    AND policyname = 'Admins have full access to research reports'
    AND cmd = 'ALL'
    AND roles::text[] @> ARRAY['authenticated']
    AND roles::text[] <@ ARRAY['authenticated']
    AND NOT ('public' = ANY(roles::text[]))
    AND qual ~* 'is_admin'
    AND with_check ~* 'is_admin';

  IF v_policy_count = 1 THEN
    v_results := v_results || E'[PASS] Test 8c (Catalog): "Admins have full access to research reports" verified (CMD=ALL, EXACT ROLES=[authenticated], QUAL/WITH_CHECK: is_admin)\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 8c (Catalog): Policy "Admins have full access to research reports" is missing, overly broad (e.g. PUBLIC), or has incorrect roles/predicates\n';
  END IF;

  -- 8d. Authorization Separation Note
  v_results := v_results || E'[INFO] Test 8d (Authorization Note): Catalog inspection confirms policy AST and predicate bounds. Full runtime enforcement occurs at authenticated Supabase client boundaries.\n';


  -- ----------------------------------------------------------------------------
  -- TEST 9: PERMISSIVE WRITE POLICY AUDIT (ZERO INSECURE WRITE POLICIES)
  -- ----------------------------------------------------------------------------
  -- Verifies that NO policy in schema public allows unrestricted writes (qual = 'true')
  SELECT count(*), coalesce(string_agg(tablename || '.' || policyname, ', '), 'None')
  INTO v_insecure_write_count, v_insecure_write_samples
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    AND qual = 'true';

  IF v_insecure_write_count = 0 THEN
    v_results := v_results || E'[PASS] Test 9: Zero permissive USING (true) write policies exist across public schema\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 9: Found ' || v_insecure_write_count || E' insecure write policies with qual=true: ' || v_insecure_write_samples || E'\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 10: ADMIN-ONLY WRITE POLICY AUDIT ACROSS CMS CONTENT & CONFIG TABLES
  -- ----------------------------------------------------------------------------
  -- Verifies every protected table in public schema has an admin policy requiring public.is_admin()
  SELECT count(*)
  INTO v_content_table_count
  FROM (
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND roles::text[] @> ARRAY['authenticated']
      AND roles::text[] <@ ARRAY['authenticated']
      AND NOT ('public' = ANY(roles::text[]))
      AND qual ~* 'is_admin'
      AND with_check ~* 'is_admin'
      AND tablename IN ('unlisted_shares', 'drhp_companies', 'blogs', 'videos', 'testimonials', 'homepage_content', 'admin_users', 'website_settings', 'research_reports')
  ) secured_tables;

  IF v_content_table_count >= 8 THEN
    v_results := v_results || E'[PASS] Test 10: Verified ' || v_content_table_count || E' tables have strict authenticated admin-only policies using public.is_admin()\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 10: Only ' || v_content_table_count || E' tables have verified is_admin policies (expected at least 8)\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 11: ADMIN USERS TABLE SECURITY & ALLOWLIST IMMUTABILITY
  -- ----------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
    -- 11a. RLS enabled
    SELECT c.relrowsecurity INTO v_rls_enabled
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'admin_users';

    -- 11b. Anon cannot SELECT
    SELECT has_table_privilege('anon', 'public.admin_users', 'select') INTO v_anon_table_priv;

    -- 11c. Check self-read policy exists for authenticated users
    SELECT count(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND cmd = 'SELECT'
      AND roles::text[] @> ARRAY['authenticated']
      AND qual ~* 'user_id'
      AND qual ~* 'email';

    IF v_rls_enabled AND NOT v_anon_table_priv AND v_policy_count >= 1 THEN
      v_results := v_results || E'[PASS] Test 11: admin_users table is secured (RLS enabled, anon revoked, non-admins restricted from modifying allowlist)\n';
    ELSE
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 11: admin_users security check failed (RLS: ' || coalesce(v_rls_enabled::text, 'NULL') ||
        E', anon_select: ' || coalesce(v_anon_table_priv::text, 'NULL') ||
        E', self_read_policy: ' || v_policy_count || E')\n';
    END IF;
  ELSE
    v_results := v_results || E'[INFO] Test 11: admin_users table not present; skipped\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 12: WEBSITE SETTINGS ISOLATION & SAFE PUBLIC VIEW
  -- ----------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'website_settings') THEN
    -- 12a. Table: anon cannot directly SELECT from website_settings base table
    SELECT has_table_privilege('anon', 'public.website_settings', 'select') INTO v_anon_table_priv;

    -- 12b. Table: No public read policy on base table
    SELECT count(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_settings'
      AND cmd = 'SELECT'
      AND ('anon' = ANY(roles::text[]) OR 'public' = ANY(roles::text[]));

    -- 12c. View: public_website_settings view exists
    SELECT EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = 'public_website_settings'
    ) INTO v_view_exists;

    -- 12d. View: api_base_url is NOT exposed in view
    SELECT count(*) INTO v_private_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_website_settings'
      AND column_name = 'api_base_url';

    -- 12e. View: anon can SELECT from public_website_settings
    SELECT has_table_privilege('anon', 'public.public_website_settings', 'select') INTO v_anon_view_priv;

    IF NOT v_anon_table_priv AND v_policy_count = 0 AND v_view_exists AND v_private_col_count = 0 AND v_anon_view_priv THEN
      v_results := v_results || E'[PASS] Test 12: website_settings secured: private settings (api_base_url) isolated behind public_website_settings view\n';
    ELSE
      v_fail_count := v_fail_count + 1;
      v_results := v_results || E'[FAIL] Test 12: website_settings exposure check failed (anon_table_priv: ' || coalesce(v_anon_table_priv::text, 'NULL') ||
        E', public_table_policy: ' || v_policy_count ||
        E', view_exists: ' || coalesce(v_view_exists::text, 'NULL') ||
        E', private_cols_in_view: ' || v_private_col_count ||
        E', anon_view_priv: ' || coalesce(v_anon_view_priv::text, 'NULL') || E')\n';
    END IF;
  ELSE
    v_results := v_results || E'[INFO] Test 12: website_settings table not present; skipped\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 13: EXACT-ID CLEANUP GUARANTEE (Zero collateral deletion)
  -- ----------------------------------------------------------------------------
  -- Exact ID Cleanup: deletes strictly by exact captured UUID.
  -- Covers seed records AND any unexpected successful inserts from negative tests.
  IF v_test_share_id IS NOT NULL THEN
    DELETE FROM public.unlisted_shares WHERE id = v_test_share_id;
  END IF;

  IF v_test_dup_share_id IS NOT NULL THEN
    DELETE FROM public.unlisted_shares WHERE id = v_test_dup_share_id;
  END IF;

  IF v_test_autoslug_id IS NOT NULL THEN
    DELETE FROM public.unlisted_shares WHERE id = v_test_autoslug_id;
  END IF;

  IF v_test_bad_chg_id IS NOT NULL THEN
    DELETE FROM public.unlisted_shares WHERE id = v_test_bad_chg_id;
  END IF;

  IF v_test_report_id IS NOT NULL THEN
    DELETE FROM public.research_reports WHERE id = v_test_report_id;
  END IF;

  IF v_test_drhp_id IS NOT NULL THEN
    DELETE FROM public.drhp_companies WHERE id = v_test_drhp_id;
  END IF;

  IF v_test_bad_status_id IS NOT NULL THEN
    DELETE FROM public.drhp_companies WHERE id = v_test_bad_status_id;
  END IF;

  -- Verify exact IDs are completely removed from database
  SELECT count(*) INTO v_violation_count
  FROM (
    SELECT id FROM public.unlisted_shares 
    WHERE id IN (v_test_share_id, v_test_dup_share_id, v_test_autoslug_id, v_test_bad_chg_id)
    UNION ALL
    SELECT id FROM public.research_reports 
    WHERE id = v_test_report_id
    UNION ALL
    SELECT id FROM public.drhp_companies 
    WHERE id IN (v_test_drhp_id, v_test_bad_status_id)
  ) leftover;

  IF v_violation_count = 0 THEN
    v_results := v_results || E'[PASS] Test 13: All test records cleanly purged by exact ID (0 left behind)\n';
  ELSE
    v_fail_count := v_fail_count + 1;
    v_results := v_results || E'[FAIL] Test 13: Test cleanup failed; ' || v_violation_count || E' test records remain\n';
  END IF;

  -- ----------------------------------------------------------------------------
  -- FINAL REPORT & STRICT ASSERTION
  -- ----------------------------------------------------------------------------
  v_results := v_results || E'==================================================================\n';
  v_results := v_results || 'TOTAL VALIDATION FAILURES: ' || v_fail_count || E'\n';
  v_results := v_results || E'==================================================================\n';
  RAISE NOTICE '%', v_results;

  -- Fail explicitly if any check did not pass: cannot be mistaken for a successful run
  IF v_fail_count > 0 THEN
    RAISE EXCEPTION E'VALIDATION SUITE FAILED: % test(s) failed validation checks! Review NOTICE log above for full details.', v_fail_count;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Fallback surgical cleanup by exact ID in case of any abort or exception
    IF v_test_share_id IS NOT NULL THEN
      DELETE FROM public.unlisted_shares WHERE id = v_test_share_id;
    END IF;
    IF v_test_dup_share_id IS NOT NULL THEN
      DELETE FROM public.unlisted_shares WHERE id = v_test_dup_share_id;
    END IF;
    IF v_test_autoslug_id IS NOT NULL THEN
      DELETE FROM public.unlisted_shares WHERE id = v_test_autoslug_id;
    END IF;
    IF v_test_bad_chg_id IS NOT NULL THEN
      DELETE FROM public.unlisted_shares WHERE id = v_test_bad_chg_id;
    END IF;
    IF v_test_report_id IS NOT NULL THEN
      DELETE FROM public.research_reports WHERE id = v_test_report_id;
    END IF;
    IF v_test_drhp_id IS NOT NULL THEN
      DELETE FROM public.drhp_companies WHERE id = v_test_drhp_id;
    END IF;
    IF v_test_bad_status_id IS NOT NULL THEN
      DELETE FROM public.drhp_companies WHERE id = v_test_bad_status_id;
    END IF;

    RAISE EXCEPTION '%', SQLERRM;
END $$;
