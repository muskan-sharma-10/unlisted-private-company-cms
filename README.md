# 🚀 Unlisted CMS — Standalone Admin Portal

A standalone, secure Content Management System (CMS) and Admin Panel built for **[unlisted-private-company.vercel.app](https://unlisted-private-company.vercel.app/)**.

Built with **Next.js 14 App Router**, **TypeScript**, **Tailwind CSS**, and **Supabase Authentication & PostgreSQL**.

---

## 📋 Features

- 🔒 **Secured Admin Authentication:** Supabase Auth integration with invite-only access (no public signups).
- 🛡️ **Zero Service-Role Leakage:** The CMS browser bundle never exposes the Supabase service-role key or direct destructive database credentials.
- 📊 **Executive Dashboard:** High-level metrics tracking published vs. draft unlisted equity shares, DRHP filings, research blogs, and video guides.
- 📑 **Comprehensive Section Management:**
  - **Unlisted Shares:** Add, edit, draft/publish, and delete pre-IPO stock listings (share price, lot size, P/E ratio, market cap).
  - **DRHP Companies:** Track Draft Red Herring Prospectus documents filed with SEBI (issue size, filing dates, merchant bankers).
  - **Editorial & Blogs:** Write and manage market analysis articles with automatic slug generation, SEO excerpts, and draft states.
  - **Video Library:** Embed YouTube market insights and educational videos.
  - **Client Testimonials:** Manage customer reviews with star ratings and verifications.
  - **Homepage Content:** Edit hero headlines, announcement banners, and CTA links with real-time interactive preview.
  - **System Settings:** Centralized configuration for contact information and target API endpoints.
- ⚡ **Reusable Component Library:** Modern dark-theme components with validation states, loading skeletons, responsive data tables, accessible modal dialogs, and status badges.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 14 (App Router)** | Full-stack React framework with server components and edge middleware |
| **TypeScript** | Type-safe entity definitions and compile-time verification |
| **Tailwind CSS** | Custom executive dark UI design system |
| **Lucide Icons** | Clean, minimalist iconography |
| **@supabase/ssr & @supabase/supabase-js** | Cookie-based session management and token verification |

---

## 🚀 Quick Start (Local Setup)

### 1. Clone & Install Dependencies

```bash
cd unlisted-cms
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
# Public Supabase credentials (safe for client-side use)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Existing public website API endpoint
NEXT_PUBLIC_MAIN_WEBSITE_URL=https://unlisted-private-company.vercel.app
NEXT_PUBLIC_API_BASE_URL=https://unlisted-private-company.vercel.app/api/admin
```

> ⚠️ **Important Security Rule:**
> NEVER put `SUPABASE_SERVICE_ROLE_KEY` inside `.env.local` or any `NEXT_PUBLIC_*` variable in this CMS project. That key belongs exclusively on your backend API server.

### 3. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.
- **Login Page:** `/login` (Demo credentials can be filled with one click during development).
- **Dashboard:** `/dashboard`

---

## 🗄️ Supabase PostgreSQL Setup & Database Schema

Run the following SQL migration script in your Supabase project under **SQL Editor**:

```sql
-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Unlisted Shares Table
CREATE TABLE public.unlisted_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  current_price NUMERIC(12, 2) NOT NULL,
  lot_size INTEGER NOT NULL DEFAULT 50,
  pe_ratio NUMERIC(6, 2),
  market_cap_cr NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create DRHP Filings Table
CREATE TABLE public.drhp_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  issue_size_cr NUMERIC(12, 2) NOT NULL,
  filing_date DATE NOT NULL,
  expected_date DATE,
  lead_managers TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Blogs Table
CREATE TABLE public.blogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Research Team',
  read_time TEXT NOT NULL DEFAULT '5 min read',
  excerpt TEXT NOT NULL,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create Videos Table
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  category TEXT NOT NULL,
  duration TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create Testimonials Table
CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  role TEXT NOT NULL,
  company TEXT,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  review TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Create Homepage Content Table
CREATE TABLE public.homepage_content (
  id TEXT PRIMARY KEY DEFAULT 'main-hero',
  hero_headline TEXT NOT NULL,
  hero_subheadline TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  cta_link TEXT NOT NULL,
  announcement_bar TEXT,
  show_announcement BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.unlisted_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drhp_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies: Public read-only for published content
CREATE POLICY "Public can view published shares" ON public.unlisted_shares
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can view published drhp" ON public.drhp_companies
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can view published blogs" ON public.blogs
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can view published videos" ON public.videos
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can view published testimonials" ON public.testimonials
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can view published homepage" ON public.homepage_content
  FOR SELECT USING (status = 'published');

-- 10. RLS Policies: Authenticated administrators have full write permissions
CREATE POLICY "Admins full access shares" ON public.unlisted_shares
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access drhp" ON public.drhp_companies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access blogs" ON public.blogs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access videos" ON public.videos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access testimonials" ON public.testimonials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access homepage" ON public.homepage_content
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 🔐 Cross-Domain API Architecture & Authentication Strategy

Since the CMS runs on its own domain (e.g., `cms.unlistedprivatecompany.com` or `unlisted-cms.vercel.app`) and the existing public site owns the API routes (`https://unlisted-private-company.vercel.app/api/admin/*`), here is the standard, secure token-based architecture:

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│     New Standalone CMS          │                 │     Existing Public Website     │
│   (unlisted-cms.vercel.app)     │                 │(unlisted-private-company.vercel)│
└────────────────┬────────────────┘                 └────────────────┬────────────────┘
                 │                                                   │
      1. Logs in with Supabase Auth                                  │
                 │                                                   │
      2. Obtains verified Supabase JWT                               │
         (access_token)                                              │
                 │                                                   │
                 │  3. fetch('https://.../api/admin/shares', {       │
                 │        headers: {                                 │
                 │           'Authorization': `Bearer ${token}`      │
                 │        }, body: ...                               │
                 │     })                                            │
                 ├──────────────────────────────────────────────────►│
                 │                                                   │
                 │                                        4. API Route verifies JWT
                 │                                           via Supabase Auth
                 │                                           supabase.auth.getUser(token)
                 │                                                   │
                 │                                        5. If valid admin:
                 │                                           performs DB write with
                 │                                           server credentials
                 │                                                   │
                 │  6. HTTP 200 OK / 201 Created                     │
                 │◄──────────────────────────────────────────────────┤
```

### Why this is secure:
1. **No Shared Frontend Secret:** No hardcoded secret or API key ever exists in the CMS client code.
2. **Cryptographically Signed JWT:** The CMS user logs in via Supabase Auth. Supabase issues a tamper-proof JSON Web Token (JWT).
3. **Stateless Verification:** The existing website API route simply takes the Bearer token, passes it to `supabase.auth.getUser(token)` on the server, and ensures the user has administrator privileges before executing any database operation.
4. **CORS Protected:** The existing website API allows CORS only from the designated CMS domain.

---

## ☁️ Deployment to Vercel

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: complete unlisted-cms admin panel UI and Supabase architecture"
   git remote add origin https://github.com/your-username/unlisted-cms.git
   git push -u origin main
   ```
2. In the [Vercel Dashboard](https://vercel.com):
   - Click **Add New Project** and select `unlisted-cms`.
   - Framework preset: **Next.js**.
   - Add Environment Variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_MAIN_WEBSITE_URL`
     - `NEXT_PUBLIC_API_BASE_URL`
   - Click **Deploy**.
