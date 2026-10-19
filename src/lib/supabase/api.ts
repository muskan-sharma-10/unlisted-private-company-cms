import { createClient } from './client';
import type {
  UnlistedShare,
  DRHPCompany,
  BlogArticle,
  VideoContent,
  Testimonial,
  HomepageSection,
  WebsiteSettings,
  PublishStatus,
  ResearchReport,
} from '@/types';
import { initialHomepageContent, initialSettings } from '@/lib/mock-data';

function getClient() {
  const client = createClient();
  if (!client) {
    throw new Error(
      'Supabase client is not configured. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in .env.local'
    );
  }
  return client;
}

// ==============================================================================
// 1. UNLISTED SHARES CRUD
// ==============================================================================

export async function fetchUnlistedShares(): Promise<UnlistedShare[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('unlisted_shares')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase API] fetchUnlistedShares error:', error);
    throw new Error(error.message || 'Failed to fetch unlisted shares');
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    sector: row.sector,
    currentPrice: Number(row.current_price),
    lotSize: Number(row.lot_size),
    peRatio: row.pe_ratio !== null && row.pe_ratio !== undefined ? Number(row.pe_ratio) : undefined,
    marketCapCr:
      row.market_cap_cr !== null && row.market_cap_cr !== undefined
        ? Number(row.market_cap_cr)
        : undefined,
    status: row.status as PublishStatus,
    updatedAt: row.updated_at ? row.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
    slug: row.slug || undefined,
    category: row.category || 'Popular',
    changePercent: row.change_percent || '0.0%',
    changeType: (row.change_type as 'up' | 'down') || 'up',
    logoUrl: row.logo_url || undefined,
    details: row.details || {},
  }));
}

export async function createUnlistedShare(
  share: Omit<UnlistedShare, 'id' | 'updatedAt'>
): Promise<UnlistedShare> {
  const supabase = getClient();
  const payload: Record<string, unknown> = {
    name: share.name.trim(),
    symbol: share.symbol.trim().toUpperCase(),
    sector: share.sector.trim(),
    current_price: share.currentPrice,
    lot_size: share.lotSize,
    pe_ratio: share.peRatio !== undefined ? share.peRatio : null,
    market_cap_cr: share.marketCapCr !== undefined ? share.marketCapCr : null,
    status: share.status,
    category: share.category || 'Popular',
    change_percent: share.changePercent || '0.0%',
    change_type: share.changeType || 'up',
    logo_url: share.logoUrl || null,
  };

  if (share.slug && share.slug.trim()) {
    payload.slug = share.slug.trim().toLowerCase();
  }

  const { data, error } = await supabase
    .from('unlisted_shares')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] createUnlistedShare error:', error);
    throw new Error(error.message || 'Failed to create unlisted share');
  }

  return {
    id: data.id,
    name: data.name,
    symbol: data.symbol,
    sector: data.sector,
    currentPrice: Number(data.current_price),
    lotSize: Number(data.lot_size),
    peRatio: data.pe_ratio !== null && data.pe_ratio !== undefined ? Number(data.pe_ratio) : undefined,
    marketCapCr:
      data.market_cap_cr !== null && data.market_cap_cr !== undefined
        ? Number(data.market_cap_cr)
        : undefined,
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
    slug: data.slug || undefined,
    category: data.category || 'Popular',
    changePercent: data.change_percent || '0.0%',
    changeType: (data.change_type as 'up' | 'down') || 'up',
    logoUrl: data.logo_url || undefined,
    details: data.details || {},
  };
}

