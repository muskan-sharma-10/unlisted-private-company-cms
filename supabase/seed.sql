-- ==============================================================================
-- Supabase Database Seed Data: Initial Mock Records
-- Run this AFTER applying 20261016_initial_content_schema.sql if you wish to
-- preload your existing sample records into Supabase.
-- ==============================================================================

-- 1. Unlisted Shares
INSERT INTO public.unlisted_shares (name, symbol, sector, current_price, lot_size, pe_ratio, market_cap_cr, status)
VALUES
  ('Tata Technologies Limited', 'TATATECH', 'Information Technology / Automotive', 1040, 50, 64.2, 42200, 'published'),
  ('Reliance Retail Ventures Ltd', 'RELRETAIL', 'Retail & Consumer Goods', 2850, 25, 98.4, 890000, 'published'),
  ('National Stock Exchange of India (NSE)', 'NSE', 'Financial Exchanges & Clearing', 6250, 10, 42.1, 310000, 'published'),
  ('HDB Financial Services', 'HDBFS', 'NBFC / Banking', 920, 50, 31.8, 72500, 'published'),
  ('boAt Lifestyle (Imagine Marketing)', 'BOAT', 'Consumer Electronics & Audio', 840, 100, 48.0, 6800, 'draft'),
  ('Swiggy Limited', 'SWIGGY', 'E-commerce & Quick Commerce', 470, 100, 0, 95000, 'draft')
ON CONFLICT (symbol) DO NOTHING;

-- 2. DRHP Companies
INSERT INTO public.drhp_companies (company_name, industry, issue_size_cr, filing_date, expected_date, lead_managers, status)
VALUES
  ('NTPC Green Energy Ltd', 'Renewable Power & Clean Energy', 10000, '2026-09-18', '2026-11-20', 'IDBI Capital, HDFC Bank, IIFL Securities', 'published'),
  ('Hyundai Motor India Ltd', 'Automobiles & EV Manufacturing', 27870, '2026-06-15', '2026-10-22', 'Kotak Mahindra, Morgan Stanley, Citigroup', 'published'),
  ('Waaree Energies Limited', 'Solar PV Modules & Solar Tech', 4320, '2026-07-29', '2026-10-28', 'Axis Capital, Jefferies, SBI Capital Markets', 'published'),
  ('Afcons Infrastructure Ltd', 'Infrastructure & EPC Construction', 7000, '2026-08-04', '2026-11-10', 'ICICI Securities, DAM Capital, Nomura', 'draft')
ON CONFLICT DO NOTHING;

-- 3. Blogs & Research Articles
INSERT INTO public.blogs (title, slug, category, author, read_time, excerpt, status, published_at)
VALUES
  (
    'How to Invest in Pre-IPO Shares in India: A Beginner’s Guide (2026)',
    'how-to-invest-pre-ipo-shares-india-guide',
    'Guides & Education',
    'Research Team',
    '6 min read',
    'Understand the step-by-step process of purchasing unlisted equity, Demat transfer, tax implications, and risk assessment.',
    'published',
    '2026-10-01 00:00:00+00'
  ),
  (
    'NSE Valuation Breakdown: Why Institutions are Accumulating Ahead of IPO',
    'nse-valuation-breakdown-institutional-accumulation',
    'Market Analysis',
    'Amitava Sen',
    '8 min read',
    'Detailed financial ratio breakdown of National Stock Exchange of India, trading volumes, and historical growth patterns.',
    'published',
    '2026-10-08 00:00:00+00'
  ),
  (
    'Upcoming Mega IPOs Expected in Q4: What Investors Must Watch',
    'upcoming-mega-ipos-q4-investor-watch',
    'IPO Radar',
    'Priya Sharma',
    '5 min read',
    'Analysis of major DRHP filings cleared by SEBI and their expected listing timeline and pre-IPO grey market premium.',
    'draft',
    NULL
  )
ON CONFLICT (slug) DO NOTHING;

-- 4. Videos
INSERT INTO public.videos (title, youtube_id, category, duration, status)
VALUES
  ('Unlisted Shares Demystified: Safe Demat Credit Process', 'dQw4w9WgXcQ', 'Educational', '14:20', 'published'),
  ('HDB Financial vs Tata Tech: Comparative Pre-IPO Analysis', 'jNQXAC9IVRw', 'Stock Analysis', '19:45', 'published'),
  ('Understanding DRHP: How to Read Red Herring Prospectus', 'kJQP7kiw5Fk', 'Tutorials', '22:10', 'draft')
ON CONFLICT DO NOTHING;

-- 5. Testimonials
INSERT INTO public.testimonials (client_name, role, company, rating, review, status)
VALUES
  ('Rajesh Mehra', 'HNI Investor', 'Mehra Family Office, Mumbai', 5, 'Seamless Demat transfer and transparent pricing for Tata Technologies and NSE shares. Highly professional service.', 'published'),
  ('Sanjay Varma', 'Managing Partner', 'Fintech Ventures', 5, 'Unlisted shares research provided before investing gave us clear visibility on valuation. Best platform in India.', 'published'),
  ('Dr. Anita Desai', 'Retail Investor', 'Bangalore', 4, 'Prompt support on WhatsApp and zero hassle with DIS delivery slip execution.', 'draft')
ON CONFLICT DO NOTHING;

-- 6. Homepage Content
INSERT INTO public.homepage_content (id, section_name, hero_headline, hero_subheadline, cta_text, cta_link, announcement_bar, show_announcement, status)
VALUES
  (
    'home-hero',
    'Hero & Primary Announcement',
    'India''s Most Trusted Gateway to Unlisted & Pre-IPO Equity',
    'Invest in tomorrow’s market leaders today with institutional research, verified Demat transfers, and transparent execution.',
    'Explore Available Shares',
    '/unlisted-shares',
    '🔥 New Pre-IPO Allocation Open: Reliance Retail & NSE Shares available for verified investors.',
    true,
    'published'
  )
ON CONFLICT (id) DO UPDATE SET
  hero_headline = EXCLUDED.hero_headline,
  hero_subheadline = EXCLUDED.hero_subheadline,
  cta_text = EXCLUDED.cta_text,
  cta_link = EXCLUDED.cta_link,
  announcement_bar = EXCLUDED.announcement_bar,
  show_announcement = EXCLUDED.show_announcement,
  status = EXCLUDED.status;

-- 7. Website Settings
INSERT INTO public.website_settings (id, site_title, support_email, support_phone, office_address, whatsapp_number, api_base_url, maintenance_mode)
VALUES
  (
    'global-settings',
    'Unlisted Private Company - Pre-IPO & DRHP Platform',
    'support@unlistedprivatecompany.com',
    '+91 98200 12345',
    'Bandra-Kurla Complex (BKC), Mumbai, Maharashtra 400051',
    '+91 98200 12345',
    'https://www.unlistedpond.com/api/admin',
    false
  )
ON CONFLICT (id) DO UPDATE SET
  site_title = EXCLUDED.site_title,
  support_email = EXCLUDED.support_email,
  support_phone = EXCLUDED.support_phone,
  office_address = EXCLUDED.office_address,
  whatsapp_number = EXCLUDED.whatsapp_number,
  api_base_url = EXCLUDED.api_base_url,
  maintenance_mode = EXCLUDED.maintenance_mode;
