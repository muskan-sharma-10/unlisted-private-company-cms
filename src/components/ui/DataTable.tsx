'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Globe,
  FileEdit,
  Inbox,
} from 'lucide-react';
import { Button } from './Button';
import { StatusBadge } from './Badge';
import { TableColumn, PublishStatus } from '@/types';

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

      // Default: match any string value
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
          {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>
        {onAddNew && (
          <Button
            onClick={onAddNew}
            leftIcon={<Plus className="h-4 w-4" />}
            size="md"
            variant="primary"
          >
            {addNewLabel}
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span>Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'published' | 'draft');
                setCurrentPage(1);
              }}
              className="bg-transparent font-medium text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Statuses ({data.length})</option>
              <option value="published" className="bg-slate-900">
                Published ({data.filter((d) => d.status === 'published').length})
              </option>
              <option value="draft" className="bg-slate-900">
                Drafts ({data.filter((d) => d.status === 'draft').length})
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-5 py-3.5 font-semibold ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
                <th scope="col" className="px-5 py-3.5 text-center font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3.5 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={columns.length + 2} className="px-5 py-4">
                      <div className="h-4 bg-slate-800 rounded w-3/4 mb-1"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-3 bg-slate-800/50 rounded-full border border-slate-700/60 text-slate-400">
                        <Inbox className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-medium text-slate-300">No records found</p>
                      <p className="text-xs text-slate-500 max-w-xs">
                        {searchTerm
                          ? `No matches for "${searchTerm}". Try resetting your search or filter.`
                          : 'Get started by creating your first record using the button above.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-5 py-4 text-slate-200 ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        } ${col.className || ''}`}
                      >
                        {col.render
                          ? col.render(item)
                          : String(item[col.key as keyof T] ?? '—')}
                      </td>
                    ))}

                    {/* Status Column */}
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={item.status} />
                    </td>

                    {/* Action Column */}
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {onToggleStatus && (
                          <button
                            type="button"
                            onClick={() => onToggleStatus(item)}
                            title={
                              item.status === 'published'
                                ? 'Unpublish (set to draft)'
                                : 'Publish to live website'
                            }
                            className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              item.status === 'published'
                                ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {item.status === 'published' ? (
                              <FileEdit className="h-4 w-4" />
                            ) : (
                              <Globe className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            title="Edit record"
                            className="p-1.5 rounded-lg border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            title="Delete record"
                            className="p-1.5 rounded-lg border border-slate-700/80 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
          <p>
            Showing{' '}
            <span className="font-semibold text-slate-200">
              {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-200">
              {Math.min(currentPage * pageSize, filteredData.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-200">{filteredData.length}</span>{' '}
            records
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-medium text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || filteredData.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