export async function updateUnlistedShare(
  id: string,
  share: Partial<UnlistedShare>
): Promise<UnlistedShare> {
  const supabase = getClient();
  const payload: Record<string, unknown> = {};

  if (share.name !== undefined) payload.name = share.name.trim();
  if (share.symbol !== undefined) payload.symbol = share.symbol.trim().toUpperCase();
  if (share.sector !== undefined) payload.sector = share.sector.trim();
  if (share.currentPrice !== undefined) payload.current_price = share.currentPrice;
  if (share.lotSize !== undefined) payload.lot_size = share.lotSize;
  if (share.peRatio !== undefined) payload.pe_ratio = share.peRatio;
  if (share.marketCapCr !== undefined) payload.market_cap_cr = share.marketCapCr;
  if (share.status !== undefined) payload.status = share.status;
  if (share.category !== undefined) payload.category = share.category;
  if (share.changePercent !== undefined) payload.change_percent = share.changePercent;
  if (share.changeType !== undefined) payload.change_type = share.changeType;
  if (share.logoUrl !== undefined) payload.logo_url = share.logoUrl;
  if (share.slug !== undefined) payload.slug = share.slug.trim().toLowerCase();
  if (share.details !== undefined) payload.details = share.details;

  const { data, error } = await supabase
    .from('unlisted_shares')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] updateUnlistedShare error:', error);
    throw new Error(error.message || 'Failed to update unlisted share');
  }

  return {
    id: data.id,
    name: data.name,
    symbol: data.symbol,
    sector: data.sector,
    currentPrice: Number(data.current_price),
    lotSize: Number(data.lot_size),
    peRatio: data.pe_ratio !== null && data.pe_ratio !== undefined ? Number(data.pe_ratio) : undefined,
    marketCapCr:
      data.market_cap_cr !== null && data.market_cap_cr !== undefined
        ? Number(data.market_cap_cr)
        : undefined,
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
    slug: data.slug || undefined,
    category: data.category || 'Popular',
    changePercent: data.change_percent || '0.0%',
    changeType: (data.change_type as 'up' | 'down') || 'up',
    logoUrl: data.logo_url || undefined,
    details: data.details || {},
  };
}

export async function deleteUnlistedShare(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('unlisted_shares').delete().eq('id', id);

  if (error) {
    console.error('[Supabase API] deleteUnlistedShare error:', error);
    throw new Error(error.message || 'Failed to delete unlisted share');
  }
}

// ==============================================================================
// 2. DRHP COMPANIES CRUD
// ==============================================================================

export async function fetchDRHPCompanies(): Promise<DRHPCompany[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('drhp_companies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase API] fetchDRHPCompanies error:', error);
    throw new Error(error.message || 'Failed to fetch DRHP companies');
  }

  return (data || []).map((row) => ({
    id: row.id,
    companyName: row.company_name,
    industry: row.industry,
    issueSizeCr: Number(row.issue_size_cr),
    filingDate: row.filing_date || null,
    expectedDate: row.expected_date || undefined,
    leadManagers: row.lead_managers,
    status: row.status as PublishStatus,
    updatedAt: row.updated_at ? row.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
    slug: row.slug || undefined,
    regulatoryStatus: row.regulatory_status || 'Under Review',
    statusType: row.status_type || 'review',
    filingDateText: row.filing_date_text || undefined,
    indicativePrice: row.indicative_price !== null && row.indicative_price !== undefined ? Number(row.indicative_price) : undefined,
    minLot: row.min_lot !== null && row.min_lot !== undefined ? Number(row.min_lot) : 1,
    description: row.description || undefined,
  }));
}

export async function createDRHPCompany(
  company: Omit<DRHPCompany, 'id' | 'updatedAt'>
): Promise<DRHPCompany> {
  const supabase = getClient();
  const payload = {
    company_name: company.companyName.trim(),
    industry: company.industry.trim(),
    issue_size_cr: company.issueSizeCr,
    filing_date: company.filingDate ? company.filingDate : null,
    filing_date_text: company.filingDateText?.trim() || null,
    regulatory_status: company.regulatoryStatus?.trim() || 'Under Review',
    status_type: company.statusType || 'review',
    indicative_price: company.indicativePrice !== undefined && company.indicativePrice !== null ? company.indicativePrice : null,
    min_lot: company.minLot !== undefined && company.minLot !== null ? company.minLot : 1,
    description: company.description?.trim() || null,
    expected_date: company.expectedDate ? company.expectedDate : null,
    lead_managers: company.leadManagers.trim(),
    status: company.status,
  };

  const { data, error } = await supabase
    .from('drhp_companies')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] createDRHPCompany error:', error);
    throw new Error(error.message || 'Failed to create DRHP company');
  }

  return {
    id: data.id,
    companyName: data.company_name,
    industry: data.industry,
    issueSizeCr: Number(data.issue_size_cr),
    filingDate: data.filing_date || null,
    expectedDate: data.expected_date || undefined,
    leadManagers: data.lead_managers,
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
    slug: data.slug || undefined,
    regulatoryStatus: data.regulatory_status || 'Under Review',
    statusType: data.status_type || 'review',
    filingDateText: data.filing_date_text || undefined,
    indicativePrice: data.indicative_price !== null && data.indicative_price !== undefined ? Number(data.indicative_price) : undefined,
    minLot: data.min_lot !== null && data.min_lot !== undefined ? Number(data.min_lot) : 1,
    description: data.description || undefined,
  };
}

