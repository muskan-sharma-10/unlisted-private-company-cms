# Supabase Schema Migration Rollback Plan

**Release Set:** `supabase/release/`  
**Migration Version:** `02_migration.sql`  
**Target Environment:** Isolated PostgreSQL Staging / Pre-Production  
**Date:** October 18, 2026  

---

## 1. Operational Overview & Safety Rules

> [!CAUTION]
> **Production Guard:** Never apply migrations or rollbacks to production without completing the entire preflight, migration, and post-migration validation workflow in an isolated staging database.
> Always take a snapshot backup before executing DDL.

This rollback plan details the exact, step-by-step SQL operations required to revert all changes introduced by `02_migration.sql`.

### Pre-Rollback Data Export
Before executing any rollback statements, backup any newly created rows in the affected tables:

```sql
-- Dump newly created research reports if any exist
COPY (SELECT * FROM public.research_reports) TO STDOUT WITH CSV HEADER;

-- Dump newly created/updated shares details
COPY (SELECT id, symbol, slug, details FROM public.unlisted_shares) TO STDOUT WITH CSV HEADER;
```

---

## 2. Rollback Triggers

Initiate this rollback procedure immediately if any of the following occur during staging execution:
1. **Migration Abort:** `02_migration.sql` fails with an unhandled exception or constraint error.
2. **Validation Failure:** `03_validation.sql` outputs one or more `[FAIL]` results.
3. **Application Regression:** Next.js CMS frontend fails to read or write shares, DRHP companies, or research reports.
4. **Performance Anomaly:** Database query latency spikes or lock contention occurs.

---

## 3. Step-by-Step Rollback SQL Script

Execute the following SQL block in the Supabase SQL Editor or via `psql` against the staging database:

```sql
BEGIN;

-- ------------------------------------------------------------------------------
-- 1. REVERT: public.research_reports
-- ------------------------------------------------------------------------------

-- Drop RLS policies
DROP POLICY IF EXISTS "Public can view published research reports" ON public.research_reports;
DROP POLICY IF EXISTS "Admins have full access to research reports" ON public.research_reports;

-- Drop automated updated_at trigger
DROP TRIGGER IF EXISTS set_research_reports_updated_at ON public.research_reports;

-- Drop table (cascading drops associated indexes)
DROP TABLE IF EXISTS public.research_reports CASCADE;


-- ------------------------------------------------------------------------------
-- 2. REVERT: public.drhp_companies
-- ------------------------------------------------------------------------------

-- Drop indexes created during migration
DROP INDEX IF EXISTS public.idx_drhp_companies_regulatory_status;
DROP INDEX IF EXISTS public.idx_drhp_companies_company_name;

-- Drop check constraint
ALTER TABLE public.drhp_companies
  DROP CONSTRAINT IF EXISTS chk_drhp_companies_status_type;

-- Remove added columns
ALTER TABLE public.drhp_companies
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS regulatory_status,
  DROP COLUMN IF EXISTS status_type,
  DROP COLUMN IF EXISTS filing_date_text,
  DROP COLUMN IF EXISTS indicative_price,
  DROP COLUMN IF EXISTS min_lot,
  DROP COLUMN IF EXISTS description;

-- Note on filing_date:
-- filing_date had its NOT NULL constraint dropped. To re-impose NOT NULL, verify
-- no NULL rows exist before executing:
-- UPDATE public.drhp_companies SET filing_date = CURRENT_DATE WHERE filing_date IS NULL;
-- ALTER TABLE public.drhp_companies ALTER COLUMN filing_date SET NOT NULL;


-- ------------------------------------------------------------------------------
-- 3. REVERT: public.unlisted_shares
-- ------------------------------------------------------------------------------

-- Drop auto-slug trigger and trigger function
DROP TRIGGER IF EXISTS trg_unlisted_shares_auto_slug ON public.unlisted_shares;
DROP FUNCTION IF EXISTS public.fn_unlisted_shares_auto_slug();

-- Drop indexes created during migration
DROP INDEX IF EXISTS public.idx_unlisted_shares_slug_unique;
DROP INDEX IF EXISTS public.idx_unlisted_shares_category;
DROP INDEX IF EXISTS public.idx_unlisted_shares_details_gin;

-- Drop check constraint
ALTER TABLE public.unlisted_shares
  DROP CONSTRAINT IF EXISTS chk_unlisted_shares_change_type;

-- Remove added columns
ALTER TABLE public.unlisted_shares
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS change_percent,
  DROP COLUMN IF EXISTS change_type,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS details;


-- ------------------------------------------------------------------------------
-- 4. REVERT: public.videos
-- ------------------------------------------------------------------------------

-- Drop search index
DROP INDEX IF EXISTS public.idx_videos_youtube_id;


-- ------------------------------------------------------------------------------
-- 5. REVERT: public.public_website_settings view (if rolling back to legacy baseline)
-- ------------------------------------------------------------------------------

DROP VIEW IF EXISTS public.public_website_settings CASCADE;

COMMIT;
```

---

## 4. Post-Rollback Verification Checklist

Run these queries to confirm that the schema has returned to its baseline state:

| Component | Verification Query | Expected Baseline State |
| :--- | :--- | :--- |
| `research_reports` table | `SELECT to_regclass('public.research_reports');` | `NULL` |
| `unlisted_shares` columns | `SELECT column_name FROM information_schema.columns WHERE table_name = 'unlisted_shares';` | Only baseline columns (`id`, `name`, `symbol`, `created_at`, etc.) |
| `drhp_companies` columns | `SELECT column_name FROM information_schema.columns WHERE table_name = 'drhp_companies';` | Only baseline columns |
| Auto-slug trigger | `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_unlisted_shares_auto_slug';` | 0 rows |
| CMS Application | Test `fetchUnlistedShares()` and `fetchDRHPCompanies()` in CMS UI | Renders without runtime exceptions |

---

## 5. Contact & Incident Reporting

- **Staging Database Administrator:** SW Development Lead
- **Escalation Path:** If data corruption is suspected, restore from the pre-migration snapshot rather than attempting manual column reconstruction.
