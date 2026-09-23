'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LifeBuoy,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Send,
  MessageSquare,
  ShieldAlert,
  Loader2,
  PlusCircle,
  Building,
  UserCheck,
  UserX,
  ChevronDown,
  UserPlus,
  Paperclip,
  Check,
} from 'lucide-react';
import type { PlatformTicket, PlatformTicketMessage, AssignableUser } from '@/app/api/super-admin/support/route';
import {
  AttachmentUploader,
  AttachmentsGallery,
  ImageLightbox,
  type SupportAttachment,
} from '@/features/support/ui/support-attachments';

interface TicketStats {
  total: number;
  open: number;
  critical: number;
  resolved: number;
  avgResponseTime: string;
}

export function SuperAdminSupportView({ locale: propLocale }: { locale?: string }) {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');
  const hookLocale = useLocale();
  const locale = propLocale || hookLocale || 'fr';

  const [tickets, setTickets] = useState<PlatformTicket[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [assigningTicket, setAssigningTicket] = useState<PlatformTicket | null>(null);
  const [assigneeModalOpen, setAssigneeModalOpen] = useState(false);
  const [customAssigneeInput, setCustomAssigneeInput] = useState('');

  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    critical: 0,
    resolved: 0,
    avgResponseTime: '18 min',
  });
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Selected Ticket Details & Message History
  const [activeTicket, setActiveTicket] = useState<PlatformTicket | null>(null);
  const [activeMessages, setActiveMessages] = useState<PlatformTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<SupportAttachment[]>([]);
  const [newStatus, setNewStatus] = useState<PlatformTicket['status']>('in_progress');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // New Ticket Creation Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicketAttachments, setNewTicketAttachments] = useState<SupportAttachment[]>([]);
  const [newTicketForm, setNewTicketForm] = useState({
    tenantId: '',
    schoolName: '',
    subject: '',
    category: 'technical' as PlatformTicket['category'],
    priority: 'medium' as PlatformTicket['priority'],
    contactName: '',
    contactEmail: '',
    initialMessage: '',
    assignedTo: '',
  });

  const categoryLabels: Record<PlatformTicket['category'], string> = {
    technical: t('catTechnical'),
    billing: t('catBilling'),
    onboarding: t('catOnboarding'),
    cndp_compliance: t('catCndp'),
    feature_request: t('catFeatureMassar'),
  };

  const priorityBadges: Record<PlatformTicket['priority'], { label: string; className: string }> = {
    critical: { label: t('priorityCritical'), className: 'bg-rose-100 text-rose-700 font-extrabold border-rose-200' },
    high: { label: t('priorityHigh'), className: 'bg-amber-100 text-amber-800 font-bold border-amber-200' },
    medium: { label: t('priorityMedium'), className: 'bg-blue-100 text-blue-700 font-semibold border-blue-200' },
    low: { label: t('priorityLow'), className: 'bg-slate-100 text-slate-600 font-medium border-slate-200' },
  };

  const statusBadges: Record<PlatformTicket['status'], { label: string; className: string }> = {
    new: { label: t('statusNew'), className: 'bg-indigo-100 text-indigo-700 font-bold' },
    in_progress: { label: t('statusInProgress'), className: 'bg-blue-100 text-[#0066FF] font-bold' },
    waiting_client: { label: t('statusWaitingClient'), className: 'bg-amber-100 text-amber-800 font-medium' },
    resolved: { label: t('statusResolved'), className: 'bg-[#DDF5EC] text-[#17A673] font-bold' },
    closed: { label: t('statusClosed'), className: 'bg-slate-100 text-slate-500 line-through' },
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedPriority !== 'all') params.set('priority', selectedPriority);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/super-admin/support?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTickets(json.data.tickets || []);
        setStats(json.data.stats || { total: 0, open: 0, critical: 0, resolved: 0, avgResponseTime: '18 min' });
        if (json.data.assignableUsers) {
          setAssignableUsers(json.data.assignableUsers);
        }
        if (json.data.assignees) {
          setAssignees(json.data.assignees);
        }
        if (json.data.schools) {
          setSchools(json.data.schools);
          if (json.data.schools.length === 1) {
            setNewTicketForm((prev) => ({
              ...prev,
              tenantId: prev.tenantId || json.data.schools[0].id,
              schoolName: prev.schoolName || json.data.schools[0].name,
            }));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load support tickets', e);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedPriority, selectedCategory, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const openTicketDetails = async (tkt: PlatformTicket) => {
    setActiveTicket(tkt);
    setNewStatus(tkt.status);
    setReplyMessage('');
    setReplyAttachments([]);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/super-admin/support?ticketId=${tkt.id}`);
      const json = await res.json();
      if (json.success && json.data.messages) {
        setActiveMessages(json.data.messages);
      } else {
        setActiveMessages([]);
      }
    } catch {
      setActiveMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleAssignTicket = async (ticketId: string, assignedTo: string | null) => {
    // Optimistic update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, assignedTo } : t))
    );
    if (activeTicket && activeTicket.id === ticketId) {
      setActiveTicket((prev) => (prev ? { ...prev, assignedTo } : null));
    }
    setAssigneeModalOpen(false);
    setAssigningTicket(null);
    setCustomAssigneeInput('');

    try {
      const res = await fetch('/api/super-admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          ticketId,
          assignedTo,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessNotice(
          assignedTo
            ? `Ticket assigné avec succès à "${assignedTo}".`
            : 'L’assignation du ticket a été retirée.'
        );
        setTimeout(() => setSuccessNotice(null), 3500);
      } else {
        fetchTickets();
      }
    } catch (e) {
      console.error('Failed to assign ticket', e);
      fetchTickets();
    }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setSubmittingReply(true);
    try {
      const res = await fetch('/api/super-admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          ticketId: activeTicket.id,
          status: newStatus,
          replyMessage: replyMessage.trim() || undefined,
          attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessNotice(t('replySuccessNotice'));
        setActiveTicket(null);
        setReplyMessage('');
        setReplyAttachments([]);
        fetchTickets();
      }
    } catch (e) {
      console.error('Failed to update ticket', e);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTicket(true);
    try {
      const res = await fetch('/api/super-admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          tenantId: newTicketForm.tenantId || undefined,
          schoolName: newTicketForm.schoolName,
          subject: newTicketForm.subject,
          category: newTicketForm.category,
          priority: newTicketForm.priority,
          contactName: newTicketForm.contactName,
          contactEmail: newTicketForm.contactEmail,
          initialMessage: newTicketForm.initialMessage,
          assignedTo: newTicketForm.assignedTo || undefined,
          attachments: newTicketAttachments.length > 0 ? newTicketAttachments : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessNotice(t('ticketCreatedNotice'));
        setIsCreateOpen(false);
        setNewTicketAttachments([]);
        setNewTicketForm({
          tenantId: '',
          schoolName: '',
          subject: '',
          category: 'technical',
          priority: 'medium',
          contactName: '',
          contactEmail: '',
          initialMessage: '',
          assignedTo: '',
        });
        fetchTickets();
      }
    } catch (e) {
      console.error('Failed to create ticket', e);
    } finally {
      setCreatingTicket(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2.5">
            <LifeBuoy className="w-6 h-6 text-[#0066FF]" />
            {t('supportCenterTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('supportCenterSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {t('newTicketBtn')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchTickets}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </Button>
        </div>
      </div>

      {successNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successNotice}
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">
            {tCommon('close')}
          </button>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('openTicketsStat')}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-[#0066FF]">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0066FF]">{stats.open}</div>
          <p className="text-[11px] text-slate-400">{t('openTicketsDesc')}</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('criticalPriorityStat')}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-600">{stats.critical}</div>
          <p className="text-[11px] text-slate-400">{t('criticalPriorityDesc')}</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('resolvedTicketsStat')}</span>
            <div className="w-8 h-8 rounded-xl bg-[#DDF5EC] flex items-center justify-center text-[#17A673]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#17A673]">{stats.resolved}</div>
          <p className="text-[11px] text-slate-400">{t('resolvedTicketsDesc')}</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('avgResponseTimeStat')}</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-violet-700">{stats.avgResponseTime}</div>
          <p className="text-[11px] text-slate-400">{t('avgResponseTimeDesc')}</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchTicketsPlaceholder')}
              className="pl-9 rtl:pl-3 rtl:pr-9 h-9 text-xs rounded-xl border-slate-200"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">{t('allStatuses')}</option>
            <option value="new">{t('statusNew')}</option>
            <option value="in_progress">{t('statusInProgress')}</option>
            <option value="waiting_client">{t('statusWaitingClient')}</option>
            <option value="resolved">{t('statusResolved')}</option>
            <option value="closed">{t('statusClosed')}</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">{t('allPriorities')}</option>
            <option value="critical">{t('priorityCritical')}</option>
            <option value="high">{t('priorityHigh')}</option>
            <option value="medium">{t('priorityMedium')}</option>
            <option value="low">{t('priorityLow')}</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">{t('allCategories')}</option>
            <option value="technical">{t('catTechnical')}</option>
            <option value="billing">{t('catBilling')}</option>
            <option value="onboarding">{t('catOnboarding')}</option>
            <option value="cndp_compliance">{t('catCndp')}</option>
            <option value="feature_request">{t('catFeatureMassar')}</option>
          </select>
        </div>
      </Card>

      {/* Tickets List */}
      <Card className="rounded-2xl border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">{t('institutionCol')}</th>
                <th className="py-3 px-4">{t('subjectAndMessageCol')}</th>
                <th className="py-3 px-4">{t('categoryCol')}</th>
                <th className="py-3 px-4">{t('priorityCol')}</th>
                <th className="py-3 px-4">{tCommon('status')}</th>
                <th className="py-3 px-4">{t('assignedToCol')}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{t('actionCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0066FF] mb-2" />
                    {t('loadingTickets')}
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {t('noTicketsFound')}
                  </td>
                </tr>
              ) : (
                tickets.map((tkt) => {
                  const pBadge = priorityBadges[tkt.priority];
                  const sBadge = statusBadges[tkt.status];
                  return (
                    <tr key={tkt.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#16212B]">{tkt.schoolName}</div>
                        <div className="text-[11px] text-slate-400">{tkt.contactName}</div>
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{tkt.subject}</span>
                          {tkt.attachments && tkt.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/60">
                              <Paperclip className="w-2.5 h-2.5" />
                              {tkt.attachments.length}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5" title={tkt.lastMessage}>
                          {tkt.lastMessage}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="neutral" className="text-[11px] border-slate-200 font-medium bg-white">
                          {categoryLabels[tkt.category]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${pBadge.className} border text-[10px]`}>
                          {pBadge.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${sBadge.className} border-none text-[10px]`}>
                          {sBadge.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningTicket(tkt);
                            setAssigneeModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all border bg-slate-50 hover:bg-white border-slate-200 text-slate-700 hover:border-[#0066FF] hover:text-[#0066FF] hover:shadow-2xs group"
                          title="Cliquer pour modifier l'assignation"
                        >
                          {tkt.assignedTo ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate max-w-[120px]">{tkt.assignedTo}</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-slate-400 italic">Non assigné</span>
                            </>
                          )}
                          <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-[#0066FF] ml-0.5 shrink-0" />
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right rtl:text-left">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTicketDetails(tkt)}
                          className="h-8 text-xs rounded-xl border-slate-200 hover:border-[#0066FF] hover:text-[#0066FF] font-semibold"
                        >
                          {t('actionProcess')}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Ticket Response & History Dialog */}
      <Dialog open={Boolean(activeTicket)} onOpenChange={(open) => !open && setActiveTicket(null)}>
        {activeTicket && (
          <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="text-base font-extrabold text-[#16212B]">
                  Ticket #{activeTicket.id.slice(0, 8).toUpperCase()} — {activeTicket.schoolName}
                </DialogTitle>
                <Badge className={`${priorityBadges[activeTicket.priority].className} text-[10px]`}>
                  {priorityBadges[activeTicket.priority].label}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-bold text-slate-800 text-sm">{activeTicket.subject}</span>
                  <span>{new Date(activeTicket.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')}</span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('contactLabel', { name: activeTicket.contactName, email: activeTicket.contactEmail })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className="font-semibold">Assigné :</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAssigningTicket(activeTicket);
                        setAssigneeModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 font-bold text-[#0066FF] hover:underline cursor-pointer bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 text-xs"
                      title="Modifier l'assignation"
                    >
                      {activeTicket.assignedTo || 'Non assigné'}
                      <ChevronDown className="w-3 h-3 text-[#0066FF]" />
                    </button>
                  </div>
                </div>

                {/* Initial Ticket Attachments if present on root ticket */}
                {activeTicket.attachments && activeTicket.attachments.length > 0 && activeMessages.length === 0 && (
                  <AttachmentsGallery
                    attachments={activeTicket.attachments}
                    onPreviewImage={(url) => setLightboxUrl(url)}
                  />
                )}
              </div>

              {/* Message Thread History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#0066FF]" />
                  {t('conversationThread')} ({activeMessages.length})
                </h4>

                <div className="space-y-3 max-h-80 overflow-y-auto p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                  {loadingMessages ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#0066FF] mb-1" />
                      Chargement des échanges...
                    </div>
                  ) : activeMessages.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs italic">
                      &ldquo;{activeTicket.lastMessage}&rdquo;
                    </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const isStaff = msg.senderType === 'super_admin';
                      return (
                        <div
                          key={msg.id}
                          className={`p-3.5 rounded-xl text-xs space-y-1.5 shadow-2xs ${
                            isStaff
                              ? 'bg-blue-50/90 border border-blue-100 text-blue-900 ml-6 rtl:ml-0 rtl:mr-6'
                              : 'bg-white border border-slate-200/80 text-slate-800 mr-6 rtl:mr-0 rtl:ml-6'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className={isStaff ? 'text-[#0066FF]' : 'text-slate-700'}>
                              {msg.senderName} {isStaff && '🛡️ (Support)'}
                            </span>
                            <span className="text-slate-400 font-normal">
                              {new Date(msg.createdAt).toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>

                          {/* Render attached images & videos */}
                          <AttachmentsGallery
                            attachments={msg.attachments}
                            onPreviewImage={(url) => setLightboxUrl(url)}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <form onSubmit={handleUpdateTicket} className="space-y-4 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">{t('updateStatusLabel')}</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as any)}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                    >
                      <option value="new">{t('statusNew')}</option>
                      <option value="in_progress">{t('statusInProgress')}</option>
                      <option value="waiting_client">{t('statusWaitingClient')}</option>
                      <option value="resolved">{t('statusResolved')}</option>
                      <option value="closed">{t('statusClosed')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">{t('categoryCol')}</label>
                    <Input
                      disabled
                      value={categoryLabels[activeTicket.category]}
                      className="h-9 text-xs rounded-xl bg-slate-100 text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Assigné à</label>
                    <select
                      value={activeTicket.assignedTo || ''}
                      onChange={(e) => handleAssignTicket(activeTicket.id, e.target.value || null)}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                    >
                      <option value="">-- Non assigné --</option>
                      {assignees.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    {t('replyLabel')}
                  </label>
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder={t('replyPlaceholder')}
                    rows={3}
                    className="text-xs rounded-xl border-slate-200 resize-none"
                  />
                </div>

                {/* Attachment Uploader in Super Admin Reply */}
                <div className="pt-1">
                  <AttachmentUploader
                    attachments={replyAttachments}
                    onChange={setReplyAttachments}
                    disabled={submittingReply}
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTicket(null)}
                    className="h-9 text-xs rounded-xl border-slate-200"
                  >
                    {tCommon('close')}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingReply}
                    className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
                  >
                    {submittingReply && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <Send className="w-3.5 h-3.5" />
                    {t('sendReplyBtn')}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Ticket Assignment Modal */}
      <Dialog open={assigneeModalOpen} onOpenChange={setAssigneeModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#0066FF]" />
              Assigner le ticket
            </DialogTitle>
          </DialogHeader>

          {assigningTicket && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                <span className="font-bold text-slate-900 block truncate">{assigningTicket.subject}</span>
                <span className="text-slate-500 text-[11px] block">{assigningTicket.schoolName}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Sélectionner un administrateur / agent
                </label>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => handleAssignTicket(assigningTicket.id, null)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors border ${
                      !assigningTicket.assignedTo
                        ? 'bg-blue-50 border-[#0066FF] text-[#0066FF] font-bold'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <UserX className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Non assigné (Retirer l&apos;assignation)</span>
                    </span>
                    {!assigningTicket.assignedTo && <Check className="w-4 h-4 text-[#0066FF] shrink-0" />}
                  </button>

                  {/* Real platform users from database */}
                  {assignableUsers.map((u) => {
                    const isCurrent = assigningTicket.assignedTo === u.name || assigningTicket.assignedTo === u.email;
                    const initials = (u.name || u.email)
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleAssignTicket(assigningTicket.id, u.name || u.email)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors border ${
                          isCurrent
                            ? 'bg-blue-50 border-[#0066FF] text-[#0066FF] font-bold'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate">{u.name}</span>
                            <span className="text-[10px] text-slate-500 block truncate">{u.email}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] px-1.5 py-0 font-medium">
                            Super Admin
                          </Badge>
                          {isCurrent && <Check className="w-4 h-4 text-[#0066FF]" />}
                        </div>
                      </button>
                    );
                  })}

                  {/* Fallback for any existing assigned names not in assignableUsers */}
                  {assignees
                    .filter((name) => !assignableUsers.some((u) => u.name === name || u.email === name))
                    .map((customName) => {
                      const isCurrent = assigningTicket.assignedTo === customName;
                      return (
                        <button
                          key={customName}
                          type="button"
                          onClick={() => handleAssignTicket(assigningTicket.id, customName)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors border ${
                            isCurrent
                              ? 'bg-blue-50 border-[#0066FF] text-[#0066FF] font-bold'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                            {customName}
                          </span>
                          {isCurrent && <Check className="w-4 h-4 text-[#0066FF] shrink-0" />}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Custom Member Input */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Ou saisir un autre membre spécifique
                </label>
                <div className="flex gap-2">
                  <Input
                    value={customAssigneeInput}
                    onChange={(e) => setCustomAssigneeInput(e.target.value)}
                    placeholder="Ex: Tariq (Support N2)..."
                    className="h-9 text-xs rounded-xl border-slate-200"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!customAssigneeInput.trim()}
                    onClick={() => handleAssignTicket(assigningTicket.id, customAssigneeInput.trim())}
                    className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold px-3 shrink-0"
                  >
                    Assigner
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Ticket Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#0066FF]" />
              {t('newTicketTitle')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">{t('selectSchool')} *</label>
              <select
                required
                value={newTicketForm.tenantId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const found = schools.find((s) => s.id === selectedId);
                  setNewTicketForm((prev) => ({
                    ...prev,
                    tenantId: selectedId,
                    schoolName: found ? found.name : prev.schoolName,
                  }));
                }}
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
              >
                <option value="">-- {t('selectSchool')} --</option>
                {schools.map((sch) => (
                  <option key={sch.id} value={sch.id}>
                    {sch.name} ({sch.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">{t('ticketSubject')} *</label>
              <Input
                required
                value={newTicketForm.subject}
                onChange={(e) => setNewTicketForm((p) => ({ ...p, subject: e.target.value }))}
                placeholder="Ex: Demande d'assistance export Massar 2026"
                className="h-9 text-xs rounded-xl border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('categoryCol')}</label>
                <select
                  value={newTicketForm.category}
                  onChange={(e) => setNewTicketForm((p) => ({ ...p, category: e.target.value as any }))}
                  className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                >
                  <option value="technical">{t('catTechnical')}</option>
                  <option value="billing">{t('catBilling')}</option>
                  <option value="onboarding">{t('catOnboarding')}</option>
                  <option value="cndp_compliance">{t('catCndp')}</option>
                  <option value="feature_request">{t('catFeatureMassar')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('priorityCol')}</label>
                <select
                  value={newTicketForm.priority}
                  onChange={(e) => setNewTicketForm((p) => ({ ...p, priority: e.target.value as any }))}
                  className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                >
                  <option value="low">{t('priorityLow')}</option>
                  <option value="medium">{t('priorityMedium')}</option>
                  <option value="high">{t('priorityHigh')}</option>
                  <option value="critical">{t('priorityCritical')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('contactName')} *</label>
                <Input
                  required
                  value={newTicketForm.contactName}
                  onChange={(e) => setNewTicketForm((p) => ({ ...p, contactName: e.target.value }))}
                  placeholder="Directeur / Responsable"
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('contactEmail')} *</label>
                <Input
                  required
                  type="email"
                  value={newTicketForm.contactEmail}
                  onChange={(e) => setNewTicketForm((p) => ({ ...p, contactEmail: e.target.value }))}
                  placeholder="contact@ecole.ma"
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Assigner à (optionnel)</label>
              <select
                value={newTicketForm.assignedTo}
                onChange={(e) => setNewTicketForm((p) => ({ ...p, assignedTo: e.target.value }))}
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
              >
                <option value="">-- Non assigné (File générale) --</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.name || u.email}>
                    {u.name} ({u.email})
                  </option>
                ))}
                {assignees
                  .filter((name) => !assignableUsers.some((u) => u.name === name || u.email === name))
                  .map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">{t('ticketDescription')} *</label>
              <Textarea
                required
                value={newTicketForm.initialMessage}
                onChange={(e) => setNewTicketForm((p) => ({ ...p, initialMessage: e.target.value }))}
                placeholder="Détaillez le besoin, les messages d'erreur ou les pièces requises..."
                rows={3}
                className="text-xs rounded-xl border-slate-200 resize-none"
              />
            </div>

            {/* Attachments for new ticket */}
            <div className="pt-1">
              <label className="text-xs font-bold text-slate-600 block mb-1">Pièces jointes (images / vidéos)</label>
              <AttachmentUploader
                attachments={newTicketAttachments}
                onChange={setNewTicketAttachments}
                disabled={creatingTicket}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="h-9 text-xs rounded-xl border-slate-200"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creatingTicket}
                className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
              >
                {creatingTicket && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('createTicketBtn')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Lightbox Modal */}
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
