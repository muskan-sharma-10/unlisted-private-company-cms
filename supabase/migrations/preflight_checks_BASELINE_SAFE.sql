-- Baseline-safe, read-only preflight. Run BEFORE migration.
-- It does not reference columns that may not exist yet.
WITH required(table_name, column_name) AS (VALUES
 ('unlisted_shares','id'), ('unlisted_shares','symbol'), ('unlisted_shares','name'),
 ('drhp_companies','company_name'), ('videos','youtube_id'), ('testimonials','client_name'), ('blogs','slug')
), checks AS (
 SELECT r.table_name, r.column_name,
        (c.column_name IS NOT NULL) AS present
 FROM required r
 LEFT JOIN information_schema.columns c
   ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
)
SELECT table_name, column_name,
       CASE WHEN present THEN 'OK' ELSE 'MISSING - migration may need schema reconciliation' END AS status
FROM checks
ORDER BY table_name, column_name;

SELECT 'research_reports table' AS check_name,
       CASE WHEN to_regclass('public.research_reports') IS NULL THEN 'Not present yet (expected before first migration)'
            ELSE 'Already exists: inspect schema before migration' END AS status;
