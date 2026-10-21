'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchLeadEnquiries,
  updateLeadEnquiryStatus,
  deleteLeadEnquiry,
  fetchPartnerApplications,
  updatePartnerApplicationStatus,
  deletePartnerApplication,
} from '@/lib/supabase/api';
import type { LeadEnquiry, PartnerApplication } from '@/types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserCheck01Icon,
  Search01Icon,
  Call02Icon,
  Delete02Icon,
  ViewIcon,
  Download01Icon,
  ArrowReloadHorizontalIcon,
} from '@hugeicons/core-free-icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export default function LeadsDashboardPage() {
  const [activeTab, setActiveTab] = useState<'leads' | 'partners'>('leads');
  const [leads, setLeads] = useState<LeadEnquiry[]>([]);
  const [partners, setPartners] = useState<PartnerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal inspection
  const [selectedLead, setSelectedLead] = useState<LeadEnquiry | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerApplication | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leadsData, partnersData] = await Promise.all([
        fetchLeadEnquiries(),
        fetchPartnerApplications(),
      ]);
      setLeads(leadsData);
      setPartners(partnersData);
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateLeadStatus = async (id: string, newStatus: string) => {
    try {
      await updateLeadEnquiryStatus(id, newStatus, adminNote || undefined);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, status: newStatus as LeadEnquiry['status'], adminNotes: adminNote || l.adminNotes }
            : l
        )
      );
      if (selectedLead && selectedLead.id === id) {
        setSelectedLead((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus as LeadEnquiry['status'],
                adminNotes: adminNote || prev.adminNotes,
              }
            : null
        );
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update lead status');
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead inquiry?')) return;
    try {
      await deleteLeadEnquiry(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (selectedLead?.id === id) setSelectedLead(null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete lead inquiry');
    }
  };

  const handleUpdatePartnerStatus = async (id: string, newStatus: string) => {
    try {
      await updatePartnerApplicationStatus(id, newStatus, adminNote || undefined);
      setPartners((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: newStatus as PartnerApplication['status'],
                adminNotes: adminNote || p.adminNotes,
              }
            : p
        )
      );
      if (selectedPartner && selectedPartner.id === id) {
        setSelectedPartner((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus as PartnerApplication['status'],
                adminNotes: adminNote || prev.adminNotes,
              }
            : null
        );
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update partner status');
    }
  };

  const handleDeletePartner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this partner application?')) return;
    try {
      await deletePartnerApplication(id);
      setPartners((prev) => prev.filter((p) => p.id !== id));
      if (selectedPartner?.id === id) setSelectedPartner(null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete application');
    }
  };

  const exportCSV = () => {
    const dataToExport = activeTab === 'leads' ? leads : partners;
    if (dataToExport.length === 0) {
      alert('No records to export');
      return;
    }

    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map((item) =>
      Object.values(item)
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTab}_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Metrics calculation
  const newLeadsCount = leads.filter((l) => l.status === 'new').length;
  const newPartnersCount = partners.filter((p) => p.status === 'new').length;

  const filteredLeads = leads.filter((l) => {
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.stockName && l.stockName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.stockSymbol && l.stockSymbol.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const filteredPartners = partners.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.city && p.city.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="info">New</Badge>;
      case 'contacted':
        return <Badge variant="warning">Contacted</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'converted':
      case 'approved':
        return <Badge variant="success">Converted</Badge>;
      case 'closed':
      case 'rejected':
        return <Badge variant="destructive">Closed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <HugeiconsIcon icon={UserCheck01Icon} size={28} className="text-primary" />
            <span>Investor Leads &amp; Dealing Desk</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time buy/sell inquiries, ESOP liquidity requests, and partner onboarding applications from portal.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            leftIcon={
              <HugeiconsIcon
                icon={ArrowReloadHorizontalIcon}
                size={14}
                className={isLoading ? 'animate-spin' : ''}
              />
            }
          >
            Refresh
          </Button>
          <Button
            onClick={exportCSV}
            variant="primary"
            size="sm"
            leftIcon={<HugeiconsIcon icon={Download01Icon} size={14} />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-muted-foreground font-medium block">Total Leads Logged</span>
          <div className="text-2xl font-bold text-foreground mt-1 font-tabular">{leads.length}</div>
          <span className="text-[11px] text-primary mt-1 block font-medium">Dealing Desk Inquiries</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-muted-foreground font-medium block">New Unread Leads</span>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1 font-tabular">{newLeadsCount}</div>
          <span className="text-[11px] text-amber-800 dark:text-amber-400/80 mt-1 block font-medium">Awaiting First Outreach</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-muted-foreground font-medium block">Partner Applications</span>
          <div className="text-2xl font-bold text-foreground mt-1 font-tabular">{partners.length}</div>
          <span className="text-[11px] text-primary mt-1 block font-medium">{newPartnersCount} New Pending Review</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-muted-foreground font-medium block">Conversion Rate</span>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-tabular">
            {leads.length > 0 ? `${Math.round((leads.filter((l) => l.status === 'converted').length / leads.length) * 100)}%` : '0%'}
          </div>
          <span className="text-[11px] text-emerald-800 dark:text-emerald-400/80 mt-1 block font-medium">Closed &amp; Demat Settled</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <button
            onClick={() => { setActiveTab('leads'); setStatusFilter('all'); }}
            className={cn(
              'pb-3 text-sm font-semibold relative transition-colors cursor-pointer',
              activeTab === 'leads' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>Dealing Desk &amp; Stock Leads ({leads.length})</span>
            {newLeadsCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-full border border-amber-300">
                {newLeadsCount} new
              </span>
            )}
            {activeTab === 'leads' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>

          <button
            onClick={() => { setActiveTab('partners'); setStatusFilter('all'); }}
            className={cn(
              'pb-3 text-sm font-semibold relative transition-colors cursor-pointer',
              activeTab === 'partners' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>Partner Desk Applications ({partners.length})</span>
            {newPartnersCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded-full border border-blue-300">
                {newPartnersCount} new
              </span>
            )}
            {activeTab === 'partners' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Controls: Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'leads' ? 'Search investor name, phone, stock...' : 'Search partner name, email, city...'}
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'new', 'contacted', 'in_progress', 'converted', 'closed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-semibold capitalize whitespace-nowrap transition-colors shadow-2xs',
                statusFilter === st
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground border border-input'
              )}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
        {activeTab === 'leads' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3.5 px-5">Investor / Contact</th>
                  <th className="py-3.5 px-5">Type</th>
                  <th className="py-3.5 px-5">Stock Requested</th>
                  <th className="py-3.5 px-5">Quantity &amp; Value</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No lead inquiries found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-foreground text-sm">{item.name}</div>
                        <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <HugeiconsIcon icon={Call02Icon} size={13} className="text-primary shrink-0" />
                          <span className="font-tabular">{item.phone}</span>
                        </div>
                        {item.email && <div className="text-muted-foreground text-[11px]">{item.email}</div>}
                      </td>

                      <td className="py-3.5 px-5">
                        <span className="capitalize font-medium text-foreground">
                          {item.enquiryType.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-primary">{item.stockName || 'General Inquiry'}</div>
                        {item.stockSymbol && <div className="text-[11px] text-muted-foreground font-mono">{item.stockSymbol}</div>}
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-foreground font-tabular">
                          {item.quantity ? `${item.quantity.toLocaleString('en-IN')} shares` : '—'}
                        </div>
                        {item.targetPrice && (
                          <div className="text-muted-foreground text-[11px] font-tabular">
                            @ ₹{item.targetPrice.toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-5">
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateLeadStatus(item.id, e.target.value)}
                          className="bg-background border border-input rounded-md px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer shadow-2xs"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="in_progress">In Progress</option>
                          <option value="converted">Converted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-5 text-muted-foreground font-tabular">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recent'}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setSelectedLead(item); setAdminNote(item.adminNotes || ''); }}
                            className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors shadow-2xs"
                            title="Inspect Lead"
                          >
                            <HugeiconsIcon icon={ViewIcon} size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(item.id)}
                            className="p-1.5 rounded-md border border-border bg-background hover:bg-red-50 hover:border-red-200 text-destructive dark:hover:bg-red-950/40 dark:hover:border-red-900/50 transition-colors shadow-2xs"
                            title="Delete Lead"
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3.5 px-5">Applicant Name</th>
                  <th className="py-3.5 px-5">Contact Info</th>
                  <th className="py-3.5 px-5">Category</th>
                  <th className="py-3.5 px-5">City / Base</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Submitted</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No partner desk applications found.
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-foreground text-sm">{item.fullName}</div>
                        {item.organizationName && <div className="text-muted-foreground text-[11px]">{item.organizationName}</div>}
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="text-foreground font-tabular">{item.phone}</div>
                        <div className="text-muted-foreground text-[11px]">{item.email}</div>
                      </td>

                      <td className="py-3.5 px-5">
                        <span className="capitalize font-medium text-primary">
                          {item.partnerType.replace('-', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-muted-foreground">
                        {item.city || '—'}
                      </td>

                      <td className="py-3.5 px-5">
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdatePartnerStatus(item.id, e.target.value)}
                          className="bg-background border border-input rounded-md px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer shadow-2xs"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-5 text-muted-foreground font-tabular">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recent'}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setSelectedPartner(item); setAdminNote(item.adminNotes || ''); }}
                            className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors shadow-2xs"
                            title="View Application"
                          >
                            <HugeiconsIcon icon={ViewIcon} size={15} />
                          </button>
                          <button
                            onClick={() => handleDeletePartner(item.id)}
                            className="p-1.5 rounded-md border border-border bg-background hover:bg-red-50 hover:border-red-200 text-destructive dark:hover:bg-red-950/40 dark:hover:border-red-900/50 transition-colors shadow-2xs"
                            title="Delete Application"
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <Modal
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          title={`Lead Inspection: ${selectedLead.name}`}
          description="Inbound investor deal inquiry details from public portal"
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="primary"
                onClick={() => handleUpdateLeadStatus(selectedLead.id, selectedLead.status)}
              >
                Save Internal Notes
              </Button>
              <Button variant="secondary" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Phone Number</span>
                <a href={`tel:${selectedLead.phone}`} className="font-semibold text-primary hover:underline font-tabular">
                  {selectedLead.phone}
                </a>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Email Address</span>
                <span className="font-semibold text-foreground">{selectedLead.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Stock Requested</span>
                <span className="font-semibold text-foreground">{selectedLead.stockName || 'General Enquiry'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Quantity / Indicative Rate</span>
                <span className="font-semibold text-foreground font-tabular">
                  {selectedLead.quantity ? `${selectedLead.quantity} shares` : 'N/A'}{' '}
                  {selectedLead.targetPrice && `@ ₹${selectedLead.targetPrice}`}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Source Page</span>
                <span className="font-mono text-[11px] text-muted-foreground">{selectedLead.sourcePage || 'Website'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Current Status</span>
                {getStatusBadge(selectedLead.status)}
              </div>
            </div>

            {selectedLead.message && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs">
                <span className="text-muted-foreground block mb-1 font-semibold">Investor Instructions / Note:</span>
                <p className="text-foreground">{selectedLead.message}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Internal Dealing Desk Notes
              </label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Log call status, CMR verification status, rate negotiated..."
                className="w-full bg-background border border-input rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Partner Detail Modal */}
      {selectedPartner && (
        <Modal
          isOpen={!!selectedPartner}
          onClose={() => setSelectedPartner(null)}
          title={`Partner Application: ${selectedPartner.fullName}`}
          description="Broker, wealth manager, or institutional partner onboarding review"
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="primary"
                onClick={() => handleUpdatePartnerStatus(selectedPartner.id, selectedPartner.status)}
              >
                Save Review Notes
              </Button>
              <Button variant="secondary" onClick={() => setSelectedPartner(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Phone Number</span>
                <a href={`tel:${selectedPartner.phone}`} className="font-semibold text-primary hover:underline font-tabular">
                  {selectedPartner.phone}
                </a>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Email Address</span>
                <span className="font-semibold text-foreground">{selectedPartner.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Organization</span>
                <span className="font-semibold text-foreground">{selectedPartner.organizationName || 'Individual'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Category</span>
                <span className="capitalize font-semibold text-primary">{selectedPartner.partnerType.replace('-', ' ')}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Base City</span>
                <span className="font-semibold text-foreground">{selectedPartner.city || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5 font-medium">Current Status</span>
                {getStatusBadge(selectedPartner.status)}
              </div>
            </div>

            {selectedPartner.message && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs">
                <span className="text-muted-foreground block mb-1 font-semibold">Collaboration Scope / Notes:</span>
                <p className="text-foreground">{selectedPartner.message}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Internal Partnership Review Notes
              </label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Broker license verification, commission structure agreed, onboarding steps..."
                className="w-full bg-background border border-input rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