export async function updateDRHPCompany(
  id: string,
  company: Partial<DRHPCompany>
): Promise<DRHPCompany> {
  const supabase = getClient();
  const payload: Record<string, unknown> = {};

  if (company.companyName !== undefined) payload.company_name = company.companyName.trim();
  if (company.industry !== undefined) payload.industry = company.industry.trim();
  if (company.issueSizeCr !== undefined) payload.issue_size_cr = company.issueSizeCr;
  if (company.filingDate !== undefined) payload.filing_date = company.filingDate ? company.filingDate : null;
  if (company.filingDateText !== undefined) payload.filing_date_text = company.filingDateText?.trim() || null;
  if (company.regulatoryStatus !== undefined) payload.regulatory_status = company.regulatoryStatus.trim();
  if (company.statusType !== undefined) payload.status_type = company.statusType;
  if (company.indicativePrice !== undefined) payload.indicative_price = company.indicativePrice;
  if (company.minLot !== undefined) payload.min_lot = company.minLot;
  if (company.description !== undefined) payload.description = company.description?.trim() || null;
  if (company.expectedDate !== undefined) payload.expected_date = company.expectedDate || null;
  if (company.leadManagers !== undefined) payload.lead_managers = company.leadManagers.trim();
  if (company.status !== undefined) payload.status = company.status;

  const { data, error } = await supabase
    .from('drhp_companies')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] updateDRHPCompany error:', error);
    throw new Error(error.message || 'Failed to update DRHP company');
  }

  return {
    id: data.id,
    companyName: data.company_name,
    industry: data.industry,
    issueSizeCr: Number(data.issue_size_cr),
    filingDate: data.filing_date || null,
    expectedDate: data.expected_date || undefined,
    leadManagers: data.lead_managers,
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
    slug: data.slug || undefined,
    regulatoryStatus: data.regulatory_status || 'Under Review',
    statusType: data.status_type || 'review',
    filingDateText: data.filing_date_text || undefined,
    indicativePrice: data.indicative_price !== null && data.indicative_price !== undefined ? Number(data.indicative_price) : undefined,
    minLot: data.min_lot !== null && data.min_lot !== undefined ? Number(data.min_lot) : 1,
    description: data.description || undefined,
  };
}

export async function deleteDRHPCompany(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('drhp_companies').delete().eq('id', id);

  if (error) {
    console.error('[Supabase API] deleteDRHPCompany error:', error);
    throw new Error(error.message || 'Failed to delete DRHP company');
  }
}

// ==============================================================================
// 3. BLOGS CRUD
// ==============================================================================

export async function fetchBlogs(): Promise<BlogArticle[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('blogs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase API] fetchBlogs error:', error);
    throw new Error(error.message || 'Failed to fetch blog articles');
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    author: row.author,
    readTime: row.read_time,
    excerpt: row.excerpt,
    content: row.content || undefined,
    status: row.status as PublishStatus,
    publishedAt: row.published_at || undefined,
    updatedAt: row.updated_at ? row.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  }));
}

