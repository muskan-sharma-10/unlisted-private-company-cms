'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import {
  fetchUnlistedShares,
  createUnlistedShare,
  updateUnlistedShare,
  deleteUnlistedShare,
} from '@/lib/supabase/api';
import { UnlistedShare, TableColumn } from '@/types';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { label: 'Popular / High Demand', value: 'Popular' },
  { label: 'Tech & SaaS', value: 'Tech & SaaS' },
  { label: 'Fintech & Banking', value: 'Fintech & Banking' },
  { label: 'Consumer & Retail', value: 'Consumer & Retail' },
  { label: 'EV & Clean Energy', value: 'EV & Clean Energy' },
  { label: 'Healthcare & Pharma', value: 'Healthcare & Pharma' },
  { label: 'Industrial & Infra', value: 'Industrial & Infra' },
];

export default function UnlistedSharesPage() {
  const [shares, setShares] = useState<UnlistedShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShare, setEditingShare] = useState<UnlistedShare | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<UnlistedShare | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Form State with complete evolved attributes
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    slug: '',
    sector: '',
    category: 'Popular',
    changePercent: '0.0%',
    changeType: 'up' as 'up' | 'down',
    logoUrl: '',
    currentPrice: '',
    lotSize: '50',
    peRatio: '',
    marketCapCr: '',
    status: 'draft' as 'draft' | 'published',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUnlistedShares();
      setShares(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load unlisted shares from database.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingShare(null);
    setFormData({
      name: '',
      symbol: '',
      slug: '',
      sector: '',
      category: 'Popular',
      changePercent: '0.0%',
      changeType: 'up',
      logoUrl: '',
      currentPrice: '',
      lotSize: '50',
      peRatio: '',
      marketCapCr: '',
      status: 'draft',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (share: UnlistedShare) => {
    setEditingShare(share);
    setFormData({
      name: share.name,
      symbol: share.symbol,
      slug: share.slug || '',
      sector: share.sector,
      category: share.category || 'Popular',
      changePercent: share.changePercent || '0.0%',
      changeType: share.changeType || 'up',
      logoUrl: share.logoUrl || '',
      currentPrice: String(share.currentPrice),
      lotSize: String(share.lotSize),
      peRatio: share.peRatio !== undefined ? String(share.peRatio) : '',
      marketCapCr: share.marketCapCr !== undefined ? String(share.marketCapCr) : '',
      status: share.status,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (share: UnlistedShare) => {
    const nextStatus = share.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await updateUnlistedShare(share.id, { status: nextStatus });
      setShares((prev) => prev.map((s) => (s.id === share.id ? updated : s)));
      setAlertInfo({
        type: 'success',
        message: `"${share.name}" status changed to ${nextStatus.toUpperCase()}.`,
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
      await deleteUnlistedShare(deleteConfirmItem.id);
      setShares((prev) => prev.filter((s) => s.id !== deleteConfirmItem.id));
      setAlertInfo({
        type: 'success',
        message: `Deleted "${deleteConfirmItem.name}" from Supabase database.`,
      });
      setDeleteConfirmItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete share record.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Company name is required';
    if (!formData.symbol.trim()) errors.symbol = 'Stock symbol is required';
    if (!formData.sector.trim()) errors.sector = 'Sector/Industry is required';
    if (!formData.currentPrice || isNaN(Number(formData.currentPrice)))
      errors.currentPrice = 'Valid share price is required';
    if (!formData.lotSize || isNaN(Number(formData.lotSize)))
      errors.lotSize = 'Valid lot size is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (editingShare) {
        const updated = await updateUnlistedShare(editingShare.id, {
          name: formData.name.trim(),
          symbol: formData.symbol.trim().toUpperCase(),
          slug: formData.slug ? formData.slug.trim().toLowerCase() : undefined,
          sector: formData.sector.trim(),
          category: formData.category,
          changePercent: formData.changePercent.trim() || '0.0%',
          changeType: formData.changeType,
          logoUrl: formData.logoUrl.trim() || undefined,
          currentPrice: parseFloat(formData.currentPrice),
          lotSize: parseInt(formData.lotSize, 10),
          peRatio: formData.peRatio ? parseFloat(formData.peRatio) : undefined,
          marketCapCr: formData.marketCapCr ? parseFloat(formData.marketCapCr) : undefined,
          status: formData.status,
        });

        setShares((prev) => prev.map((s) => (s.id === editingShare.id ? updated : s)));
        setAlertInfo({
          type: 'success',
          message: `Updated "${updated.name}" successfully in Supabase.`,
        });
      } else {
        const created = await createUnlistedShare({
          name: formData.name.trim(),
          symbol: formData.symbol.trim().toUpperCase(),
          slug: formData.slug ? formData.slug.trim().toLowerCase() : undefined,
          sector: formData.sector.trim(),
          category: formData.category,
          changePercent: formData.changePercent.trim() || '0.0%',
          changeType: formData.changeType,
          logoUrl: formData.logoUrl.trim() || undefined,
          currentPrice: parseFloat(formData.currentPrice),
          lotSize: parseInt(formData.lotSize, 10),
          peRatio: formData.peRatio ? parseFloat(formData.peRatio) : undefined,
          marketCapCr: formData.marketCapCr ? parseFloat(formData.marketCapCr) : undefined,
          status: formData.status,
        });

        setShares((prev) => [created, ...prev]);
        setAlertInfo({
          type: 'success',
          message: `Added "${created.name}" to directory in Supabase.`,
        });
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database operation failed.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: TableColumn<UnlistedShare>[] = [
    {
      key: 'name',
      header: 'Company / Stock',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.logoUrl}
              alt={item.name}
              className="h-8 w-8 rounded-lg object-contain bg-slate-800 p-1 border border-slate-700"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-indigo-400">
              {item.symbol.slice(0, 3)}
            </div>
          )}
          <div>
            <span className="font-semibold text-white block">{item.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-400 font-mono font-medium">
                {item.symbol}
              </span>
              {item.slug && (
                <span className="text-[11px] text-slate-500 font-mono">
                  /{item.slug}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          {item.category || 'Popular'}
        </span>
      ),
    },
    {
      key: 'sector',
      header: 'Sector',
      render: (item) => <span className="text-xs text-slate-300">{item.sector}</span>,
    },
    {
      key: 'currentPrice',
      header: 'Share Price',
      align: 'right',
      render: (item) => {
        const isUp = item.changeType === 'up';
        return (
          <div className="text-right">
            <span className="font-bold text-slate-100 block">
              ₹{item.currentPrice.toLocaleString('en-IN')}
            </span>
            {item.changePercent && (
              <span
                className={`inline-flex items-center text-[11px] font-medium ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUp ? (
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                )}
                {item.changePercent}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'lotSize',
      header: 'Min Lot',
      align: 'center',
      render: (item) => (
        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
          {item.lotSize} Qty
        </span>
      ),
    },
    {
      key: 'marketCapCr',
      header: 'Valuation',
      align: 'right',
      render: (item) => (
        <span className="text-xs text-slate-300">
          {item.marketCapCr ? `₹${item.marketCapCr.toLocaleString('en-IN')} Cr` : '—'}
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
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-300 font-medium">Loading unlisted shares from Supabase...</p>
        </div>
      ) : (
        <DataTable<UnlistedShare>
          title="Unlisted Shares Directory"
          description="Manage private equity stocks, indicative trading rates, categories, and minimum lot sizes."
          data={shares}
          columns={columns}
          searchPlaceholder="Search by company name, symbol, or category..."
          searchKey="name"
          addNewLabel="Add New Share"
          onAddNew={handleOpenAdd}
          onEdit={handleOpenEdit}
          onDelete={(item) => setDeleteConfirmItem(item)}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Add / Edit Share Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingShare ? `Edit ${editingShare.name}` : 'Add New Unlisted Share'}
        description="Enter stock valuation, categories, and trading parameters. Changes are committed directly to your Supabase PostgreSQL database."
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
              {editingShare ? 'Save Changes' : 'Create Record'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Company Name"
              placeholder="e.g. Reliance Retail Ventures Ltd"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
              required
            />

            <Input
              label="Trading Symbol / Ticker"
              placeholder="e.g. RELRETAIL"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              error={formErrors.symbol}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Industry / Sector"
              placeholder="e.g. Consumer Goods, Fintech, Automotive"
              value={formData.sector}
              onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
              error={formErrors.sector}
              required
            />

            <Select
              label="Platform Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={CATEGORY_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Indicative Price (₹)"
              type="number"
              placeholder="2850"
              value={formData.currentPrice}
              onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
              error={formErrors.currentPrice}
              required
            />

            <Input
              label="Price Change %"
              placeholder="e.g. +3.5% or -1.2%"
              value={formData.changePercent}
              onChange={(e) => setFormData({ ...formData, changePercent: e.target.value })}
            />

            <Select
              label="Change Direction"
              value={formData.changeType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  changeType: e.target.value as 'up' | 'down',
                })
              }
              options={[
                { label: 'Gain / Up (▲)', value: 'up' },
                { label: 'Loss / Down (▼)', value: 'down' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Minimum Lot Size"
              type="number"
              placeholder="25"
              value={formData.lotSize}
              onChange={(e) => setFormData({ ...formData, lotSize: e.target.value })}
              error={formErrors.lotSize}
              required
            />

            <Input
              label="P/E Ratio (Optional)"
              type="number"
              step="0.1"
              placeholder="45.5"
              value={formData.peRatio}
              onChange={(e) => setFormData({ ...formData, peRatio: e.target.value })}
            />

            <Input
              label="Market Cap (₹ Crores)"
              type="number"
              placeholder="85000"
              value={formData.marketCapCr}
              onChange={(e) => setFormData({ ...formData, marketCapCr: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Custom URL Slug (Optional)"
              placeholder="e.g. reliance-retail-unlisted-shares"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              helperText="Auto-generated if left blank."
            />

            <Input
              label="Logo URL (Optional)"
              placeholder="https://.../logo.png"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
            />
          </div>

          <div>
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
                { label: 'Published (Visible on live site)', value: 'published' },
                { label: 'Draft (Internal review only)', value: 'draft' },
              ]}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmItem}
        onClose={() => !isDeleting && setDeleteConfirmItem(null)}
        title="Confirm Removal"
        description="Are you sure you want to delete this unlisted share record? This change will be permanently deleted from Supabase."
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmItem(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Record
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Record to delete:{' '}
          <strong className="text-white font-semibold">
            {deleteConfirmItem?.name} ({deleteConfirmItem?.symbol})
          </strong>
        </p>
      </Modal>
    </div>
  );
}
