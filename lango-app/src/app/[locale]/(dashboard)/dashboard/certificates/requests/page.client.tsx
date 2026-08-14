'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PenLine,
  Plus,
  Search,
  RefreshCw,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  MessageSquareWarning,
  X,
  Loader2,
  UserCheck,
} from 'lucide-react';

type RequestRow = {
  id: string;
  definitionId: string;
  requesterId: string;
  recipientId: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  definitionTitle: string;
  requesterName: string | null;
};

type Recipient = {
  id: string;
  name: string | null;
  matricule: string | null;
  employeeId: string | null;
  role: string;
};

type Definition = {
  id: string;
  title: string;
  allowedTargetType: 'student' | 'employee';
  status: string;
};

const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }> = {
  draft: { label: 'Brouillon', variant: 'warning' },
  submitted: { label: 'Soumise', variant: 'info' },
  under_review: { label: 'En révision', variant: 'warning' },
  changes_requested: { label: 'Modifs demandées', variant: 'warning' },
  approved: { label: 'Approuvée', variant: 'success' },
  issued: { label: 'Émise', variant: 'success' },
  rejected: { label: 'Rejetée', variant: 'danger' },
  cancelled: { label: 'Annulée', variant: 'neutral' },
};

// Direct (no-reason) actions per status, and actions that need a reason.
const DIRECT_ACTIONS: Record<string, string[]> = {
  draft: ['submit', 'cancel'],
  submitted: ['review', 'cancel'],
  under_review: ['approve', 'cancel'],
  changes_requested: ['review', 'cancel'],
  approved: ['cancel'],
  issued: [],
  rejected: [],
  cancelled: [],
};

const ACTION_LABELS: Record<string, string> = {
  submit: 'Soumettre',
  review: 'Examiner',
  approve: 'Approuver',
  reject: 'Rejeter',
  request_changes: 'Demander modifs',
  cancel: 'Annuler',
};

const ACTION_ICONS: Record<string, any> = {
  submit: Send,
  review: Eye,
  approve: CheckCircle2,
  reject: XCircle,
  request_changes: MessageSquareWarning,
  cancel: X,
};