export async function createBlog(
  blog: Omit<BlogArticle, 'id' | 'updatedAt'>
): Promise<BlogArticle> {
  const supabase = getClient();
  const payload = {
    title: blog.title.trim(),
    slug: blog.slug.trim(),
    category: blog.category.trim(),
    author: blog.author.trim() || 'Research Team',
    read_time: blog.readTime.trim() || '5 min read',
    excerpt: blog.excerpt.trim(),
    content: blog.content || null,
    status: blog.status,
    published_at: blog.status === 'published' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase.from('blogs').insert(payload).select().single();

  if (error) {
    console.error('[Supabase API] createBlog error:', error);
    throw new Error(error.message || 'Failed to create blog article');
  }

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    category: data.category,
    author: data.author,
    readTime: data.read_time,
    excerpt: data.excerpt,
    content: data.content || undefined,
    status: data.status as PublishStatus,
    publishedAt: data.published_at || undefined,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function updateBlog(
  id: string,
  blog: Partial<BlogArticle>
): Promise<BlogArticle> {
  const supabase = getClient();
  const payload: Record<string, unknown> = {};

  if (blog.title !== undefined) payload.title = blog.title.trim();
  if (blog.slug !== undefined) payload.slug = blog.slug.trim();
  if (blog.category !== undefined) payload.category = blog.category.trim();
  if (blog.author !== undefined) payload.author = blog.author.trim();
  if (blog.readTime !== undefined) payload.read_time = blog.readTime.trim();
  if (blog.excerpt !== undefined) payload.excerpt = blog.excerpt.trim();
  if (blog.content !== undefined) payload.content = blog.content || null;
  if (blog.status !== undefined) {
    payload.status = blog.status;
    if (blog.status === 'published' && !blog.publishedAt) {
      payload.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('blogs')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] updateBlog error:', error);
    throw new Error(error.message || 'Failed to update blog article');
  }

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    category: data.category,
    author: data.author,
    readTime: data.read_time,
    excerpt: data.excerpt,
    content: data.content || undefined,
    status: data.status as PublishStatus,
    publishedAt: data.published_at || undefined,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function deleteBlog(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('blogs').delete().eq('id', id);

  if (error) {
    console.error('[Supabase API] deleteBlog error:', error);
    throw new Error(error.message || 'Failed to delete blog article');
  }
}

// ==============================================================================
// 3b. RESEARCH REPORTS CRUD
// ==============================================================================

export async function fetchResearchReports(): Promise<ResearchReport[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('research_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (
      error.code === 'PGRST205' ||
      error.message?.includes('schema cache') ||
      error.message?.includes('does not exist')
    ) {
      console.warn(
        '[Supabase API] research_reports table not found in schema cache. Run supabase/release/02_migration.sql to create it.'
      );
      return [];
    }
    console.error('[Supabase API] fetchResearchReports error:', error);
    throw new Error(error.message || 'Failed to fetch research reports');
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    reportType: row.report_type || 'Valuation Note',
    stockSlug: row.stock_slug || undefined,
    analyst: row.analyst || 'Private Market Research Desk',
    readTime: row.read_time || '6 min read',
    viewsCount: Number(row.views_count || 0),
    summary: row.summary,
    keyTakeaways: Array.isArray(row.key_takeaways) ? row.key_takeaways : [],
    content: row.content || undefined,
    pdfUrl: row.pdf_url || undefined,
    coverImage: row.cover_image || undefined,
    status: row.status as PublishStatus,
    publishedAt: row.published_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ? row.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  }));
}

