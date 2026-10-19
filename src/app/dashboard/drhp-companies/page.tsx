'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import {
  fetchDRHPCompanies,
  createDRHPCompany,
  updateDRHPCompany,
  deleteDRHPCompany,
} from '@/lib/supabase/api';
import { DRHPCompany, TableColumn } from '@/types';
import { Loader2 } from 'lucide-react';

export default function DRHPCompaniesPage() {
  const [companies, setCompanies] = useState<DRHPCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<DRHPCompany | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<DRHPCompany | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    issueSizeCr: '',
    filingDate: '',
    filingDateText: '',
    regulatoryStatus: 'Under Review',
    statusType: 'review' as 'cleared' | 'approved' | 'review',
    expectedDate: '',
    leadManagers: '',
    status: 'draft' as 'draft' | 'published',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDRHPCompanies();
      setCompanies(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load DRHP companies from Supabase.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingCompany(null);
    setFormData({
      companyName: '',
      industry: '',
      issueSizeCr: '',
      filingDate: '',
      filingDateText: '',
      regulatoryStatus: 'Under Review',
      statusType: 'review',
      expectedDate: '',
      leadManagers: '',
      status: 'draft',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (company: DRHPCompany) => {
    setEditingCompany(company);
    setFormData({
      companyName: company.companyName,
      industry: company.industry,
      issueSizeCr: String(company.issueSizeCr),
      filingDate: company.filingDate || '',
      filingDateText: company.filingDateText || '',
      regulatoryStatus: company.regulatoryStatus || 'Under Review',
      statusType: company.statusType || 'review',
      expectedDate: company.expectedDate || '',
      leadManagers: company.leadManagers,
      status: company.status,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (company: DRHPCompany) => {
    const nextStatus = company.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await updateDRHPCompany(company.id, { status: nextStatus });
      setCompanies((prev) => prev.map((c) => (c.id === company.id ? updated : c)));
      setAlertInfo({
        type: 'success',
        message: `"${company.companyName}" marked as ${nextStatus.toUpperCase()}.`,
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
      await deleteDRHPCompany(deleteConfirmItem.id);
      setCompanies((prev) => prev.filter((c) => c.id !== deleteConfirmItem.id));
      setAlertInfo({
        type: 'success',
        message: `"${deleteConfirmItem.companyName}" successfully deleted.`,
      });
      setDeleteConfirmItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete DRHP record.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.companyName.trim()) errors.companyName = 'Company name is required';
    if (!formData.industry.trim()) errors.industry = 'Industry/Sector is required';
    if (!formData.issueSizeCr || isNaN(Number(formData.issueSizeCr)))
      errors.issueSizeCr = 'Valid issue size in crores is required';
    if (!formData.filingDate && !formData.filingDateText.trim()) {
      errors.filingDate = 'Provide either a calendar filing date or a tentative date milestone (e.g. Board Cleared)';
    }
    if (!formData.leadManagers.trim()) errors.leadManagers = 'Lead manager details are required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        companyName: formData.companyName.trim(),
        industry: formData.industry.trim(),
        issueSizeCr: parseFloat(formData.issueSizeCr),
        filingDate: formData.filingDate ? formData.filingDate : null,
        filingDateText: formData.filingDateText.trim() || null,
        regulatoryStatus: formData.regulatoryStatus.trim() || 'Under Review',
        statusType: formData.statusType,
        expectedDate: formData.expectedDate ? formData.expectedDate : undefined,
        leadManagers: formData.leadManagers.trim(),
        status: formData.status,
      };

      if (editingCompany) {
        const updated = await updateDRHPCompany(editingCompany.id, payload);

        setCompanies((prev) => prev.map((c) => (c.id === editingCompany.id ? updated : c)));
        setAlertInfo({
          type: 'success',
          message: `Updated "${updated.companyName}" successfully in Supabase.`,
        });
      } else {
        const created = await createDRHPCompany(payload);

        setCompanies((prev) => [created, ...prev]);
        setAlertInfo({
          type: 'success',
          message: `Added "${created.companyName}" to DRHP tracker in Supabase.`,
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

  const columns: TableColumn<DRHPCompany>[] = [
    {
      key: 'companyName',
      header: 'Company Name',
      render: (item) => (
        <div>
          <span className="font-semibold text-white block">{item.companyName}</span>
          <span className="text-xs text-slate-400 block">{item.industry}</span>
        </div>
      ),
    },
    {
      key: 'regulatoryStatus',
      header: 'Regulatory Status',
      render: (item) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
            item.statusType === 'cleared'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
              : item.statusType === 'approved'
              ? 'bg-blue-950/60 text-blue-300 border-blue-800/40'
              : 'bg-amber-950/60 text-amber-300 border-amber-800/40'
          }`}
        >
          {item.regulatoryStatus || 'Under Review'}
        </span>
      ),
    },
    {
      key: 'issueSizeCr',
      header: 'Issue Size (Cr)',
      align: 'right',
      render: (item) => (
        <span className="font-bold text-slate-100">
          ₹{item.issueSizeCr.toLocaleString('en-IN')} Cr
        </span>
      ),
    },
    {
      key: 'filingDate',
      header: 'Filing Date / Milestone',
      render: (item) => (
        <div>
          <span className="text-xs text-slate-200 block">
            {item.filingDate || item.filingDateText || 'TBA'}
          </span>
          {item.filingDate && item.filingDateText && (
            <span className="text-[10px] text-slate-400 block">{item.filingDateText}</span>
          )}
        </div>
      ),
    },
    {
      key: 'expectedDate',
      header: 'Expected IPO',
      render: (item) => (
        <span className="text-xs text-indigo-300 font-medium">
          {item.expectedDate || 'TBA'}
        </span>
      ),
    },
    {
      key: 'leadManagers',
      header: 'Book Running Lead Managers',
      render: (item) => (
        <span className="text-xs text-slate-400 truncate max-w-xs block">
          {item.leadManagers}
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
          <p className="text-sm text-slate-300 font-medium">Loading DRHP companies from Supabase...</p>
        </div>
      ) : (
        <DataTable<DRHPCompany>
          title="DRHP Companies & IPO Filings"
          description="Track Draft Red Herring Prospectus documents filed with SEBI."
          data={companies}
          columns={columns}
          searchPlaceholder="Search company or industry..."
          searchKey="companyName"
          addNewLabel="Add DRHP Company"
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
        title={editingCompany ? `Edit ${editingCompany.companyName}` : 'Add DRHP IPO Record'}
        description="Enter draft prospectus details filed with market regulator SEBI. Changes are saved to Supabase."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
              {editingCompany ? 'Save Changes' : 'Create Record'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Company Name"
            placeholder="e.g. Swiggy Ltd"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            error={formErrors.companyName}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Industry / Domain"
              placeholder="e.g. Hyperlocal Delivery / Tech"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              error={formErrors.industry}
              required
            />

            <Input
              label="Estimated Issue Size (₹ Crores)"
              type="number"
              placeholder="10414"
              value={formData.issueSizeCr}
              onChange={(e) => setFormData({ ...formData, issueSizeCr: e.target.value })}
              error={formErrors.issueSizeCr}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="SEBI Filing Date (Calendar Date)"
              type="date"
              value={formData.filingDate}
              onChange={(e) => setFormData({ ...formData, filingDate: e.target.value })}
              error={formErrors.filingDate}
              helperText="Optional if tentative date/milestone is provided below"
            />

            <Input
              label="Tentative Date / Milestone Text"
              placeholder="e.g. Board Cleared / Q4 FY26"
              value={formData.filingDateText}
              onChange={(e) => setFormData({ ...formData, filingDateText: e.target.value })}
              helperText="Used if exact calendar date is not yet notified"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Regulatory Status"
              placeholder="e.g. Under Review / SEBI Cleared"
              value={formData.regulatoryStatus}
              onChange={(e) => setFormData({ ...formData, regulatoryStatus: e.target.value })}
            />

            <Select
              label="Status Badge Category"
              value={formData.statusType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  statusType: e.target.value as 'cleared' | 'approved' | 'review',
                })
              }
              options={[
                { label: 'Review (In Progress)', value: 'review' },
                { label: 'Approved (Observations Issued)', value: 'approved' },
                { label: 'Cleared (Final Clearance)', value: 'cleared' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Expected Listing Window (Optional)"
              placeholder="e.g. November 2026 / Q4 FY27"
              value={formData.expectedDate}
              onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
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
                { label: 'Published (Visible on live site)', value: 'published' },
                { label: 'Draft (Internal review only)', value: 'draft' },
              ]}
            />
          </div>

          <Input
            label="Book Running Lead Managers"
            placeholder="e.g. Kotak Mahindra, Citigroup, Jefferies, Morgan Stanley"
            value={formData.leadManagers}
            onChange={(e) => setFormData({ ...formData, leadManagers: e.target.value })}
            error={formErrors.leadManagers}
            required
          />
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmItem}
        onClose={() => !isDeleting && setDeleteConfirmItem(null)}
        title="Confirm Removal"
        description="Are you sure you want to delete this DRHP filing? This will permanently remove the record from Supabase."
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
            {deleteConfirmItem?.companyName}
          </strong>
        </p>
      </Modal>
    </div>
  );
}
