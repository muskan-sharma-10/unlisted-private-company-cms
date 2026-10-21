'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import {
  fetchTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from '@/lib/supabase/api';
import { Testimonial, TableColumn } from '@/types';
import { HugeiconsIcon } from '@hugeicons/react';
import { StarIcon, Loading03Icon } from '@hugeicons/core-free-icons';

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Testimonial | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Testimonial | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [formData, setFormData] = useState({
    clientName: '',
    role: '',
    company: '',
    rating: '5',
    review: '',
    status: 'draft' as 'draft' | 'published',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTestimonials();
      setTestimonials(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load testimonials from Supabase.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      clientName: '',
      role: 'Investor',
      company: '',
      rating: '5',
      review: '',
      status: 'draft',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Testimonial) => {
    setEditingItem(item);
    setFormData({
      clientName: item.clientName,
      role: item.role,
      company: item.company || '',
      rating: String(item.rating),
      review: item.review,
      status: item.status,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: Testimonial) => {
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await updateTestimonial(item.id, { status: nextStatus });
      setTestimonials((prev) => prev.map((t) => (t.id === item.id ? updated : t)));
      setAlertInfo({
        type: 'success',
        message: `Testimonial from "${item.clientName}" set to ${nextStatus.toUpperCase()}.`,
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
      await deleteTestimonial(deleteConfirmItem.id);
      setTestimonials((prev) => prev.filter((t) => t.id !== deleteConfirmItem.id));
      setAlertInfo({
        type: 'success',
        message: `Testimonial from "${deleteConfirmItem.clientName}" was deleted from Supabase.`,
      });
      setDeleteConfirmItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete testimonial.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.clientName.trim()) errors.clientName = 'Client name is required';
    if (!formData.role.trim()) errors.role = 'Role or designation is required';
    if (!formData.review.trim()) errors.review = 'Review text is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (editingItem) {
        const updated = await updateTestimonial(editingItem.id, {
          clientName: formData.clientName.trim(),
          role: formData.role.trim(),
          company: formData.company.trim() || undefined,
          rating: parseInt(formData.rating, 10),
          review: formData.review.trim(),
          status: formData.status,
        });

        setTestimonials((prev) => prev.map((t) => (t.id === editingItem.id ? updated : t)));
        setAlertInfo({
          type: 'success',
          message: `Updated testimonial from "${updated.clientName}" in Supabase.`,
        });
      } else {
        const created = await createTestimonial({
          clientName: formData.clientName.trim(),
          role: formData.role.trim(),
          company: formData.company.trim() || undefined,
          rating: parseInt(formData.rating, 10),
          review: formData.review.trim(),
          status: formData.status,
        });

        setTestimonials((prev) => [created, ...prev]);
        setAlertInfo({
          type: 'success',
          message: `Added new testimonial from "${created.clientName}" to Supabase.`,
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

  const columns: TableColumn<Testimonial>[] = [
    {
      key: 'clientName',
      header: 'Client & Role',
      render: (item) => (
        <div>
          <span className="font-semibold text-foreground block">{item.clientName}</span>
          <span className="text-xs text-muted-foreground block">
            {item.role} {item.company ? `• ${item.company}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center gap-0.5 text-amber-500">
          {Array.from({ length: item.rating }).map((_, i) => (
            <HugeiconsIcon key={i} icon={StarIcon} size={14} className="fill-current" />
          ))}
        </div>
      ),
    },
    {
      key: 'review',
      header: 'Review Excerpt',
      render: (item) => (
        <p className="text-xs text-muted-foreground italic line-clamp-2 max-w-md">
          “{item.review}”
        </p>
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
        <div className="p-12 text-center rounded-xl bg-card border border-border flex flex-col items-center justify-center space-y-2.5 shadow-2xs">
          <HugeiconsIcon icon={Loading03Icon} size={28} className="text-primary animate-spin" />
          <p className="text-sm text-foreground font-medium">Loading testimonials from Supabase...</p>
        </div>
      ) : (
        <DataTable<Testimonial>
          title="Client Testimonials & Trust Reviews"
          description="Showcase genuine feedback from verified investors and institutional buyers."
          data={testimonials}
          columns={columns}
          searchPlaceholder="Search reviews by client name or company..."
          searchKey="clientName"
          addNewLabel="Add Testimonial"
          onAddNew={handleOpenAdd}
          onEdit={handleOpenEdit}
          onDelete={(item) => setDeleteConfirmItem(item)}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Add / Edit Testimonial Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingItem ? 'Edit Testimonial' : 'Add Client Review'}
        description="Add customer feedback to display in the social proof section of the website. Commits to Supabase."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
              {editingItem ? 'Save Changes' : 'Save Review'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Client Full Name"
            placeholder="e.g. Rajesh Mehra"
            value={formData.clientName}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            error={formErrors.clientName}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Role / Designation"
              placeholder="e.g. HNI Investor / Managing Director"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              error={formErrors.role}
              required
            />

            <Input
              label="Company / Firm (Optional)"
              placeholder="e.g. Apex Wealth Partners"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Investor Rating"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              options={[
                { label: '5 Stars - Exceptional Experience', value: '5' },
                { label: '4 Stars - Very Good Experience', value: '4' },
                { label: '3 Stars - Satisfactory', value: '3' },
              ]}
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

          <Textarea
            label="Client Feedback / Review Text"
            rows={4}
            placeholder="Write genuine feedback regarding demat credit speed, pricing transparency, or customer service..."
            value={formData.review}
            onChange={(e) => setFormData({ ...formData, review: e.target.value })}
            error={formErrors.review}
            required
          />
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmItem}
        onClose={() => !isDeleting && setDeleteConfirmItem(null)}
        title="Confirm Removal"
        description="Are you sure you want to delete this client testimonial from Supabase?"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmItem(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Review
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          Client review to delete:{' '}
          <strong className="text-foreground font-semibold">
            {deleteConfirmItem?.clientName}
          </strong>
        </p>
      </Modal>
    </div>
  );
}
