'use client';

import React, { useState, useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  PlusSignIcon,
  SlidersHorizontalIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Edit02Icon,
  Delete02Icon,
  Globe02Icon,
  FileEditIcon,
  InboxIcon,
} from '@hugeicons/core-free-icons';
import { Button } from './Button';
import { StatusBadge } from './Badge';
import { TableColumn, PublishStatus } from '@/types';
import { cn } from '@/lib/utils';

export interface BaseItem {
  id: string;
  status: PublishStatus;
  updatedAt?: string;
}

interface DataTableProps<T extends BaseItem> {
  title: string;
  description?: string;
  data: T[];
  columns: TableColumn<T>[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  onAddNew?: () => void;
  addNewLabel?: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onToggleStatus?: (item: T) => void;
  isLoading?: boolean;
}

export function DataTable<T extends BaseItem>({
  title,
  description,
  data,
  columns,
  searchPlaceholder = 'Search records...',
  searchKey,
  onAddNew,
  addNewLabel = 'Add New',
  onEdit,
  onDelete,
  onToggleStatus,
  isLoading = false,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Filter logic
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      // Search term filter
      if (!searchTerm.trim()) return true;

      if (searchKey && item[searchKey]) {
        return String(item[searchKey]).toLowerCase().includes(searchTerm.toLowerCase());
      }

      // Default: match any string or number value
      return Object.values(item as Record<string, unknown>).some((val) =>
        typeof val === 'string' || typeof val === 'number'
          ? String(val).toLowerCase().includes(searchTerm.toLowerCase())
          : false
      );
    });
  }, [data, searchTerm, statusFilter, searchKey]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {onAddNew && (
          <Button
            onClick={onAddNew}
            leftIcon={<HugeiconsIcon icon={PlusSignIcon} size={16} className="shrink-0" />}
            size="md"
            variant="primary"
          >
            {addNewLabel}
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full bg-background border border-input rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground shadow-2xs">
            <HugeiconsIcon icon={SlidersHorizontalIcon} size={14} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'published' | 'draft');
                setCurrentPage(1);
              }}
              className="bg-transparent font-medium text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-card text-foreground">
                All Records ({data.length})
              </option>
              <option value="published" className="bg-card text-foreground">
                Published ({data.filter((d) => d.status === 'published').length})
              </option>
              <option value="draft" className="bg-card text-foreground">
                Drafts ({data.filter((d) => d.status === 'draft').length})
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      'px-5 py-3 font-semibold text-xs',
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left',
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
                <th scope="col" className="px-5 py-3 text-center font-semibold text-xs">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right font-semibold text-xs">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={columns.length + 2} className="px-5 py-4">
                      <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="px-5 py-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2.5">
                      <div className="p-3 bg-muted rounded-full border border-border text-muted-foreground">
                        <HugeiconsIcon icon={InboxIcon} size={24} />
                      </div>
                      <p className="text-sm font-semibold text-foreground">No records found</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        {searchTerm
                          ? `No matches found for "${searchTerm}". Try adjusting your search query or status filter.`
                          : 'Get started by creating your first entry using the button above.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-5 py-3.5 text-foreground text-xs leading-normal',
                          col.align === 'right'
                            ? 'text-right font-tabular'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left',
                          col.className
                        )}
                      >
                        {col.render
                          ? col.render(item)
                          : String(item[col.key as keyof T] ?? '—')}
                      </td>
                    ))}

                    {/* Status Column */}
                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={item.status} />
                    </td>

                    {/* Action Column */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {onToggleStatus && (
                          <button
                            type="button"
                            onClick={() => onToggleStatus(item)}
                            title={
                              item.status === 'published'
                                ? 'Unpublish (convert to draft)'
                                : 'Publish live'
                            }
                            className={cn(
                              'p-1.5 rounded-lg border text-xs font-medium transition-colors shadow-2xs',
                              item.status === 'published'
                                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                            )}
                          >
                            <HugeiconsIcon
                              icon={item.status === 'published' ? FileEditIcon : Globe02Icon}
                              size={15}
                            />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            title="Edit record"
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors shadow-2xs"
                          >
                            <HugeiconsIcon icon={Edit02Icon} size={15} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            title="Delete record"
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-red-50 hover:border-red-200 text-destructive dark:hover:bg-red-950/40 dark:hover:border-red-900/50 transition-colors shadow-2xs"
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          <p>
            Showing{' '}
            <span className="font-semibold text-foreground font-tabular">
              {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-foreground font-tabular">
              {Math.min(currentPage * pageSize, filteredData.length)}
            </span>{' '}
            of <span className="font-semibold text-foreground font-tabular">{filteredData.length}</span>{' '}
            records
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs text-xs"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
              <span>Previous</span>
            </button>
            <span className="px-2 font-medium text-foreground font-tabular text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || filteredData.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs text-xs"
            >
              <span>Next</span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
