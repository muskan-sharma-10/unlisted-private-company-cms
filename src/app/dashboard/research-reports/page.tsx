'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import {
  fetchResearchReports,
  createResearchReport,
  updateResearchReport,
  deleteResearchReport,
} from '@/lib/supabase/api';
import { ResearchReport, TableColumn } from '@/types';
import { Loader2, FileText, ExternalLink } from 'lucide-react';

export default function ResearchReportsPage() {
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ResearchReport | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ResearchReport | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    reportType: 'Valuation Note',
    stockSlug: '',
    analyst: 'Private Market Research Desk',
    readTime: '6 min read',
    summary: '',
    keyTakeawaysText: '',
    content: '',
    pdfUrl: '',
    coverImage: '',
    status: 'draft' as 'draft' | 'published',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchResearchReports();
      setReports(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load research reports from Supabase.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingReport(null);
    setFormData({
      title: '',
      slug: '',
      reportType: 'Valuation Note',
      stockSlug: '',
      analyst: 'Private Market Research Desk',
      readTime: '6 min read',
      summary: '',
      keyTakeawaysText: '',
      content: '',
      pdfUrl: '',
      coverImage: '',
      status: 'draft',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (report: ResearchReport) => {
    setEditingReport(report);
    setFormData({
      title: report.title,
      slug: report.slug,
      reportType: report.reportType,
      stockSlug: report.stockSlug || '',
      analyst: report.analyst,
      readTime: report.readTime,
      summary: report.summary,
      keyTakeawaysText: Array.isArray(report.keyTakeaways) ? report.keyTakeaways.join('\n') : '',
      content: report.content || '',
      pdfUrl: report.pdfUrl || '',
      coverImage: report.coverImage || '',
      status: report.status,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (report: ResearchReport) => {
    const nextStatus = report.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await updateResearchReport(report.id, {
        status: nextStatus,
        publishedAt: nextStatus === 'published' ? new Date().toISOString() : undefined,
      });
      setReports((prev) => prev.map((r) => (r.id === report.id ? updated : r)));
      setAlertInfo({
        type: 'success',
        message: `"${report.title}" marked as ${nextStatus.toUpperCase()}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update publishing status.';
      setAlertInfo({ type: 'error', message: msg });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    try {
      await deleteResearchReport(deleteConfirmItem.id);
      setReports((prev) => prev.filter((r) => r.id !== deleteConfirmItem.id));
      setAlertInfo({
        type: 'success',
        message: `"${deleteConfirmItem.title}" successfully deleted.`,
      });
      setDeleteConfirmItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete research report.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Report title is required';
    if (!formData.slug.trim()) errors.slug = 'Route slug is required';
    if (!formData.summary.trim()) errors.summary = 'Executive summary is required';
    if (!formData.analyst.trim()) errors.analyst = 'Analyst designation is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const takeaways = formData.keyTakeawaysText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim().toLowerCase(),
        reportType: formData.reportType.trim(),
        stockSlug: formData.stockSlug.trim() || undefined,
        analyst: formData.analyst.trim(),
        readTime: formData.readTime.trim(),
        summary: formData.summary.trim(),
        keyTakeaways: takeaways,
        content: formData.content.trim() || undefined,
        pdfUrl: formData.pdfUrl.trim() || undefined,
        coverImage: formData.coverImage.trim() || undefined,
        status: formData.status,
        publishedAt: formData.status === 'published' ? new Date().toISOString() : undefined,
      };

      if (editingReport) {
        const updated = await updateResearchReport(editingReport.id, payload);
        setReports((prev) => prev.map((r) => (r.id === editingReport.id ? updated : r)));
        setAlertInfo({
          type: 'success',
          message: `Updated "${updated.title}" successfully in Supabase.`,
        });
      } else {
        const created = await createResearchReport(payload);
        setReports((prev) => [created, ...prev]);
        setAlertInfo({
          type: 'success',
          message: `Created "${created.title}" successfully in Supabase.`,
        });
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save research report to Supabase.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: TableColumn<ResearchReport>[] = [
    {
      key: 'title',
      header: 'Title & Type',
      render: (item) => (
        <div className="space-y-1">
          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>{item.title}</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[10px]">
              {item.reportType}
            </span>
            <span>/reports/{item.slug}</span>
            {item.stockSlug && (
              <span className="text-emerald-400 font-mono">Stock: {item.stockSlug}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'analyst',
      header: 'Analyst & Read Time',
      render: (item) => (
        <div className="text-xs space-y-0.5">
          <p className="text-slate-200 font-medium">{item.analyst}</p>
          <p className="text-slate-400">{item.readTime}</p>
        </div>
      ),
    },
    {
      key: 'viewsCount',
      header: 'Views',
      align: 'right',
      render: (item) => (
        <span className="text-xs font-mono text-slate-300">
          {(item.viewsCount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'pdfUrl',
      header: 'PDF Asset',
      render: (item) =>
        item.pdfUrl ? (
          <a
            href={item.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
          >
            <span>View PDF</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs text-slate-400">None attached</span>
        ),
    },
    {
      key: 'status',
      header: 'Publishing',
      render: (item) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${
            item.status === 'published'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}
        >
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {alertInfo && (
        <Alert
          variant={alertInfo.type}
          onClose={() => setAlertInfo(null)}
          title={alertInfo.type === 'success' ? 'Action Completed' : 'Database Error'}
        >
          {alertInfo.message}
        </Alert>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 border border-slate-800 rounded-xl space-y-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-300 font-medium">Loading research reports from Supabase...</p>
        </div>
      ) : (
        <DataTable<ResearchReport>
          title="Institutional Research & Valuation Reports"
          description="In-depth valuation notes, fundamental financial models, and sector coverage."
          data={reports}
          columns={columns}
          searchPlaceholder="Search report title, analyst, or stock slug..."
          searchKey="title"
          addNewLabel="Add Research Report"
          onAddNew={handleOpenAdd}
          onEdit={handleOpenEdit}
          onDelete={(item) => setDeleteConfirmItem(item)}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingReport ? `Edit ${editingReport.title}` : 'Add New Research Report'}
        description="Publish institutional-grade private market equity research to Supabase."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
              {editingReport ? 'Save Changes' : 'Publish Report'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Report Title"
            placeholder="e.g. Swiggy Ltd: Deep-Dive Pre-IPO Valuation Note"
            value={formData.title}
            onChange={(e) => {
              const val = e.target.value;
              setFormData({
                ...formData,
                title: val,
                slug: editingReport ? formData.slug : generateSlug(val),
              });
            }}
            error={formErrors.title}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="URL Route Slug"
              placeholder="e.g. swiggy-pre-ipo-valuation"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              error={formErrors.slug}
              required
            />

            <Select
              label="Report Category / Type"
              value={formData.reportType}
              onChange={(e) => setFormData({ ...formData, reportType: e.target.value })}
              options={[
                { label: 'Valuation Note', value: 'Valuation Note' },
                { label: 'Financial Deep Dive', value: 'Financial Deep Dive' },
                { label: 'Sector Analysis', value: 'Sector Analysis' },
                { label: 'Pre-IPO Teaser', value: 'Pre-IPO Teaser' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Linked Stock Slug (Optional)"
              placeholder="e.g. swiggy"
              value={formData.stockSlug}
              onChange={(e) => setFormData({ ...formData, stockSlug: e.target.value })}
              helperText="Links report to an unlisted share"
            />

            <Input
              label="Research Analyst"
              placeholder="e.g. Senior Tech Analyst"
              value={formData.analyst}
              onChange={(e) => setFormData({ ...formData, analyst: e.target.value })}
              error={formErrors.analyst}
              required
            />

            <Input
              label="Estimated Read Time"
              placeholder="e.g. 6 min read"
              value={formData.readTime}
              onChange={(e) => setFormData({ ...formData, readTime: e.target.value })}
            />
          </div>

          <Textarea
            label="Executive Summary"
            placeholder="Executive summary of research findings, target price band, and key investment catalysts..."
            rows={3}
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            error={formErrors.summary}
            required
          />

          <Textarea
            label="Key Takeaways (One bullet per line)"
            placeholder="Line 1: 34% YoY Revenue growth&#10;Line 2: EBITDA break-even achieved&#10;Line 3: 42% market share"
            rows={3}
            value={formData.keyTakeawaysText}
            onChange={(e) => setFormData({ ...formData, keyTakeawaysText: e.target.value })}
            helperText="Lines will be saved as an array in PostgreSQL"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Downloadable PDF URL"
              placeholder="https://.../research-note.pdf"
              value={formData.pdfUrl}
              onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
            />

            <Input
              label="Cover Image URL (Optional)"
              placeholder="https://.../cover.webp"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
            />
          </div>

          <Textarea
            label="Full Report Content (Markdown / HTML)"
            placeholder="Detailed narrative, balance sheet analysis, and forward guidance..."
            rows={4}
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          />

          <Select
            label="Publishing Status"
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as 'draft' | 'published',
              })
            }
            options={[
              { label: 'Draft (Internal Review)', value: 'draft' },
              { label: 'Published (Public Read via RLS)', value: 'published' },
            ]}
          />
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmItem}
        onClose={() => !isDeleting && setDeleteConfirmItem(null)}
        title="Confirm Removal"
        description="Are you sure you want to delete this research report? This will permanently remove the record from Supabase."
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmItem(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Report
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Report to delete:{' '}
          <strong className="text-white font-semibold">
            {deleteConfirmItem?.title}
          </strong>
        </p>
      </Modal>
    </div>
  );
}
