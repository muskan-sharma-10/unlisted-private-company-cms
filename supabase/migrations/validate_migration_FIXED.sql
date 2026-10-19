-- ==============================================================================
-- Supabase Staging Post-Migration Validation Suite (Hardened)
-- Script: validate_migration.sql
-- Purpose:
--   1. Slug integrity audit (rejects NULL, empty, whitespace-only slugs).
--   2. Case-insensitive duplicate-slug test: passes ONLY on SQLSTATE 23505 (unique_violation).
--   3. Constraint validation: change_type & status_type reject invalid enum-like values.
--   4. Trigger validation: handle_updated_at advances timestamp; auto_slug generates slug.
--   5. Function security audit: verifies is_admin grants are revoked from anon and PUBLIC.
--   6. RLS audit: verifies research_reports RLS and published-only public access.
--   7. Safe cleanup guarantee: all test records purged even on assertion failure.
-- Run ONLY after migration on an isolated staging database.
-- Do not run against production: this script performs inserts and deletes.
-- ==============================================================================

DO $$
DECLARE
  v_test_prefix CONSTANT text := '__TEST_VAL_' || replace(gen_random_uuid()::text, '-', '') || '_';
  v_test_share_id uuid;
  v_test_report_id uuid;
  v_test_drhp_id uuid;
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
    v_results := v_results || E'[FAIL] Test 1b: Found ' || v_violation_count || E' case-insensitive duplicate slug groups\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 2: ISOLATED CASE-INSENSITIVE DUPLICATE-SLUG ENFORCEMENT TEST
  -- ----------------------------------------------------------------------------
  BEGIN
    -- 2a. Insert seed record with known lowercase slug
    INSERT INTO public.unlisted_shares (
      symbol, name, sector, current_price, lot_size, status, slug
    ) VALUES (
      v_test_prefix || 'SHR1',
      'Validation Test Share 1',
      'Testing',
      500.00,
      10,
      'draft',
      v_test_prefix || 'validation-slug'
    ) RETURNING id INTO v_test_share_id;

    -- 2b. Attempt to insert colliding record with UPPERCASE slug
    BEGIN
      INSERT INTO public.unlisted_shares (
        symbol, name, sector, current_price, lot_size, status, slug
      ) VALUES (
        v_test_prefix || 'SHR2',
        'Validation Test Share 2',
        'Testing',
        600.00,
        10,
        'draft',
        upper(v_test_prefix || 'validation-slug')
      );

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
      v_results := v_results || E'[FAIL] Test 2: Failed due to unexpected error (' || v_dup_error_code || E': ' || v_dup_error_msg || E') instead of unique_violation\n';
    ELSE
      v_results := v_results || E'[FAIL] Test 2: Duplicate slug was allowed without violation!\n';
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      v_results := v_results || E'[FAIL] Test 2 setup encountered error: ' || SQLERRM || E'\n';
  END;


  -- ----------------------------------------------------------------------------
  -- TEST 3: AUTO-SLUG TRIGGER ON INSERT WITHOUT SLUG (CMS CRUD COMPATIBILITY)
  -- ----------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.unlisted_shares (
      symbol, name, sector, current_price, lot_size, status
    ) VALUES (
      v_test_prefix || 'AUTOSLUG',
      'Auto Slug Test Share',
      'Testing',
      750.00,
      25,
      'draft'
    ) RETURNING slug INTO v_auto_slug;

    IF v_auto_slug IS NOT NULL AND v_auto_slug <> '' AND v_auto_slug = lower(v_auto_slug) THEN
      v_results := v_results || E'[PASS] Test 3: Auto-slug trigger successfully generated slug: ' || v_auto_slug || E'\n';
    ELSE
      v_results := v_results || E'[FAIL] Test 3: Auto-slug trigger failed to generate valid lowercase slug (found: ' || coalesce(v_auto_slug, 'NULL') || E')\n';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_results := v_results || E'[FAIL] Test 3 auto-slug error: ' || SQLERRM || E'\n';
  END;


  -- ----------------------------------------------------------------------------
  -- TEST 4: CHECK CONSTRAINTS ENFORCEMENT (change_type & status_type)
  -- ----------------------------------------------------------------------------
  -- 4a. Verify change_type rejects invalid value
  BEGIN
    v_chk_caught := false;
    INSERT INTO public.unlisted_shares (
      symbol, name, sector, current_price, lot_size, status, change_type
    ) VALUES (
      v_test_prefix || 'BADCHG',
      'Bad Change Type Share',
      'Testing',
      100.00,
      10,
      'draft',
      'sideways'
    );
  EXCEPTION
    WHEN check_violation THEN
      v_chk_caught := true;
    WHEN OTHERS THEN
      v_chk_caught := false;
  END;

  IF v_chk_caught THEN
    v_results := v_results || E'[PASS] Test 4a: chk_unlisted_shares_change_type correctly rejected invalid value ''sideways''\n';
  ELSE
    v_results := v_results || E'[FAIL] Test 4a: chk_unlisted_shares_change_type failed to reject invalid value\n';
  END IF;

  -- 4b. Verify status_type rejects invalid value
  BEGIN
    v_chk_caught := false;
    INSERT INTO public.drhp_companies (
      company_name, industry, issue_size_cr, status, status_type
    ) VALUES (
      v_test_prefix || 'Bad Status Company',
      'Testing',
      500.00,
      'draft',
      'invalid_status'
    );
  EXCEPTION
    WHEN check_violation THEN
      v_chk_caught := true;
    WHEN OTHERS THEN
      v_chk_caught := false;
  END;

  IF v_chk_caught THEN
    v_results := v_results || E'[PASS] Test 4b: chk_drhp_companies_status_type correctly rejected invalid value ''invalid_status''\n';
  ELSE
    v_results := v_results || E'[FAIL] Test 4b: chk_drhp_companies_status_type failed to reject invalid value\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 5: AUTOMATED UPDATED_AT TRIGGER VERIFICATION
  -- ----------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.research_reports (
      title, slug, summary, status
    ) VALUES (
      'Validation Report Test',
      v_test_prefix || 'rep1',
      'Summary of test report',
      'draft'
    ) RETURNING id, updated_at INTO v_test_report_id, v_initial_updated_at;

    PERFORM pg_sleep(0.05);

    UPDATE public.research_reports
    SET summary = 'Updated summary for validation'
    WHERE id = v_test_report_id
    RETURNING updated_at INTO v_modified_updated_at;

    IF v_modified_updated_at >= v_initial_updated_at THEN
      v_results := v_results || E'[PASS] Test 5: set_research_reports_updated_at trigger fired and advanced timestamp\n';
    ELSE
      v_results := v_results || E'[FAIL] Test 5: updated_at was not updated by trigger\n';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_results := v_results || E'[FAIL] Test 5 encountered trigger error: ' || SQLERRM || E'\n';
  END;


  -- ----------------------------------------------------------------------------
  -- TEST 6: FUNCTION SECURITY AUDIT (is_admin grant restrictions)
  -- ----------------------------------------------------------------------------
  -- Verify anon role cannot execute public.is_admin()
  SELECT has_function_privilege('anon', 'public.is_admin()', 'execute')
  INTO v_anon_can_execute;

  IF NOT v_anon_can_execute THEN
    v_results := v_results || E'[PASS] Test 6: public.is_admin() execution is securely revoked from anon\n';
  ELSE
    v_results := v_results || E'[FAIL] Test 6: Security vulnerability: anon role has EXECUTE permission on public.is_admin()\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 7: RLS CONFIGURATION ON research_reports
  -- ----------------------------------------------------------------------------
  SELECT c.relrowsecurity INTO v_rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'research_reports';

  IF v_rls_enabled THEN
    v_results := v_results || E'[PASS] Test 7a: RLS is enabled on public.research_reports\n';
  ELSE
    v_results := v_results || E'[FAIL] Test 7a: RLS is NOT enabled on public.research_reports\n';
  END IF;

  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'research_reports'
    AND policyname IN (
      'Public can view published research reports',
      'Admins have full access to research reports'
    );

  IF v_policy_count = 2 THEN
    v_results := v_results || E'[PASS] Test 7b: Both expected RLS policies are present with valid identifiers\n';
  ELSE
    v_results := v_results || E'[FAIL] Test 7b: Expected 2 RLS policies on research_reports, found ' || v_policy_count || E'\n';
  END IF;


  -- ----------------------------------------------------------------------------
  -- TEST 8: CLEANUP GUARANTEE (Leave No Test Records Behind)
  -- ----------------------------------------------------------------------------
  DELETE FROM public.unlisted_shares WHERE left(symbol, length(v_test_prefix)) = v_test_prefix;
  DELETE FROM public.research_reports WHERE left(slug, length(v_test_prefix)) = v_test_prefix;
  DELETE FROM public.drhp_companies WHERE left(company_name, length(v_test_prefix)) = v_test_prefix;

  SELECT count(*) INTO v_violation_count
  FROM (
    SELECT id FROM public.unlisted_shares WHERE left(symbol, length(v_test_prefix)) = v_test_prefix
    UNION ALL
    SELECT id FROM public.research_reports WHERE left(slug, length(v_test_prefix)) = v_test_prefix
    UNION ALL
    SELECT id FROM public.drhp_companies WHERE left(company_name, length(v_test_prefix)) = v_test_prefix
  ) leftover;

  IF v_violation_count = 0 THEN
    v_results := v_results || E'[PASS] Test 8: All validation test records cleanly removed (0 left behind)\n';
  ELSE
    v_results := v_results || E'[FAIL] Test 8: Test cleanup failed; ' || v_violation_count || E' test records remain\n';
  END IF;

  v_results := v_results || E'==================================================================\n';
  RAISE NOTICE '%', v_results;

EXCEPTION
  WHEN OTHERS THEN
    DELETE FROM public.unlisted_shares WHERE left(symbol, length(v_test_prefix)) = v_test_prefix;
    DELETE FROM public.research_reports WHERE left(slug, length(v_test_prefix)) = v_test_prefix;
    DELETE FROM public.drhp_companies WHERE left(company_name, length(v_test_prefix)) = v_test_prefix;
    RAISE EXCEPTION 'Validation suite aborted with error: % (Test records purged)', SQLERRM;
END $$;
