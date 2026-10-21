-- ==============================================================================
-- Migration: Add optional company_url field to public.drhp_companies
-- Description: Adds company_url column to support official company website or
--              DRHP filing links in DRHP Companies & IPO Filings module.
-- ==============================================================================

ALTER TABLE public.drhp_companies
  ADD COLUMN IF NOT EXISTS company_url TEXT;

COMMENT ON COLUMN public.drhp_companies.company_url IS 'Optional company website, investor relations, or DRHP document URL';