export async function createResearchReport(
  report: Omit<ResearchReport, 'id' | 'updatedAt' | 'viewsCount' | 'createdAt'>
): Promise<ResearchReport> {
  const supabase = getClient();
  const payload = {
    title: report.title.trim(),
    slug: report.slug.trim().toLowerCase(),
    report_type: report.reportType.trim() || 'Valuation Note',
    stock_slug: report.stockSlug?.trim() || null,
    analyst: report.analyst.trim() || 'Private Market Research Desk',
    read_time: report.readTime.trim() || '6 min read',
    summary: report.summary.trim(),
    key_takeaways: report.keyTakeaways || [],
    content: report.content || null,
    pdf_url: report.pdfUrl?.trim() || null,
    cover_image: report.coverImage?.trim() || null,
    status: report.status,
    published_at: report.status === 'published' ? report.publishedAt || new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('research_reports')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] createResearchReport error:', error);
    throw new Error(error.message || 'Failed to create research report');
  }

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    reportType: data.report_type,
    stockSlug: data.stock_slug || undefined,
    analyst: data.analyst,
    readTime: data.read_time,
    viewsCount: Number(data.views_count || 0),
    summary: data.summary,
    keyTakeaways: Array.isArray(data.key_takeaways) ? data.key_takeaways : [],
    content: data.content || undefined,
    pdfUrl: data.pdf_url || undefined,
    coverImage: data.cover_image || undefined,
    status: data.status as PublishStatus,
    publishedAt: data.published_at || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function updateResearchReport(
  id: string,
  report: Partial<ResearchReport>
): Promise<ResearchReport> {
  const supabase = getClient();
  const payload: Record<string, unknown> = {};

  if (report.title !== undefined) payload.title = report.title.trim();
  if (report.slug !== undefined) payload.slug = report.slug.trim().toLowerCase();
  if (report.reportType !== undefined) payload.report_type = report.reportType.trim();
  if (report.stockSlug !== undefined) payload.stock_slug = report.stockSlug?.trim() || null;
  if (report.analyst !== undefined) payload.analyst = report.analyst.trim();
  if (report.readTime !== undefined) payload.read_time = report.readTime.trim();
  if (report.summary !== undefined) payload.summary = report.summary.trim();
  if (report.keyTakeaways !== undefined) payload.key_takeaways = report.keyTakeaways;
  if (report.content !== undefined) payload.content = report.content || null;
  if (report.pdfUrl !== undefined) payload.pdf_url = report.pdfUrl?.trim() || null;
  if (report.coverImage !== undefined) payload.cover_image = report.coverImage?.trim() || null;
  if (report.status !== undefined) {
    payload.status = report.status;
    if (report.status === 'published' && !report.publishedAt) {
      payload.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('research_reports')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] updateResearchReport error:', error);
    throw new Error(error.message || 'Failed to update research report');
  }

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    reportType: data.report_type,
    stockSlug: data.stock_slug || undefined,
    analyst: data.analyst,
    readTime: data.read_time,
    viewsCount: Number(data.views_count || 0),
    summary: data.summary,
    keyTakeaways: Array.isArray(data.key_takeaways) ? data.key_takeaways : [],
    content: data.content || undefined,
    pdfUrl: data.pdf_url || undefined,
    coverImage: data.cover_image || undefined,
    status: data.status as PublishStatus,
    publishedAt: data.published_at || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function deleteResearchReport(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('research_reports').delete().eq('id', id);

  if (error) {
    console.error('[Supabase API] deleteResearchReport error:', error);
    throw new Error(error.message || 'Failed to delete research report');
  }
}

// ==============================================================================
// 4. VIDEOS CRUD
// ==============================================================================

export async function fetchVideos(): Promise<VideoContent[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase API] fetchVideos error:', error);
    throw new Error(error.message || 'Failed to fetch videos');
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    youtubeId: row.youtube_id,
    category: row.category,
    duration: row.duration,
    status: row.status as PublishStatus,
    updatedAt: row.updated_at ? row.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  }));
}

export async function createVideo(
  video: Omit<VideoContent, 'id' | 'updatedAt'>
): Promise<VideoContent> {
  const supabase = getClient();
  const payload = {
    title: video.title.trim(),
    youtube_id: video.youtubeId.trim(),
    category: video.category.trim() || 'Educational',
    duration: video.duration.trim() || '10:00',
    status: video.status,
  };

  const { data, error } = await supabase.from('videos').insert(payload).select().single();

  if (error) {
    console.error('[Supabase API] createVideo error:', error);
    throw new Error(error.message || 'Failed to create video record');
  }

  return {
    id: data.id,
    title: data.title,
    youtubeId: data.youtube_id,
    category: data.category,
    duration: data.duration,
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function updateVideo(
  id: string,
  video: Partial<VideoContent>
): Promise<VideoContent> {
  const supabase = getClient();
  const payload: Record<string, unknown> = {};

  if (video.title !== undefined) payload.title = video.title.trim();
  if (video.youtubeId !== undefined) payload.youtube_id = video.youtubeId.trim();
  if (video.category !== undefined) payload.category = video.category.trim();
  if (video.duration !== undefined) payload.duration = video.duration.trim();
  if (video.status !== undefined) payload.status = video.status;

  const { data, error } = await supabase
    .from('videos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] updateVideo error:', error);
    throw new Error(error.message || 'Failed to update video record');
  }

  return {
    id: data.id,
    title: data.title,
    youtubeId: data.youtube_id,
    category: data.category,
    duration: data.duration,
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function deleteVideo(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('videos').delete().eq('id', id);

  if (error) {
    console.error('[Supabase API] deleteVideo error:', error);
    throw new Error(error.message || 'Failed to delete video');
  }
}

// ==============================================================================
// 5. TESTIMONIALS CRUD
// ==============================================================================

export async function fetchTestimonials(): Promise<Testimonial[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase API] fetchTestimonials error:', error);
    throw new Error(error.message || 'Failed to fetch testimonials');
  }

  return (data || []).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    role: row.role,
    company: row.company || undefined,
    rating: Number(row.rating),
    review: row.review,
    status: row.status as PublishStatus,
    updatedAt: row.updated_at ? row.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  }));
}