export default function CertificatesRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actingId, setActingId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [selectedType, setSelectedType] = useState<'student' | 'employee'>('student');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [reasonAction, setReasonAction] = useState<{ id: string; action: string } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonSubmitting, setReasonSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/certificates/requests').then(r => r.json());
      if (res.success) setRequests(res.data);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipients = async () => {
    const [s, e] = await Promise.all([
      fetch('/api/certificates/recipients?type=student').then(r => r.json()),
      fetch('/api/certificates/recipients?type=employee').then(r => r.json()),
    ]);
    const all: Recipient[] = [];
    if (s.success) all.push(...s.data);
    if (e.success) all.push(...e.data);
    setRecipients(all);
  };

  useEffect(() => {
    load();
    loadRecipients();
  }, []);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recipients) map.set(r.id, r.name ?? r.id);
    return map;
  }, [recipients]);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of requests) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [requests]);

  const filtered = useMemo(() => {
    return statusFilter === 'all'
      ? requests
      : requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const openCreate = async () => {
    setSelectedDefinitionId('');
    setSelectedType('student');
    setSelectedRecipientId('');
    setRecipientSearch('');
    setNotes('');
    setCreateError(null);
    setIsCreateOpen(true);
    const res = await fetch('/api/certificates/definitions').then(r => r.json());
    if (res.success) setDefinitions(res.data.filter((d: Definition) => d.status !== 'archived'));
  };

  const selectDefinition = (definitionId: string) => {
    setSelectedDefinitionId(definitionId);
    setSelectedRecipientId('');
    const def = definitions.find(d => d.id === definitionId);
    setSelectedType(def?.allowedTargetType ?? 'student');
  };

  const typeRecipients = useMemo(() => {
    const q = recipientSearch.toLowerCase();
    return recipients
      .filter(r => selectedType === 'student' ? r.role === 'student' : r.role !== 'student')
      .filter(r => (r.name?.toLowerCase().includes(q) ?? false) || (r.matricule?.toLowerCase().includes(q) ?? false) || (r.employeeId?.toLowerCase().includes(q) ?? false));
  }, [recipients, recipientSearch, selectedType]);

  const handleCreate = async () => {
    if (!selectedDefinitionId || !selectedRecipientId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/certificates/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definitionId: selectedDefinitionId,
          recipientId: selectedRecipientId,
          recipientType: selectedType,
          notes: notes.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setCreateError(json.message || json.error?.message || 'Erreur lors de la création.');
        return;
      }
      setIsCreateOpen(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (id: string, action: string, reasonText?: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/certificates/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reasonText?.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || json.error?.message || 'Erreur lors de l\'action.');
      }
      setReasonAction(null);
      setReason('');
      await load();
    } finally {
      setActingId(null);
    }
  };

  const submitReason = async () => {
    if (!reasonAction) return;
    setReasonSubmitting(true);
    try {
      await runAction(reasonAction.id, reasonAction.action, reason);
    } finally {
      setReasonSubmitting(false);
    }
  };

  const awaitingReview = (counts.submitted ?? 0) + (counts.under_review ?? 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <PenLine className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Demandes & Approbations</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Circuit de validation quatre yeux pour les émissions de certificats.</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
          <Plus className="w-4 h-4" /><span>Nouvelle demande</span>
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{requests.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><PenLine className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">À traiter</span>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{awaitingReview}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Eye className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Approuvées</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{counts.approved ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rejetées</span>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{counts.rejected ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><XCircle className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 h-9 text-xs"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tous les statuts</SelectItem>
              <SelectItem value="draft" className="text-xs">Brouillon</SelectItem>
              <SelectItem value="submitted" className="text-xs">Soumise</SelectItem>
              <SelectItem value="under_review" className="text-xs">En révision</SelectItem>
              <SelectItem value="approved" className="text-xs">Approuvée</SelectItem>
              <SelectItem value="rejected" className="text-xs">Rejetée</SelectItem>
              <SelectItem value="issued" className="text-xs">Émise</SelectItem>
              <SelectItem value="cancelled" className="text-xs">Annulée</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Actualiser
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 pl-4">Définition</th>
                <th className="p-3">Bénéficiaire</th>
                <th className="p-3">Demandeur</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Créée le</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucune demande trouvée.</td></tr>
              ) : (
                filtered.map(r => {
                  const actions = DIRECT_ACTIONS[r.status] ?? [];
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-3 pl-4 font-semibold text-slate-700">{r.definitionTitle}</td>
                      <td className="p-3 text-slate-600">{nameById.get(r.recipientId) ?? r.recipientId}</td>
                      <td className="p-3 text-slate-500">{r.requesterName ?? '—'}</td>
                      <td className="p-3">
                        <Badge variant={STATUS_BADGE[r.status]?.variant || 'neutral'}>
                          {STATUS_BADGE[r.status]?.label || r.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className="p-3 pr-4 text-right space-x-1.5 whitespace-nowrap">
                        {actions.includes('reject') && (
                          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => { setReasonAction({ id: r.id, action: 'reject' }); setReason(''); }}>
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />Rejeter
                          </Button>
                        )}
                        {actions.includes('request_changes') && (
                          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => { setReasonAction({ id: r.id, action: 'request_changes' }); setReason(''); }}>
                            <MessageSquareWarning className="w-3.5 h-3.5 mr-1.5" />Modifs
                          </Button>
                        )}
                        {actions.filter(a => !['reject', 'request_changes'].includes(a)).map(a => {
                          const Icon = ACTION_ICONS[a] || Loader2;
                          return (
                            <Button
                              key={a}
                              variant={a === 'approve' ? 'default' : 'outline'}
                              size="sm"
                              className={`h-8 rounded-lg text-xs font-medium cursor-pointer ${a === 'approve' ? 'bg-[#17A673] hover:bg-[#138A60] text-white border-0' : ''}`}
                              onClick={() => runAction(r.id, a)}
                              disabled={actingId === r.id}
                            >
                              {actingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Icon className="w-3.5 h-3.5 mr-1.5" />}
                              {ACTION_LABELS[a]}
                            </Button>
                          );
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create request dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Nouvelle demande de certificat</DialogTitle>
            <DialogDescription>La demande suivra le circuit de validation avant émission.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Définition</Label>
              <Select value={selectedDefinitionId} onValueChange={selectDefinition}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choisir une définition" /></SelectTrigger>
                <SelectContent>
                  {definitions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-400">Aucune définition disponible.</p>
                  ) : (
                    definitions.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">{d.title}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">
                Bénéficiaire — {selectedType === 'student' ? 'Élèves' : 'Employés'}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={recipientSearch}
                  onChange={e => setRecipientSearch(e.target.value)}
                  placeholder="Rechercher par nom..."
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
              <div className="border border-slate-100 rounded-xl max-h-48 overflow-y-auto">
                {typeRecipients.length === 0 ? (
                  <p className="p-4 text-xs text-slate-400 text-center">Aucun bénéficiaire trouvé.</p>
                ) : (
                  typeRecipients.map(r => (
                    <label
                      key={r.id}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                    >
                      <input
                        type="radio"
                        name="recipient"
                        checked={selectedRecipientId === r.id}
                        onChange={() => setSelectedRecipientId(r.id)}
                        className="w-4 h-4 accent-[#2487B8]"
                      />
                      <span className="text-xs font-medium text-slate-700">{r.name}</span>
                      {r.role !== 'student' && <span className="text-[10px] text-slate-400">{r.role}</span>}
                      {(r.matricule || r.employeeId) && <span className="text-[10px] text-slate-400 ml-auto font-mono">{r.matricule || r.employeeId}</span>}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Notes (optionnelles)</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
              />
            </div>
            {createError && <p className="text-xs font-semibold text-rose-600">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 cursor-pointer">Annuler</Button>
            <Button className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleCreate} disabled={creating || !selectedDefinitionId || !selectedRecipientId}>
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Création...' : 'Créer la demande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason dialog (reject / request_changes) */}
      <Dialog open={reasonAction !== null} onOpenChange={(o) => { if (!o && !reasonSubmitting) setReasonAction(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{reasonAction?.action === 'reject' ? 'Rejeter la demande' : 'Demander des modifications'}</DialogTitle>
            <DialogDescription>
              {reasonAction?.action === 'reject'
                ? 'La demande sera rejetée et l\'émission bloquée.'
                : 'La demande reviendra au demandeur pour correction.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs font-bold text-slate-700">Motif (requis)</Label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Précisez le motif..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonAction(null)} className="text-xs h-9 cursor-pointer" disabled={reasonSubmitting}>Annuler</Button>
            <Button
              className={`text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer ${reasonAction?.action === 'reject' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
              onClick={submitReason}
              disabled={reasonSubmitting || !reason.trim()}
            >
              {reasonSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {reasonSubmitting ? 'Envoi...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
