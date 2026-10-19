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
import {
  UserCheck,
  Search,
  Phone,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  X,
} from 'lucide-react';

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
        prev.map((l) => (l.id === id ? { ...l, status: newStatus as LeadEnquiry['status'], adminNotes: adminNote || l.adminNotes } : l))
      );
      if (selectedLead && selectedLead.id === id) {
        setSelectedLead((prev) => prev ? { ...prev, status: newStatus as LeadEnquiry['status'], adminNotes: adminNote || prev.adminNotes } : null);
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
        prev.map((p) => (p.id === id ? { ...p, status: newStatus as PartnerApplication['status'], adminNotes: adminNote || p.adminNotes } : p))
      );
      if (selectedPartner && selectedPartner.id === id) {
        setSelectedPartner((prev) => prev ? { ...prev, status: newStatus as PartnerApplication['status'], adminNotes: adminNote || prev.adminNotes } : null);
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
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">New</span>;
      case 'contacted':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">Contacted</span>;
      case 'in_progress':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">In Progress</span>;
      case 'converted':
      case 'approved':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Converted</span>;
      case 'closed':
      case 'rejected':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">Closed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-teal-400" />
            <span>Investor Leads &amp; Dealing Desk</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time buy/sell inquiries, ESOP liquidity requests, and partner onboarding applications from portal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-md shadow-teal-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
          <span className="text-xs text-slate-400 font-medium block">Total Leads Logged</span>
          <div className="text-2xl font-bold text-white mt-1">{leads.length}</div>
          <span className="text-[11px] text-teal-400 mt-1 block">Dealing Desk Inquiries</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
          <span className="text-xs text-slate-400 font-medium block">New Unread Leads</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{newLeadsCount}</div>
          <span className="text-[11px] text-amber-400/80 mt-1 block">Awaiting First Outreach</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
          <span className="text-xs text-slate-400 font-medium block">Partner Applications</span>
          <div className="text-2xl font-bold text-white mt-1">{partners.length}</div>
          <span className="text-[11px] text-teal-400 mt-1 block">{newPartnersCount} New Pending Review</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
          <span className="text-xs text-slate-400 font-medium block">Conversion Rate</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {leads.length > 0 ? `${Math.round((leads.filter((l) => l.status === 'converted').length / leads.length) * 100)}%` : '0%'}
          </div>
          <span className="text-[11px] text-emerald-400/80 mt-1 block">Closed &amp; Demat Settled</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <button
            onClick={() => { setActiveTab('leads'); setStatusFilter('all'); }}
            className={`pb-4 text-sm font-semibold relative transition-colors ${
              activeTab === 'leads' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Dealing Desk &amp; Stock Leads ({leads.length})</span>
            {newLeadsCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
                {newLeadsCount} new
              </span>
            )}
            {activeTab === 'leads' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
            )}
          </button>

          <button
            onClick={() => { setActiveTab('partners'); setStatusFilter('all'); }}
            className={`pb-4 text-sm font-semibold relative transition-colors ${
              activeTab === 'partners' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Partner Desk Applications ({partners.length})</span>
            {newPartnersCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-300 rounded-full border border-teal-500/30">
                {newPartnersCount} new
              </span>
            )}
            {activeTab === 'partners' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
            )}
          </button>
        </div>
      </div>

      {/* Controls: Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'leads' ? 'Search investor name, phone, stock...' : 'Search partner name, email, city...'}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {['all', 'new', 'contacted', 'in_progress', 'converted', 'closed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        {activeTab === 'leads' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-4 px-6">Investor / Contact</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Stock Requested</th>
                  <th className="py-4 px-6">Quantity &amp; Value</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No lead inquiries found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white text-sm">{item.name}</div>
                        <div className="text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3 text-teal-400" />
                          <span>{item.phone}</span>
                        </div>
                        {item.email && <div className="text-slate-500 text-[11px]">{item.email}</div>}
                      </td>

                      <td className="py-4 px-6">
                        <span className="capitalize font-medium text-slate-300">
                          {item.enquiryType.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-semibold text-teal-300">{item.stockName || 'General Inquiry'}</div>
                        {item.stockSymbol && <div className="text-[11px] text-slate-500">{item.stockSymbol}</div>}
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-semibold text-white">
                          {item.quantity ? `${item.quantity.toLocaleString('en-IN')} shares` : '—'}
                        </div>
                        {item.targetPrice && (
                          <div className="text-slate-400 text-[11px]">
                            @ ₹{item.targetPrice.toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateLeadStatus(item.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-teal-400"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="in_progress">In Progress</option>
                          <option value="converted">Converted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>

                      <td className="py-4 px-6 text-slate-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recent'}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedLead(item); setAdminNote(item.adminNotes || ''); }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Inspect Lead"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(item.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-4 h-4" />
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
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-4 px-6">Applicant Name</th>
                  <th className="py-4 px-6">Contact Info</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">City / Base</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Submitted</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No partner desk applications found.
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white text-sm">{item.fullName}</div>
                        {item.organizationName && <div className="text-slate-400 text-[11px]">{item.organizationName}</div>}
                      </td>

                      <td className="py-4 px-6">
                        <div className="text-slate-300">{item.phone}</div>
                        <div className="text-slate-500 text-[11px]">{item.email}</div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="capitalize font-medium text-teal-300">
                          {item.partnerType.replace('-', ' ')}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-300">
                        {item.city || '—'}
                      </td>

                      <td className="py-4 px-6">
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdatePartnerStatus(item.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-teal-400"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>

                      <td className="py-4 px-6 text-slate-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recent'}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedPartner(item); setAdminNote(item.adminNotes || ''); }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="View Application"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePartner(item.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Delete Application"
                          >
                            <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-white space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold uppercase text-teal-400">Lead Inspection</span>
                <h3 className="text-lg font-bold text-white">{selectedLead.name}</h3>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Phone Number</span>
                <a href={`tel:${selectedLead.phone}`} className="font-semibold text-teal-400 hover:underline">{selectedLead.phone}</a>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Email Address</span>
                <span className="font-semibold">{selectedLead.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Stock Requested</span>
                <span className="font-semibold text-white">{selectedLead.stockName || 'General Enquiry'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Quantity / Indicative Consideration</span>
                <span className="font-semibold">
                  {selectedLead.quantity ? `${selectedLead.quantity} shares` : 'N/A'}{' '}
                  {selectedLead.targetPrice && `@ ₹${selectedLead.targetPrice}`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Source Page</span>
                <span className="font-mono text-[11px] text-slate-400">{selectedLead.sourcePage || 'Website'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Status</span>
                {getStatusBadge(selectedLead.status)}
              </div>
            </div>

            {selectedLead.message && (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1 font-semibold">Investor Instructions / Note:</span>
                <p className="text-slate-200">{selectedLead.message}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Internal Dealing Desk Notes
              </label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Log call status, CMR verification status, rate negotiated..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-400"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => handleUpdateLeadStatus(selectedLead.id, selectedLead.status)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-colors"
              >
                Save Notes
              </button>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner Detail Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-white space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold uppercase text-teal-400">Partner Application</span>
                <h3 className="text-lg font-bold text-white">{selectedPartner.fullName}</h3>
              </div>
              <button onClick={() => setSelectedPartner(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Phone</span>
                <a href={`tel:${selectedPartner.phone}`} className="font-semibold text-teal-400 hover:underline">{selectedPartner.phone}</a>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Email</span>
                <span className="font-semibold">{selectedPartner.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Organization</span>
                <span className="font-semibold text-white">{selectedPartner.organizationName || 'Individual'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Category</span>
                <span className="capitalize font-semibold text-teal-300">{selectedPartner.partnerType.replace('-', ' ')}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Base City</span>
                <span className="font-semibold">{selectedPartner.city || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Status</span>
                {getStatusBadge(selectedPartner.status)}
              </div>
            </div>

            {selectedPartner.message && (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1 font-semibold">Collaboration Scope / Notes:</span>
                <p className="text-slate-200">{selectedPartner.message}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Internal Partnership Review Notes
              </label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Broker license verification, commission structure agreed, onboarding steps..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-400"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => handleUpdatePartnerStatus(selectedPartner.id, selectedPartner.status)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-colors"
              >
                Save Notes
              </button>
              <button
                onClick={() => setSelectedPartner(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