export async function createTestimonial(
  testimonial: Omit<Testimonial, 'id' | 'updatedAt'>
): Promise<Testimonial> {
  const supabase = getClient();
  const payload = {
    client_name: testimonial.clientName.trim(),
    role: testimonial.role.trim() || 'Investor',
    company: testimonial.company?.trim() || null,
    rating: testimonial.rating,
    review: testimonial.review.trim(),
    status: testimonial.status,
  };

  const { data, error } = await supabase.from('testimonials').insert(payload).select().single();

  if (error) {
    console.error('[Supabase API] createTestimonial error:', error);
    throw new Error(error.message || 'Failed to create testimonial');
  }

  return {
    id: data.id,
    clientName: data.client_name,
    role: data.role,
    company: data.company || undefined,
    rating: Number(data.rating),
    review: data.review,
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function updateTestimonial(
  id: string,
  testimonial: Partial<Testimonial>
): Promise<Testimonial> {
  const supabase = getClient();
  const payload: Record<string, unknown> = {};

  if (testimonial.clientName !== undefined) payload.client_name = testimonial.clientName.trim();
  if (testimonial.role !== undefined) payload.role = testimonial.role.trim();
  if (testimonial.company !== undefined) payload.company = testimonial.company?.trim() || null;
  if (testimonial.rating !== undefined) payload.rating = testimonial.rating;
  if (testimonial.review !== undefined) payload.review = testimonial.review.trim();
  if (testimonial.status !== undefined) payload.status = testimonial.status;

  const { data, error } = await supabase
    .from('testimonials')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] updateTestimonial error:', error);
    throw new Error(error.message || 'Failed to update testimonial');
  }

  return {
    id: data.id,
    clientName: data.client_name,
    role: data.role,
    company: data.company || undefined,
    rating: Number(data.rating),
    review: data.review,
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function deleteTestimonial(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('testimonials').delete().eq('id', id);

  if (error) {
    console.error('[Supabase API] deleteTestimonial error:', error);
    throw new Error(error.message || 'Failed to delete testimonial');
  }
}

// ==============================================================================
// 6. HOMEPAGE CONTENT
// ==============================================================================

export async function fetchHomepageContent(): Promise<HomepageSection> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('homepage_content')
    .select('*')
    .eq('id', 'home-hero')
    .maybeSingle();

  if (error) {
    console.error('[Supabase API] fetchHomepageContent error:', error);
    throw new Error(error.message || 'Failed to fetch homepage content');
  }

  if (!data) {
    // Return default initial content if not yet seeded
    return initialHomepageContent;
  }

  return {
    id: data.id,
    sectionName: data.section_name,
    heroHeadline: data.hero_headline,
    heroSubheadline: data.hero_subheadline,
    ctaText: data.cta_text,
    ctaLink: data.cta_link,
    announcementBar: data.announcement_bar || '',
    showAnnouncement: Boolean(data.show_announcement),
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function updateHomepageContent(
  content: Partial<HomepageSection>
): Promise<HomepageSection> {
  const supabase = getClient();
  const payload = {
    id: 'home-hero',
    section_name: content.sectionName || 'Hero & Primary Announcement',
    hero_headline: content.heroHeadline || '',
    hero_subheadline: content.heroSubheadline || '',
    cta_text: content.ctaText || 'Explore Available Shares',
    cta_link: content.ctaLink || '/unlisted-shares',
    announcement_bar: content.announcementBar || null,
    show_announcement: content.showAnnouncement !== undefined ? content.showAnnouncement : true,
    status: content.status || 'published',
  };

  const { data, error } = await supabase
    .from('homepage_content')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] updateHomepageContent error:', error);
    throw new Error(error.message || 'Failed to update homepage content');
  }

  return {
    id: data.id,
    sectionName: data.section_name,
    heroHeadline: data.hero_headline,
    heroSubheadline: data.hero_subheadline,
    ctaText: data.cta_text,
    ctaLink: data.cta_link,
    announcementBar: data.announcement_bar || '',
    showAnnouncement: Boolean(data.show_announcement),
    status: data.status as PublishStatus,
    updatedAt: data.updated_at ? data.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

// ==============================================================================
// 7. WEBSITE SETTINGS
// ==============================================================================

export async function fetchWebsiteSettings(): Promise<WebsiteSettings> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('website_settings')
    .select('*')
    .eq('id', 'global-settings')
    .maybeSingle();

  if (error) {
    console.error('[Supabase API] fetchWebsiteSettings error:', error);
    throw new Error(error.message || 'Failed to fetch website settings');
  }

  if (!data) {
    return initialSettings;
  }

  return {
    siteTitle: data.site_title,
    supportEmail: data.support_email,
    supportPhone: data.support_phone,
    officeAddress: data.office_address,
    whatsappNumber: data.whatsapp_number,
    apiBaseUrl: data.api_base_url,
    maintenanceMode: Boolean(data.maintenance_mode),
  };
}

export async function updateWebsiteSettings(
  settings: Partial<WebsiteSettings>
): Promise<WebsiteSettings> {
  const supabase = getClient();
  const payload = {
    id: 'global-settings',
    site_title: settings.siteTitle || initialSettings.siteTitle,
    support_email: settings.supportEmail || initialSettings.supportEmail,
    support_phone: settings.supportPhone || initialSettings.supportPhone,
    office_address: settings.officeAddress || initialSettings.officeAddress,
    whatsapp_number: settings.whatsappNumber || initialSettings.whatsappNumber,
    api_base_url: settings.apiBaseUrl || initialSettings.apiBaseUrl,
    maintenance_mode:
      settings.maintenanceMode !== undefined ? settings.maintenanceMode : initialSettings.maintenanceMode,
  };

  const { data, error } = await supabase
    .from('website_settings')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Supabase API] updateWebsiteSettings error:', error);
    throw new Error(error.message || 'Failed to update website settings');
  }

  return {
    siteTitle: data.site_title,
    supportEmail: data.support_email,
    supportPhone: data.support_phone,
    officeAddress: data.office_address,
    whatsappNumber: data.whatsapp_number,
    apiBaseUrl: data.api_base_url,
    maintenanceMode: Boolean(data.maintenance_mode),
  };
}

