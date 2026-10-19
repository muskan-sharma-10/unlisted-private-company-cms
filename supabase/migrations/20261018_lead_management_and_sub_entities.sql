-- ==============================================================================
-- Supabase Database Migration: Lead Management, Partner Desk & Sub-Entities
-- Migration: 20261018_lead_management_and_sub_entities.sql
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PUBLIC LEAD ENQUIRIES TABLE
-- Captures Buy, Sell, ESOP Liquidity, and General Inquiries from Portal
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  enquiry_type text NOT NULL DEFAULT 'general', -- 'buy_order', 'sell_order', 'esop_liquidity', 'contact_inquiry', 'general'
  stock_symbol text,
  stock_name text,
  quantity integer,
  target_price numeric,
  pan_number text,
  demat_number text,
  message text,
  source_page text,
  status text NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'in_progress', 'converted', 'closed', 'rejected'
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER trigger_lead_enquiries_updated_at
  BEFORE UPDATE ON public.lead_enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_enquiries_status ON public.lead_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_lead_enquiries_created_at ON public.lead_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_enquiries_stock_symbol ON public.lead_enquiries(stock_symbol);

-- Enable RLS
ALTER TABLE public.lead_enquiries ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated visitors can submit leads (INSERT only)
CREATE POLICY "Public anonymous visitors can submit lead enquiries"
  ON public.lead_enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can view, update, delete lead enquiries
CREATE POLICY "Admins have full access to lead enquiries"
  ON public.lead_enquiries
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 2. PUBLIC PARTNER APPLICATIONS TABLE
-- Captures Sub-broker, Wealth Manager, CA, RIA partner desk applications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  organization_name text,
  partner_type text NOT NULL DEFAULT 'sub_broker', -- 'sub_broker', 'wealth_manager', 'investment_advisor', 'chartered_accountant', 'esop_trust'
  city text,
  client_base_size text,
  aum_range text,
  message text,
  status text NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'approved', 'rejected'
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER trigger_partner_applications_updated_at
  BEFORE UPDATE ON public.partner_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON public.partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at ON public.partner_applications(created_at DESC);

-- Enable RLS
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated visitors can submit partner applications
CREATE POLICY "Public anonymous visitors can submit partner applications"
  ON public.partner_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can view, update, delete partner applications
CREATE POLICY "Admins have full access to partner applications"
  ON public.partner_applications
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. PERMISSIONS / GRANTS
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.lead_enquiries TO anon, authenticated;
GRANT SELECT, INSERT ON public.partner_applications TO anon, authenticated;
GRANT ALL ON public.lead_enquiries TO service_role;
GRANT ALL ON public.partner_applications TO service_role;

COMMIT;
