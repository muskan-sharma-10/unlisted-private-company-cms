export type PublishStatus = 'draft' | 'published';

export interface UnlistedShare {
  id: string;
  name: string;
  symbol: string;
  sector: string;
  currentPrice: number;
  lotSize: number;
  peRatio?: number;
  marketCapCr?: number;
  status: PublishStatus;
  updatedAt: string;
  slug?: string;
  category?: string;
  changePercent?: string;
  changeType?: 'up' | 'down';
  logoUrl?: string | null;
  details?: Record<string, unknown>;
}

export interface DRHPCompany {
  id: string;
  companyName: string;
  industry: string;
  issueSizeCr: number;
  filingDate?: string | null;
  expectedDate?: string | null;
  leadManagers: string;
  status: PublishStatus;
  updatedAt: string;
  slug?: string | null;
  regulatoryStatus?: string;
  statusType?: 'cleared' | 'approved' | 'review';
  filingDateText?: string | null;
  indicativePrice?: number | null;
  minLot?: number | null;
  description?: string | null;
}

export interface ResearchReport {
  id: string;
  title: string;
  slug: string;
  reportType: string;
  stockSlug?: string | null;
  analyst: string;
  readTime: string;
  viewsCount: number;
  summary: string;
  keyTakeaways: string[];
  content?: string | null;
  pdfUrl?: string | null;
  coverImage?: string | null;
  status: PublishStatus;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt: string;
}

export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  readTime: string;
  status: PublishStatus;
  publishedAt?: string;
  updatedAt: string;
  excerpt: string;
  content?: string;
}

export interface VideoContent {
  id: string;
  title: string;
  youtubeId: string;
  category: string;
  duration: string;
  status: PublishStatus;
  updatedAt: string;
}

export interface Testimonial {
  id: string;
  clientName: string;
  role: string;
  company?: string;
  rating: number;
  review: string;
  status: PublishStatus;
  updatedAt: string;
}

export interface HomepageSection {
  id: string;
  sectionName: string;
  heroHeadline: string;
  heroSubheadline: string;
  ctaText: string;
  ctaLink: string;
  announcementBar: string;
  showAnnouncement: boolean;
  status: PublishStatus;
  updatedAt: string;
}

export interface WebsiteSettings {
  siteTitle: string;
  supportEmail: string;
  supportPhone: string;
  officeAddress: string;
  whatsappNumber: string;
  apiBaseUrl: string;
  maintenanceMode: boolean;
}

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface LeadEnquiry {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
  enquiryType: string;
  stockSymbol?: string | null;
  stockName?: string | null;
  quantity?: number | null;
  targetPrice?: number | null;
  panNumber?: string | null;
  dematNumber?: string | null;
  message?: string | null;
  sourcePage?: string | null;
  status: 'new' | 'contacted' | 'in_progress' | 'converted' | 'closed' | 'rejected';
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  organizationName?: string | null;
  partnerType: string;
  city?: string | null;
  message?: string | null;
  status: 'new' | 'contacted' | 'approved' | 'rejected';
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

