'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
  Building2,
  User,
  Send,
  MessageSquare,
  ShieldAlert,
  Loader2,
  Tag,
} from 'lucide-react';
import type { PlatformTicket } from '@/app/api/super-admin/support/route';

interface TicketStats {
  total: number;
  open: number;
  critical: number;
  resolved: number;
  avgResponseTime: string;
}

const CATEGORY_LABELS: Record<PlatformTicket['category'], string> = {
  technical: 'Technique',
  billing: 'Facturation & Licence',
  onboarding: 'Déploiement Initial',
  cndp_compliance: 'Conformité CNDP',
  feature_request: 'Évolution / Massar',
};

const PRIORITY_BADGES: Record<PlatformTicket['priority'], { label: string; className: string }> = {
  critical: { label: 'Critique', className: 'bg-rose-100 text-rose-700 font-extrabold border-rose-200' },
  high: { label: 'Haute', className: 'bg-amber-100 text-amber-800 font-bold border-amber-200' },
  medium: { label: 'Moyenne', className: 'bg-blue-100 text-blue-700 font-semibold border-blue-200' },
  low: { label: 'Basse', className: 'bg-slate-100 text-slate-600 font-medium border-slate-200' },
};

const STATUS_BADGES: Record<PlatformTicket['status'], { label: string; className: string }> = {
  new: { label: 'Nouveau', className: 'bg-indigo-100 text-indigo-700 font-bold' },
  in_progress: { label: 'En cours', className: 'bg-blue-100 text-[#0066FF] font-bold' },
  waiting_client: { label: 'Attente École', className: 'bg-amber-100 text-amber-800 font-medium' },
  resolved: { label: 'Résolu', className: 'bg-[#DDF5EC] text-[#17A673] font-bold' },
  closed: { label: 'Fermé', className: 'bg-slate-100 text-slate-500 line-through' },
};

