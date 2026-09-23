'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Send,
  MessageSquare,
  Loader2,
  PlusCircle,
  Building,
  Check,
  ChevronRight,
  ShieldCheck,
  FileText,
  Radio,
  CreditCard,
  Wrench,
  Headphones,
  Paperclip,
} from 'lucide-react';
import type { TenantTicket, TenantTicketMessage } from '@/app/api/tenant/support/route';
import {
  AttachmentUploader,
  AttachmentsGallery,
  ImageLightbox,
  type SupportAttachment,
} from '@/features/support/ui/support-attachments';

interface TenantStats {
  total: number;
  open: number;
  waitingClient: number;
  resolved: number;
}

export function TenantSupportView() {
  const [tickets, setTickets] = useState<TenantTicket[]>([]);
  const [stats, setStats] = useState<TenantStats>({
    total: 0,
    open: 0,
    waitingClient: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Selected Ticket Details & Chat
  const [activeTicket, setActiveTicket] = useState<TenantTicket | null>(null);
  const [activeMessages, setActiveMessages] = useState<TenantTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<SupportAttachment[]>([]);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // New Ticket Creation Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicketAttachments, setNewTicketAttachments] = useState<SupportAttachment[]>([]);
  const [newTicketForm, setNewTicketForm] = useState({
    subject: '',
    category: 'technical' as TenantTicket['category'],
    priority: 'medium' as TenantTicket['priority'],
    initialMessage: '',
  });

  const categoryLabels: Record<TenantTicket['category'], { label: string; icon: React.ElementType }> = {
    feature_request: { label: 'Évolution & Export Massar', icon: FileText },
    cndp_compliance: { label: 'Conformité CNDP (Loi 09-08)', icon: ShieldCheck },
    onboarding: { label: 'Passerelle SMS & WhatsApp', icon: Radio },
    billing: { label: 'Facturation & Licence SchoolOS', icon: CreditCard },
    technical: { label: 'Assistance Technique', icon: Wrench },
  };

  const priorityStyles: Record<TenantTicket['priority'], { label: string; badgeClass: string }> = {
    critical: { label: 'Critique', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
    high: { label: 'Haute', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
    medium: { label: 'Moyenne', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    low: { label: 'Basse', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' },
  };

  const statusStyles: Record<TenantTicket['status'], { label: string; badgeClass: string }> = {
    new: { label: 'Transmis au support', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    in_progress: { label: 'En cours de traitement', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    waiting_client: { label: 'Réponse reçue (Action requise)', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold' },
    resolved: { label: 'Résolu', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    closed: { label: 'Clôturé', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' },
  };

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedPriority !== 'all') params.set('priority', selectedPriority);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/tenant/support?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTickets(json.data.tickets || []);
        if (json.data.stats) {
          setStats(json.data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedPriority, selectedCategory, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const openTicketDetail = async (ticket: TenantTicket) => {
    setActiveTicket(ticket);
    setReplyAttachments([]);
    setReplyMessage('');
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/tenant/support?ticketId=${ticket.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setActiveTicket(json.data.ticket);
        setActiveMessages(json.data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load ticket messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendReply = async () => {
    const hasText = Boolean(replyMessage.trim());
    const hasMedia = replyAttachments.length > 0;
    if (!activeTicket || (!hasText && !hasMedia)) return;

    setSubmittingReply(true);
    try {
      const res = await fetch('/api/tenant/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          ticketId: activeTicket.id,
          replyMessage: replyMessage.trim() || undefined,
          attachments: hasMedia ? replyAttachments : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setReplyMessage('');
        setReplyAttachments([]);
        setSuccessNotice('Votre message et vos pièces jointes ont été transmis au support SchoolOS.');
        setTimeout(() => setSuccessNotice(null), 4000);
        openTicketDetail(activeTicket);
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to reply to ticket', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!activeTicket) return;
    try {
      const res = await fetch('/api/tenant/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          ticketId: activeTicket.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessNotice('Demande marquée comme résolue.');
        setTimeout(() => setSuccessNotice(null), 4000);
        openTicketDetail({ ...activeTicket, status: 'resolved' });
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to resolve ticket', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.subject.trim() || !newTicketForm.initialMessage.trim()) return;
    setCreatingTicket(true);
    try {
      const res = await fetch('/api/tenant/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          subject: newTicketForm.subject.trim(),
          category: newTicketForm.category,
          priority: newTicketForm.priority,
          initialMessage: newTicketForm.initialMessage.trim(),
          attachments: newTicketAttachments.length > 0 ? newTicketAttachments : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsCreateOpen(false);
        setNewTicketAttachments([]);
        setNewTicketForm({
          subject: '',
          category: 'technical',
          priority: 'medium',
          initialMessage: '',
        });
        setSuccessNotice('Votre demande d’assistance et vos pièces jointes ont été transmises à l’équipe SchoolOS.');
        setTimeout(() => setSuccessNotice(null), 5000);
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to create ticket', err);
    } finally {
      setCreatingTicket(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header matching SchoolOS design language */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0066FF] shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Assistance & Support Établissement
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Contactez directement l’équipe technique et réglementaire SchoolOS (Massar, CNDP, Passerelles SMS, Facturation).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs px-4"
          >
            <PlusCircle className="w-4 h-4" />
            Nouvelle Demande
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchTickets}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 px-3"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0066FF]' : 'text-slate-600'}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Notice Banner */}
      {successNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successNotice}
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
            Fermer
          </button>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Demandes Actives</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#0066FF]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0066FF]">{stats.open}</div>
          <p className="text-[11px] text-slate-400 font-medium">En attente ou en traitement</p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Réponse Reçue</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700">{stats.waitingClient}</div>
          <p className="text-[11px] text-amber-600 font-semibold">Le support attend votre retour</p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Demandes Clôturées</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{stats.resolved}</div>
          <p className="text-[11px] text-slate-400 font-medium">Dossiers résolus avec succès</p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Historique</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A]">{stats.total}</div>
          <p className="text-[11px] text-slate-400 font-medium">Toutes vos demandes enregistrées</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher par sujet, mot-clé ou contenu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
            >
              <option value="all">Tous les statuts</option>
              <option value="new">Transmis</option>
              <option value="in_progress">En cours</option>
              <option value="waiting_client">Réponse reçue (Action requise)</option>
              <option value="resolved">Résolu</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
            >
              <option value="all">Toutes les catégories</option>
              <option value="feature_request">Massar (MEN)</option>
              <option value="cndp_compliance">Conformité CNDP</option>
              <option value="onboarding">Passerelles SMS & WhatsApp</option>
              <option value="technical">Assistance Technique</option>
              <option value="billing">Facturation & Licence</option>
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
            >
              <option value="all">Toutes les priorités</option>
              <option value="critical">Critique</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tickets Table */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#0066FF] mb-2.5" />
            <p className="text-xs font-medium">Chargement des demandes d’assistance...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-[#0066FF] mb-3">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">Aucune demande d’assistance trouvée</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Besoin d’aide sur un export Massar, une déclaration CNDP ou un paramétrage ?
            </p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="mt-4 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-xl h-9 px-4 shadow-xs"
            >
              Créer une demande
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[280px]">Sujet & Dernier Message</th>
                  <th className="py-3 px-4 min-w-[190px]">Catégorie</th>
                  <th className="py-3 px-4 min-w-[100px]">Priorité</th>
                  <th className="py-3 px-4 min-w-[160px]">Statut</th>
                  <th className="py-3 px-4 min-w-[150px]">Assigné à</th>
                  <th className="py-3 px-4 min-w-[130px]">Mise à jour</th>
                  <th className="py-3 px-4 w-[130px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {tickets.map((ticket) => {
                  const prio = priorityStyles[ticket.priority];
                  const st = statusStyles[ticket.status] || { label: ticket.status, badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
                  const cat = categoryLabels[ticket.category] || { label: ticket.category, icon: FileText };
                  const CategoryIcon = cat.icon;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => openTicketDetail(ticket)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0F172A] group-hover:text-[#0066FF] transition-colors flex items-center gap-2 flex-wrap">
                          <span>{ticket.subject}</span>
                          {ticket.attachments && ticket.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/60">
                              <Paperclip className="w-2.5 h-2.5" />
                              {ticket.attachments.length}
                            </span>
                          )}
                          {ticket.status === 'waiting_client' && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Action requise" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-sm">
                          {ticket.lastMessage || 'Aucun message.'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
                          <CategoryIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          {cat.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${prio.badgeClass}`}>
                          {prio.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${st.badgeClass}`}>
                          {st.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                        {ticket.assignedTo ? (
                          <span className="font-semibold text-slate-900">{ticket.assignedTo}</span>
                        ) : (
                          <span className="italic text-slate-400">Équipe Support SchoolOS</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {new Date(ticket.updatedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-bold text-[#0066FF] hover:bg-blue-50 rounded-lg px-2.5 gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTicketDetail(ticket);
                          }}
                        >
                          Consulter <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Ticket Conversation Modal */}
      {activeTicket && (
        <Dialog open={Boolean(activeTicket)} onOpenChange={(open) => !open && setActiveTicket(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-200">
            <DialogHeader className="p-5 border-b border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusStyles[activeTicket.status]?.badgeClass || ''}`}>
                      {statusStyles[activeTicket.status]?.label || activeTicket.status}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${priorityStyles[activeTicket.priority]?.badgeClass || ''}`}>
                      Priorité {priorityStyles[activeTicket.priority]?.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      #{activeTicket.id.slice(0, 8)}
                    </span>
                  </div>
                  <DialogTitle className="text-lg font-extrabold text-[#0F172A]">
                    {activeTicket.subject}
                  </DialogTitle>
                </div>

                {activeTicket.status !== 'resolved' && activeTicket.status !== 'closed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResolveTicket}
                    className="text-xs h-8 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5 font-bold"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Marquer résolu
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-2 font-medium">
                <span>Catégorie : <strong className="text-slate-700">{categoryLabels[activeTicket.category]?.label}</strong></span>
                <span>•</span>
                <span>Prise en charge : <strong className="text-slate-700">{activeTicket.assignedTo || 'Ingénieur Support SchoolOS'}</strong></span>
              </div>
            </DialogHeader>

            {/* Conversation Feed */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
              {loadingMessages ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066FF]" />
                  <p className="text-xs">Chargement des messages...</p>
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  Aucun message enregistré pour cette demande.
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isSchool = msg.senderType === 'client';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isSchool ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isSchool && (
                        <div className="w-8 h-8 rounded-xl bg-[#0066FF] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          OS
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                          isSchool
                            ? 'bg-[#0066FF] text-white rounded-tr-xs shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1.5">
                          <span className={`text-[11px] font-bold ${isSchool ? 'text-blue-100' : 'text-[#0066FF]'}`}>
                            {isSchool ? 'Vous (Établissement)' : `${msg.senderName} (Support SchoolOS)`}
                          </span>
                          <span className={`text-[10px] ${isSchool ? 'text-blue-200' : 'text-slate-400'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.message}</p>

                        {/* Render attached images & videos */}
                        <AttachmentsGallery
                          attachments={msg.attachments}
                          onPreviewImage={(url) => setLightboxUrl(url)}
                        />
                      </div>
                      {isSchool && (
                        <div className="w-8 h-8 rounded-xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          <Building className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Composer */}
            <div className="p-4 bg-white border-t border-slate-200 space-y-3">
              <Textarea
                placeholder="Rédigez votre réponse ou confirmation pour l’équipe d’assistance SchoolOS..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={3}
                className="resize-none text-xs rounded-xl border-slate-200 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20"
              />

              {/* Attachments for reply */}
              <AttachmentUploader
                attachments={replyAttachments}
                onChange={setReplyAttachments}
                disabled={submittingReply}
              />

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-400">
                  Votre message et pièces jointes seront instantanément notifiés à l’équipe SchoolOS.
                </p>
                <Button
                  onClick={handleSendReply}
                  disabled={(!replyMessage.trim() && replyAttachments.length === 0) || submittingReply}
                  className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-xl h-9 px-4 gap-1.5 shadow-xs"
                >
                  {submittingReply ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Envoyer ma réponse
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* New Ticket Creation Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-slate-200 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#0F172A] flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#0066FF]" />
              Nouvelle Demande d’Assistance
            </DialogTitle>
            <p className="text-xs text-slate-500 font-medium">
              Votre requête sera prise en charge par un ingénieur spécialisé dans le cadre de votre contrat SchoolOS.
            </p>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Catégorie de la demande <span className="text-rose-500">*</span>
              </label>
              <select
                value={newTicketForm.category}
                onChange={(e) =>
                  setNewTicketForm({ ...newTicketForm, category: e.target.value as TenantTicket['category'] })
                }
                className="w-full h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
                required
              >
                <option value="technical">Assistance Technique & Paramétrage</option>
                <option value="feature_request">Évolution & Export Massar (Format MEN)</option>
                <option value="cndp_compliance">Conformité CNDP (Loi 09-08 & Vidéosurveillance)</option>
                <option value="onboarding">Passerelle SMS & WhatsApp (Inwi, Orange, Maroc Telecom)</option>
                <option value="billing">Facturation & Renouvellement Licence</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Niveau d’urgence <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newTicketForm.priority}
                  onChange={(e) =>
                    setNewTicketForm({ ...newTicketForm, priority: e.target.value as TenantTicket['priority'] })
                  }
                  className="w-full h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
                  required
                >
                  <option value="low">Basse (Question générale)</option>
                  <option value="medium">Moyenne (Fonctionnement standard)</option>
                  <option value="high">Haute (Blocage partiel)</option>
                  <option value="critical">Critique (Blocage exploitation / Conseils de classe)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Établissement demandeur
                </label>
                <div className="h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-semibold flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span>Votre établissement</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Sujet de la demande <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="Ex: Erreur lors de l'export XML des bulletins Massar 2026..."
                value={newTicketForm.subject}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                className="h-9 text-xs rounded-xl border-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Description détaillée <span className="text-rose-500">*</span>
              </label>
              <Textarea
                placeholder="Veuillez décrire le problème rencontré, les étapes pour le reproduire ou les documents requis..."
                value={newTicketForm.initialMessage}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, initialMessage: e.target.value })}
                rows={4}
                className="text-xs rounded-xl border-slate-200"
                required
              />
            </div>

            {/* Attachments for new ticket */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Pièces jointes (Captures d&apos;écran, vidéos d&apos;enregistrement d&apos;écran jusqu&apos;à 50 Mo)
              </label>
              <AttachmentUploader
                attachments={newTicketAttachments}
                onChange={setNewTicketAttachments}
                disabled={creatingTicket}
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={creatingTicket}
                className="h-9 text-xs rounded-xl border-slate-200"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-2 shadow-xs"
                disabled={creatingTicket}
              >
                {creatingTicket ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Envoyer le ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
