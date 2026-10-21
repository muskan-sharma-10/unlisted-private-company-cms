'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import {
  fetchVideos,
  createVideo,
  updateVideo,
  deleteVideo,
} from '@/lib/supabase/api';
import { VideoContent, TableColumn } from '@/types';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, Loading03Icon } from '@hugeicons/core-free-icons';

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoContent | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<VideoContent | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoContent | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [formData, setFormData] = useState({
    title: '',
    youtubeId: '',
    category: 'Educational',
    duration: '10:00',
    status: 'draft' as 'draft' | 'published',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchVideos();
      setVideos(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load videos from Supabase.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingVideo(null);
    setFormData({
      title: '',
      youtubeId: '',
      category: 'Educational',
      duration: '10:00',
      status: 'draft',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vid: VideoContent) => {
    setEditingVideo(vid);
    setFormData({
      title: vid.title,
      youtubeId: vid.youtubeId,
      category: vid.category,
      duration: vid.duration,
      status: vid.status,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (vid: VideoContent) => {
    const nextStatus = vid.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await updateVideo(vid.id, { status: nextStatus });
      setVideos((prev) => prev.map((v) => (v.id === vid.id ? updated : v)));
      setAlertInfo({
        type: 'success',
        message: `"${vid.title}" marked as ${nextStatus.toUpperCase()}.`,
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
      await deleteVideo(deleteConfirmItem.id);
      setVideos((prev) => prev.filter((v) => v.id !== deleteConfirmItem.id));
      setAlertInfo({
        type: 'success',
        message: `"${deleteConfirmItem.title}" deleted from Supabase.`,
      });
      setDeleteConfirmItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete video.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.youtubeId.trim()) errors.youtubeId = 'YouTube ID is required';
    if (!formData.duration.trim()) errors.duration = 'Duration is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Support entering full URL or just the video ID
    let ytId = formData.youtubeId.trim();
    if (ytId.includes('v=')) {
      ytId = ytId.split('v=')[1]?.split('&')[0] || ytId;
    } else if (ytId.includes('youtu.be/')) {
      ytId = ytId.split('youtu.be/')[1]?.split('?')[0] || ytId;
    }

    setIsSubmitting(true);
    try {
      if (editingVideo) {
        const updated = await updateVideo(editingVideo.id, {
          title: formData.title.trim(),
          youtubeId: ytId,
          category: formData.category.trim(),
          duration: formData.duration.trim(),
          status: formData.status,
        });

        setVideos((prev) => prev.map((v) => (v.id === editingVideo.id ? updated : v)));
        setAlertInfo({
          type: 'success',
          message: `Updated "${updated.title}" successfully in Supabase.`,
        });
      } else {
        const created = await createVideo({
          title: formData.title.trim(),
          youtubeId: ytId,
          category: formData.category.trim(),
          duration: formData.duration.trim(),
          status: formData.status,
        });

        setVideos((prev) => [created, ...prev]);
        setAlertInfo({
          type: 'success',
          message: `Added video "${created.title}" to Supabase.`,
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

  const columns: TableColumn<VideoContent>[] = [
    {
      key: 'title',
      header: 'Video Title & Embed',
      render: (item) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewVideo(item)}
            className="h-8 w-11 rounded-md bg-muted border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground text-primary shrink-0 group transition-colors shadow-2xs cursor-pointer"
            title="Preview Video"
          >
            <HugeiconsIcon icon={PlayIcon} size={15} className="group-hover:scale-110 transition-transform" />
          </button>
          <div>
            <span className="font-semibold text-foreground block line-clamp-1">{item.title}</span>
            <span className="text-xs text-muted-foreground font-mono">ID: {item.youtubeId}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item) => (
        <Badge variant="secondary" size="sm">
          {item.category}
        </Badge>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'center',
      render: (item) => <span className="text-xs text-muted-foreground font-tabular font-medium">{item.duration}</span>,
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
          <p className="text-sm text-foreground font-medium">Loading videos from Supabase...</p>
        </div>
      ) : (
        <DataTable<VideoContent>
          title="Videos & Market Insights"
          description="Embed educational video analyses and founder interviews for investors."
          data={videos}
          columns={columns}
          searchPlaceholder="Search videos by title or category..."
          searchKey="title"
          addNewLabel="Add Video"
          onAddNew={handleOpenAdd}
          onEdit={handleOpenEdit}
          onDelete={(item) => setDeleteConfirmItem(item)}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Add / Edit Video Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingVideo ? 'Edit Video' : 'Add New Video'}
        description="Provide YouTube video ID or URL along with category. Commits to Supabase."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
              {editingVideo ? 'Save Changes' : 'Save Video'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Video Title"
            placeholder="e.g. Unlisted Shares Demystified: Safe Demat Credit Process"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            error={formErrors.title}
            required
          />

          <Input
            label="YouTube Video ID or Link"
            placeholder="e.g. dQw4w9WgXcQ or https://youtube.com/watch?v=..."
            value={formData.youtubeId}
            onChange={(e) => setFormData({ ...formData, youtubeId: e.target.value })}
            helperText="Paste the 11-character YouTube video ID or full video link."
            error={formErrors.youtubeId}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Content Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={[
                { label: 'Educational', value: 'Educational' },
                { label: 'Company Deep Dive', value: 'Company Deep Dive' },
                { label: 'Sector Analysis', value: 'Sector Analysis' },
                { label: 'Pre-IPO & DRHP Filings', value: 'Pre-IPO & DRHP Filings' },
              ]}
            />

            <Input
              label="Duration (mm:ss)"
              placeholder="e.g. 12:45"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              error={formErrors.duration}
              required
            />
          </div>

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
              { label: 'Draft (Saved internally)', value: 'draft' },
            ]}
          />
        </form>
      </Modal>

      {/* Video Preview Modal */}
      <Modal
        isOpen={!!previewVideo}
        onClose={() => setPreviewVideo(null)}
        title={previewVideo ? previewVideo.title : 'Preview Video'}
        description={`Category: ${previewVideo?.category} • Duration: ${previewVideo?.duration}`}
        maxWidth="lg"
      >
        {previewVideo && (
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black border border-border shadow-xs">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${previewVideo.youtubeId}?autoplay=1`}
              title={previewVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmItem}
        onClose={() => !isDeleting && setDeleteConfirmItem(null)}
        title="Confirm Removal"
        description="Are you sure you want to remove this video from Supabase?"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmItem(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Video
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          Video to delete:{' '}
          <strong className="text-foreground font-semibold">
            {deleteConfirmItem?.title}
          </strong>
        </p>
      </Modal>
    </div>
  );
}