export function SuperAdminSupportView() {
  const [tickets, setTickets] = useState<PlatformTicket[]>([]);
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    critical: 0,
    resolved: 0,
    avgResponseTime: '15 min',
  });
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Selected Ticket Drawer / Modal
  const [activeTicket, setActiveTicket] = useState<PlatformTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState<PlatformTicket['status']>('in_progress');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

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
        setStats(json.data.stats || { total: 0, open: 0, critical: 0, resolved: 0, avgResponseTime: '15 min' });
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

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setSubmittingReply(true);
    try {
      const res = await fetch('/api/super-admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          status: newStatus,
          replyMessage: replyMessage.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessNotice('Réponse transmise avec succès à l’établissement.');
        setActiveTicket(null);
        setReplyMessage('');
        fetchTickets();
      }
    } catch (e) {
      console.error('Failed to update ticket', e);
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2.5">
            <LifeBuoy className="w-6 h-6 text-[#0066FF]" />
            Centre de Support Multi-Établissements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion centralisée des tickets d'assistance, requêtes Massar, déclarations CNDP et support technique.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTickets}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
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
            Fermer
          </button>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tickets Ouverts</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-[#0066FF]">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0066FF]">{stats.open}</div>
          <p className="text-[11px] text-slate-400">Demandes actives en attente de réponse</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Priorité Critique / Haute</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-600">{stats.critical}</div>
          <p className="text-[11px] text-slate-400">Blocages d'exploitation / SLA serré</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tickets Résolus</span>
            <div className="w-8 h-8 rounded-xl bg-[#DDF5EC] flex items-center justify-center text-[#17A673]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#17A673]">{stats.resolved}</div>
          <p className="text-[11px] text-slate-400">Demandes clôturées avec succès</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Temps Moyen de Réponse</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-violet-700">{stats.avgResponseTime}</div>
          <p className="text-[11px] text-slate-400">Délai moyen de première prise en charge</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par école, sujet ou contact..."
              className="pl-9 h-9 text-xs rounded-xl border-slate-200"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">Tous les statuts</option>
            <option value="new">Nouveaux</option>
            <option value="in_progress">En cours</option>
            <option value="waiting_client">En attente école</option>
            <option value="resolved">Résolus</option>
            <option value="closed">Fermés</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">Toutes priorités</option>
            <option value="critical">Critique</option>
            <option value="high">Haute</option>
            <option value="medium">Moyenne</option>
            <option value="low">Basse</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">Toutes catégories</option>
            <option value="technical">Technique</option>
            <option value="billing">Facturation</option>
            <option value="onboarding">Déploiement</option>
            <option value="cndp_compliance">Conformité CNDP</option>
            <option value="feature_request">Évolution / Massar</option>
          </select>
        </div>
      </Card>

      {/* Tickets List */}
      <Card className="rounded-2xl border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Établissement</th>
                <th className="py-3 px-4">Sujet & Dernier Message</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Priorité</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Assigné à</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0066FF] mb-2" />
                    Chargement des tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Aucun ticket de support trouvé pour ces critères.
                  </td>
                </tr>
              ) : (
                tickets.map((tkt) => {
                  const pBadge = PRIORITY_BADGES[tkt.priority];
                  const sBadge = STATUS_BADGES[tkt.status];
                  return (
                    <tr key={tkt.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#16212B]">{tkt.schoolName}</div>
                        <div className="text-[11px] text-slate-400">{tkt.contactName}</div>
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-bold text-slate-900">{tkt.subject}</div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5" title={tkt.lastMessage}>
                          {tkt.lastMessage}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="neutral" className="text-[11px] border-slate-200 font-medium bg-white">
                          {CATEGORY_LABELS[tkt.category]}
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
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {tkt.assignedTo || <span className="text-slate-400 italic">Non assigné</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveTicket(tkt);
                            setNewStatus(tkt.status);
                            setReplyMessage('');
                          }}
                          className="h-8 text-xs rounded-xl border-slate-200 hover:border-[#0066FF] hover:text-[#0066FF] font-semibold"
                        >
                          Traiter
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

      {/* Ticket Response Dialog */}
      <Dialog open={Boolean(activeTicket)} onOpenChange={(open) => !open && setActiveTicket(null)}>
        {activeTicket && (
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="text-base font-extrabold text-[#16212B]">
                  Ticket #{activeTicket.id.toUpperCase()} — {activeTicket.schoolName}
                </DialogTitle>
                <Badge className={`${PRIORITY_BADGES[activeTicket.priority].className} text-[10px]`}>
                  {PRIORITY_BADGES[activeTicket.priority].label}
                </Badge>
              </div>
            </DialogHeader>

            <form onSubmit={handleUpdateTicket} className="space-y-4 py-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-bold text-slate-700">{activeTicket.subject}</span>
                  <span>{new Date(activeTicket.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <p className="text-slate-600 italic">&ldquo;{activeTicket.lastMessage}&rdquo;</p>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-200/60">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Contact: {activeTicket.contactName} ({activeTicket.contactEmail})</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Mettre à jour le statut</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="new">Nouveau</option>
                    <option value="in_progress">En cours de traitement</option>
                    <option value="waiting_client">En attente retour école</option>
                    <option value="resolved">Résolu / Clôturé</option>
                    <option value="closed">Fermé sans suite</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Catégorie</label>
                  <Input
                    disabled
                    value={CATEGORY_LABELS[activeTicket.category]}
                    className="h-9 text-xs rounded-xl bg-slate-100 text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Rédiger une réponse à l'établissement (notification envoyée par e-mail & tableau de bord)
                </label>
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Bonjour, votre demande a été prise en compte..."
                  rows={4}
                  className="text-xs rounded-xl border-slate-200 resize-none"
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
                  Fermer
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingReply}
                  className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
                >
                  {submittingReply && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Send className="w-3.5 h-3.5" />
                  Transmettre la réponse
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