// ==============================================================================
// 8. DASHBOARD OVERVIEW METRICS
// ==============================================================================

export interface DashboardMetrics {
  shares: { published: number; draft: number; total: number };
  drhp: { published: number; draft: number; total: number };
  reports: { published: number; draft: number; total: number };
  blogs: { published: number; draft: number; total: number };
  videos: { published: number; draft: number; total: number };
  testimonials: { published: number; draft: number; total: number };
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = getClient();

  // Run in parallel for fast loading
  const [sharesRes, drhpRes, reportsRes, blogsRes, videosRes, testimonialsRes] = await Promise.all([
    supabase.from('unlisted_shares').select('status'),
    supabase.from('drhp_companies').select('status'),
    supabase.from('research_reports').select('status'),
    supabase.from('blogs').select('status'),
    supabase.from('videos').select('status'),
    supabase.from('testimonials').select('status'),
  ]);

  const countByStatus = (data: { status: string }[] | null) => {
    const list = data || [];
    const published = list.filter((item) => item.status === 'published').length;
    const draft = list.filter((item) => item.status === 'draft').length;
    return { published, draft, total: list.length };
  };

  return {
    shares: countByStatus(sharesRes.data),
    drhp: countByStatus(drhpRes.data),
    reports: countByStatus(reportsRes.data),
    blogs: countByStatus(blogsRes.data),
    videos: countByStatus(videosRes.data),
    testimonials: countByStatus(testimonialsRes.data),
  };
}
