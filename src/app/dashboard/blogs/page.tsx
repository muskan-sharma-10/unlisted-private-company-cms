'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import {
  fetchBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
} from '@/lib/supabase/api';
import { BlogArticle, TableColumn } from '@/types';
import { Loader2 } from 'lucide-react';

export default function BlogsPage() {
  const [blogs, setBlogs] = useState<BlogArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogArticle | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<BlogArticle | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    category: '',
    author: 'Research Team',
    readTime: '5 min read',
    excerpt: '',
    content: '',
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
      const data = await fetchBlogs();
      setBlogs(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load blog articles from Supabase.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingBlog(null);
    setFormData({
      title: '',
      slug: '',
      category: 'Guides & Education',
      author: 'Research Team',
      readTime: '5 min read',
      excerpt: '',
      content: '',
      status: 'draft',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (blog: BlogArticle) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title,
      slug: blog.slug,
      category: blog.category,
      author: blog.author,
      readTime: blog.readTime,
      excerpt: blog.excerpt,
      content: blog.content || '',
      status: blog.status,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleTitleChange = (title: string) => {
    const slug = generateSlug(title);
    setFormData((prev) => ({
      ...prev,
      title,
      slug: !editingBlog ? slug : prev.slug,
    }));
  };

  const handleToggleStatus = async (blog: BlogArticle) => {
    const nextStatus = blog.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await updateBlog(blog.id, { status: nextStatus });
      setBlogs((prev) => prev.map((b) => (b.id === blog.id ? updated : b)));
      setAlertInfo({
        type: 'success',
        message: `"${blog.title}" marked as ${nextStatus.toUpperCase()}.`,
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
      await deleteBlog(deleteConfirmItem.id);
      setBlogs((prev) => prev.filter((b) => b.id !== deleteConfirmItem.id));
      setAlertInfo({
        type: 'success',
        message: `"${deleteConfirmItem.title}" was deleted from Supabase.`,
      });
      setDeleteConfirmItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete blog article.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.slug.trim()) errors.slug = 'Slug is required';
    if (!formData.category.trim()) errors.category = 'Category is required';
    if (!formData.excerpt.trim()) errors.excerpt = 'Short summary / excerpt is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (editingBlog) {
        const updated = await updateBlog(editingBlog.id, {
          title: formData.title.trim(),
          slug: formData.slug.trim(),
          category: formData.category.trim(),
          author: formData.author.trim(),
          readTime: formData.readTime.trim(),
          excerpt: formData.excerpt.trim(),
          content: formData.content.trim() || undefined,
          status: formData.status,
        });

        setBlogs((prev) => prev.map((b) => (b.id === editingBlog.id ? updated : b)));
        setAlertInfo({
          type: 'success',
          message: `Updated "${updated.title}" successfully in Supabase.`,
        });
      } else {
        const created = await createBlog({
          title: formData.title.trim(),
          slug: formData.slug.trim(),
          category: formData.category.trim(),
          author: formData.author.trim(),
          readTime: formData.readTime.trim(),
          excerpt: formData.excerpt.trim(),
          content: formData.content.trim() || undefined,
          status: formData.status,
        });

        setBlogs((prev) => [created, ...prev]);
        setAlertInfo({
          type: 'success',
          message: `Created article "${created.title}" in Supabase.`,
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

  const columns: TableColumn<BlogArticle>[] = [
    {
      key: 'title',
      header: 'Article Title & Slug',
      render: (item) => (
        <div className="max-w-md">
          <span className="font-semibold text-white block line-clamp-1">{item.title}</span>
          <span className="text-xs text-indigo-400 font-mono block">/{item.slug}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item) => (
        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
          {item.category}
        </span>
      ),
    },
    {
      key: 'author',
      header: 'Author',
      render: (item) => <span className="text-xs text-slate-300">{item.author}</span>,
    },
    {
      key: 'readTime',
      header: 'Read Time',
      align: 'center',
      render: (item) => <span className="text-xs text-slate-400">{item.readTime}</span>,
    },
    {
      key: 'publishedAt',
      header: 'Publish Date',
      render: (item) => (
        <span className="text-xs text-slate-400">
          {item.publishedAt ? item.publishedAt.split('T')[0] : 'Unpublished'}
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
          <p className="text-sm text-slate-300 font-medium">Loading blog articles from Supabase...</p>
        </div>
      ) : (
        <DataTable<BlogArticle>
          title="Blog Articles & Insights"
          description="Publish financial guides, pre-IPO valuations, and investor education articles."
          data={blogs}
          columns={columns}
          searchPlaceholder="Search blogs by title or slug..."
          searchKey="title"
          addNewLabel="Write New Article"
          onAddNew={handleOpenAdd}
          onEdit={handleOpenEdit}
          onDelete={(item) => setDeleteConfirmItem(item)}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Add / Edit Blog Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingBlog ? 'Edit Blog Article' : 'Draft New Blog Article'}
        description="Fill in article metadata, SEO slug, and short summary excerpt. Commits to Supabase."
        maxWidth="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
              {editingBlog ? 'Save Changes' : 'Save Article'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Article Title"
            placeholder="e.g. How to Invest in Pre-IPO Shares in India"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            error={formErrors.title}
            required
          />

          <Input
            label="URL Slug"
            placeholder="how-to-invest-in-pre-ipo-shares"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            helperText="The public web address path for this blog post."
            error={formErrors.slug}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Category"
              placeholder="e.g. Market Analysis"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              error={formErrors.category}
              required
            />

            <Input
              label="Author Name"
              placeholder="e.g. Research Team"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
            />

            <Input
              label="Estimated Read Time"
              placeholder="e.g. 6 min read"
              value={formData.readTime}
              onChange={(e) => setFormData({ ...formData, readTime: e.target.value })}
            />
          </div>

          <Textarea
            label="Short Excerpt / SEO Meta Summary"
            rows={3}
            placeholder="Brief overview explaining what readers will learn from this article..."
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            error={formErrors.excerpt}
            required
          />

          <Textarea
            label="Full Article Body / Content (Optional Markdown)"
            rows={5}
            placeholder="Full blog post content formatted in Markdown or rich text..."
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
              { label: 'Published (Live on public website)', value: 'published' },
              { label: 'Draft (Saved internally)', value: 'draft' },
            ]}
          />
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteConfirmItem}
        onClose={() => !isDeleting && setDeleteConfirmItem(null)}
        title="Confirm Removal"
        description="Are you sure you want to delete this blog post from Supabase?"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmItem(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Article
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Article to delete:{' '}
          <strong className="text-white font-semibold">
            {deleteConfirmItem?.title}
          </strong>
        </p>
      </Modal>
    </div>
  );
}
