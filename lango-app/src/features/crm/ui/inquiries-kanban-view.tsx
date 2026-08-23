'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Plus,
  Filter,
  RefreshCw,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Clock,
  X,
  UserCheck,
  Send,
  Loader2,
  TrendingUp,
  Tag as TagIcon,
  AlertTriangle,
  Layers,
  History,
  Link2,
} from 'lucide-react';

type ProspectStage = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
type InquirySource = 'walk_in' | 'phone' | 'web' | 'referral' | 'facebook_ads' | 'google_ads';
type InterestLevel = 'low' | 'medium' | 'high';

interface Inquiry {
  id: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
  source: InquirySource;
  interestLevel: InterestLevel;
  status: ProspectStage;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string | null } | null;
  notes?: string | null;
  tags?: string[] | null;
  convertedApplicantId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface FollowUp {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  notes: string;
  scheduledFor?: string | null;
  completedAt?: string | null;
  createdById?: string | null;
  createdAt: string;
  createdByName?: string | null;
}

interface StaffMember {
  id: string;
  fullName: string;
  role: string;
}

const STAGES: { key: ProspectStage; label: string; color: string; bg: string }[] = [
  { key: 'new', label: 'Nouveau', color: 'text-[#0066FF]', bg: 'bg-blue-50 border-blue-200' },
  { key: 'contacted', label: 'Contacté', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { key: 'qualified', label: 'Qualifié', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  { key: 'converted', label: 'Converti', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  { key: 'lost', label: 'Perdu', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
];

const TRANSITIONS: Record<ProspectStage, ProspectStage[]> = {
  new: ['contacted', 'qualified', 'lost'],
  contacted: ['new', 'qualified', 'lost'],
  qualified: ['contacted', 'lost'],
  converted: [],
  lost: ['new'],
};

const SOURCES: { value: InquirySource | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes les sources' },
  { value: 'web', label: 'Site Web / Ads' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'walk_in', label: 'Visite sur place' },
  { value: 'referral', label: 'Recommandation' },
  { value: 'facebook_ads', label: 'Publicité Facebook' },
  { value: 'google_ads', label: 'Publicité Google' },
];

const INTEREST_LABELS: Record<InterestLevel, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé' };

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Erreur ${res.status}`);
  }
  return json;
}

export function InquiriesKanbanView() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<ProspectStage, number>>({ new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<InquirySource | 'all'>('all');
  const [tag, setTag] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffError, setStaffError] = useState(false);

  // Create modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLead, setNewLead] = useState({
    contactName: '', phone: '', email: '', source: 'web' as InquirySource,
    interestLevel: 'medium' as InterestLevel, notes: '', tags: '', assignedToId: '',
  });

  // Profile drawer
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [duplicates, setDuplicates] = useState<Inquiry[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMergeId, setConfirmMergeId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 3500);
  };

  // Drag-and-drop state (native HTML5 DnD — no dependency).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ProspectStage | null>(null);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('q', search.trim());
      if (source !== 'all') params.set('source', source);
      if (tag.trim()) params.set('tag', tag.trim());
      if (ownerFilter) params.set('assignedToId', ownerFilter);
      const json = await api(`/api/crm/inquiries?${params.toString()}`);
      setInquiries(json.data ?? []);
      setTotal(json.total ?? 0);
      if (json.counts) setCounts(json.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [search, source, tag, ownerFilter, page]);

  useEffect(() => { loadPipeline(); }, [loadPipeline]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (page !== 1) setPage(1); else loadPipeline();
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, source, tag, ownerFilter]);

  const loadStaff = useCallback(async () => {
    try {
      const json = await api('/api/users?pageSize=200');
      setStaff((json.data ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName, role: u.role })));
    } catch {
      setStaffError(true);
    }
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const openProfile = useCallback(async (id: string) => {
    setDrawerLoading(true);
    setConfirmDelete(false);
    setConfirmMergeId(null);
    try {
      const [inq, fups, dups] = await Promise.all([
        api(`/api/crm/inquiries/${id}`),
        api(`/api/crm/inquiries/${id}/follow-ups`).catch(() => ({ data: [] })),
        api(`/api/crm/inquiries/${id}/duplicates`).catch(() => ({ data: [] })),
      ]);
      setSelected(inq.data);
      setFollowUps(fups.data ?? []);
      setDuplicates(dups.data ?? []);
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Impossible d\'ouvrir la fiche');
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!selected) return;
    await openProfile(selected.id);
  }, [selected, openProfile]);

  const updateStage = async (id: string, status: ProspectStage) => {
    setBusyAction(`stage:${id}`);
    try {
      await api(`/api/crm/inquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, status } : prev));
      await loadPipeline();
      if (selected?.id === id) await openProfile(id);
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Transition refusée');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDrop = (targetStage: ProspectStage) => {
    if (!dragId) return;
    const id = dragId;
    const source = inquiries.find((i) => i.id === id);
    setDragId(null);
    setDragOverStage(null);
    if (!source) return;
    if (source.status === targetStage) return;
    if (!TRANSITIONS[source.status].includes(targetStage)) {
      showToast('err', `Transition de « ${source.status} » vers « ${targetStage} » non autorisée`);
      return;
    }
    void updateStage(id, targetStage);
  };

  const saveLead = async () => {
    if (!selected) return;
    setBusyAction('save');
    const tags = selected.tags ?? [];
    try {
      const updated = await api(`/api/crm/inquiries/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          contactName: selected.contactName,
          phone: selected.phone || null,
          email: selected.email || null,
          assignedToId: selected.assignedToId || null,
          notes: selected.notes || null,
          tags,
        }),
      });
      setSelected((prev) => (prev ? { ...prev, ...updated.data } : prev));
      showToast('ok', 'Fiche mise à jour');
      await loadPipeline();
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Mise à jour impossible');
    } finally {
      setBusyAction(null);
    }
  };

  const toggleTag = (t: string) => {
    if (!selected) return;
    const tags = selected.tags ?? [];
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    setSelected((prev) => (prev ? { ...prev, tags: next } : prev));
  };

  const addFollowUp = async (type: FollowUp['type'], notes: string) => {
    if (!selected || !notes.trim()) return;
    setBusyAction('followup');
    try {
      await api(`/api/crm/inquiries/${selected.id}/follow-ups`, {
        method: 'POST', body: JSON.stringify({ type, notes }),
      });
      await openProfile(selected.id);
      showToast('ok', 'Suivi enregistré');
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setBusyAction(null);
    }
  };

  const convert = async (id: string) => {
    setBusyAction('convert');
    try {
      await api('/api/admissions/inquiries/convert', { method: 'POST', body: JSON.stringify({ inquiryId: id }) });
      showToast('ok', 'Prospect converti en candidat');
      await loadPipeline();
      if (selected?.id === id) await openProfile(id);
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Conversion impossible');
    } finally {
      setBusyAction(null);
    }
  };

  const removeLead = async () => {
    if (!selected) return;
    setBusyAction('delete');
    try {
      await api(`/api/crm/inquiries/${selected.id}`, { method: 'DELETE' });
      showToast('ok', 'Prospect supprimé');
      setSelected(null);
      await loadPipeline();
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Suppression impossible');
    } finally {
      setBusyAction(null);
    }
  };

  const mergeInto = async (primaryId: string, secondaryId: string) => {
    setBusyAction('merge');
    try {
      await api('/api/crm/inquiries/merge', {
        method: 'POST', body: JSON.stringify({ primaryId, secondaryIds: [secondaryId] }),
      });
      showToast('ok', 'Fiches fusionnées');
      setConfirmMergeId(null);
      await openProfile(primaryId);
      await loadPipeline();
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Fusion impossible');
    } finally {
      setBusyAction(null);
    }
  };

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.contactName.trim()) return;
    setCreating(true);
    try {
      const tags = newLead.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await api('/api/crm/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          contactName: newLead.contactName,
          phone: newLead.phone || undefined,
          email: newLead.email || undefined,
          source: newLead.source,
          interestLevel: newLead.interestLevel,
          notes: newLead.notes || undefined,
          assignedToId: newLead.assignedToId || undefined,
          tags,
        }),
      });
      setIsAddOpen(false);
      setNewLead({ contactName: '', phone: '', email: '', source: 'web', interestLevel: 'medium', notes: '', tags: '', assignedToId: '' });
      showToast('ok', 'Prospect ajouté');
      setPage(1);
      await loadPipeline();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setCreating(false);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<ProspectStage, Inquiry[]> = { new: [], contacted: [], qualified: [], converted: [], lost: [] };
    for (const iq of inquiries) map[iq.status]?.push(iq);
    return map;
  }, [inquiries]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] px-4 py-3 rounded-xl shadow-lg border text-sm font-bold ${toast.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-2xs shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Pipeline CRM & Management des Prospects
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Suivi dynamique des prospects, qualification des inscriptions et conversion directe en candidats élèves.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadPipeline} className="rounded-xl border-slate-200 text-slate-700 font-bold text-xs gap-1.5 h-10 px-4 cursor-pointer">
            <RefreshCw className={`w-4 h-4 text-[#0066FF] ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </Button>
          <Button onClick={() => setIsAddOpen(true)} size="sm" className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl shadow-2xs gap-2 h-10 px-4 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>+ Nouveau Prospect</span>
          </Button>
        </div>
      </div>

      {/* KPI / capacity bar */}
      <Card className="p-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-slate-50 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-[#0066FF] flex items-center justify-center shadow-2xs font-extrabold shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-extrabold text-[#16212B] flex items-center gap-2">
              Jauge de Capacité Prospects — Licence Centre:
              <Badge variant="info" className="text-[10px] font-bold">{total} / 1000 Prospects Utilisés</Badge>
            </span>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Volume total des demandes d'admissions capturées dans la base de données.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((stg) => (
            <Badge key={stg.key} variant="neutral" className={`text-[10px] font-bold ${stg.bg} ${stg.color}`}>
              {stg.label}: {counts[stg.key] ?? 0}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher par nom, téléphone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white h-10 font-medium text-slate-800"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              className="pl-9 pr-2 h-10 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 cursor-pointer"
            >
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="relative">
            <TagIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag..." className="pl-9 text-xs rounded-xl border-slate-200 h-10 w-28" />
          </div>
          {!staffError && (
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 px-2 cursor-pointer">
              <option value="">Tous les propriétaires</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Kanban board */}
      <p className="text-[11px] text-slate-400 font-medium">Astuce : glissez-déposez une carte vers une autre colonne pour changer son statut.</p>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
        {STAGES.map((stg) => {
          const colItems = grouped[stg.key];
          return (
            <div
              key={stg.key}
              onDragOver={(e) => { e.preventDefault(); if (dragOverStage !== stg.key) setDragOverStage(stg.key); }}
              onDrop={() => handleDrop(stg.key)}
              className={`space-y-3 p-3 rounded-2xl border min-h-[520px] flex flex-col justify-between transition-colors ${dragOverStage === stg.key ? 'bg-blue-50/80 border-[#0066FF] ring-2 ring-[#0066FF]/20' : 'bg-slate-50/70 border-slate-200/70'}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-xl border ${stg.bg} ${stg.color}`}>{stg.label}</span>
                  <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">{colItems.length}</span>
                </div>
                <div className="space-y-3">
                  {colItems.map((item) => (
                    <Card
                      key={item.id}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      onDragEnd={() => { setDragId(null); setDragOverStage(null); }}
                      onClick={() => openProfile(item.id)}
                      className={`p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 hover:border-[#0066FF] hover:shadow-md transition-all cursor-grab active:cursor-grabbing group ${dragId === item.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-[#16212B] group-hover:text-[#0066FF] transition-colors leading-snug truncate">{item.contactName}</h3>
                        <Badge variant={item.interestLevel === 'high' ? 'success' : item.interestLevel === 'medium' ? 'info' : 'neutral'} className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 shrink-0">
                          {INTEREST_LABELS[item.interestLevel]}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-1">
                        {item.phone && <p className="flex items-center gap-1.5 font-medium"><Phone className="w-3 h-3 text-[#0066FF]" /><span>{item.phone}</span></p>}
                        {item.email && <p className="flex items-center gap-1.5 font-medium truncate"><Mail className="w-3 h-3 text-slate-400" /><span className="truncate">{item.email}</span></p>}
                      </div>
                      {(item.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags!.slice(0, 3).map((t) => <Badge key={t} variant="neutral" className="text-[9px] font-bold text-[#0066FF]">{t}</Badge>)}
                        </div>
                      )}
                      {item.notes && <p className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">{item.notes}</p>}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-400">
                        <span className="uppercase text-[#0066FF] font-bold">{item.source.replace('_', ' ')}</span>
                        <span>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </Card>
                  ))}
                  {colItems.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium py-12 border border-dashed border-slate-200 rounded-xl">Aucun prospect</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500">{total} prospect(s) — page {page}/{totalPages}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-xl text-xs cursor-pointer">Précédent</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-xl text-xs cursor-pointer">Suivant</Button>
        </div>
      </div>

      {/* Create modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-[#16212B]">Nouveau Prospect CRM</h2>
              <button onClick={() => setIsAddOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createLead} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">Nom Complet du Prospect *</label>
                <Input type="text" required value={newLead.contactName} onChange={(e) => setNewLead({ ...newLead, contactName: e.target.value })} placeholder="Ex: Youssef El Fassi" className="mt-1 text-xs rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Téléphone</label>
                  <Input type="text" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} placeholder="+212 6 00 00 00 00" className="mt-1 text-xs rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Email</label>
                  <Input type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} placeholder="prospect@email.com" className="mt-1 text-xs rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Source d'Acquisition</label>
                  <select value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value as any })} className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 font-medium">
                    {SOURCES.filter((s) => s.value !== 'all').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Intérêt</label>
                  <select value={newLead.interestLevel} onChange={(e) => setNewLead({ ...newLead, interestLevel: e.target.value as any })} className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 font-medium">
                    <option value="low">Faible</option><option value="medium">Moyen</option><option value="high">Élevé</option>
                  </select>
                </div>
              </div>
              {!staffError && (
                <div>
                  <label className="text-xs font-bold text-slate-700">Propriétaire</label>
                  <select value={newLead.assignedToId} onChange={(e) => setNewLead({ ...newLead, assignedToId: e.target.value })} className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 font-medium">
                    <option value="">Non assigné</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-700">Tags (séparés par des virgules)</label>
                <Input value={newLead.tags} onChange={(e) => setNewLead({ ...newLead, tags: e.target.value })} placeholder="urgent, ads" className="mt-1 text-xs rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Notes / Remarques</label>
                <textarea value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Objectif de formation, niveau souhaité..." rows={3} className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF]" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="text-xs rounded-xl">Annuler</Button>
                <Button type="submit" disabled={creating} className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-2xs">
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ajouter le Prospect'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {drawerLoading ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0066FF]" /></div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div>
                    <Badge variant="info" className="text-[10px] font-bold uppercase">Fiche Prospect CRM</Badge>
                    <h2 className="text-lg font-extrabold text-[#16212B] mt-1">{selected.contactName}</h2>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {selected.source.replace('_', ' ')} · {selected.interestLevel && INTEREST_LABELS[selected.interestLevel]} · créé le {new Date(selected.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
                </div>

                {/* Stepper */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Statut du Pipeline:</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {STAGES.map((stg) => {
                      const isCurrent = selected.status === stg.key;
                      const isReachable = !isCurrent && TRANSITIONS[selected.status]?.includes(stg.key);
                      return (
                        <button
                          key={stg.key}
                          disabled={!isCurrent && !isReachable}
                          onClick={() => updateStage(selected.id, stg.key)}
                          className={`p-2 rounded-xl text-[10px] font-extrabold transition-all text-center border ${isCurrent ? 'bg-[#0066FF] text-white border-[#0066FF] shadow-2xs' : isReachable ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 cursor-pointer' : 'bg-slate-50 text-slate-300 border-slate-100 opacity-60'}`}
                        >
                          {stg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contact + actions */}
                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500">Téléphone</label>
                      <Input value={selected.phone ?? ''} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} className="mt-1 text-xs rounded-xl bg-white" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500">Email</label>
                      <Input value={selected.email ?? ''} onChange={(e) => setSelected({ ...selected, email: e.target.value })} className="mt-1 text-xs rounded-xl bg-white" />
                    </div>
                  </div>
                  {!staffError && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-500">Propriétaire</label>
                      <select value={selected.assignedToId ?? ''} onChange={(e) => setSelected({ ...selected, assignedToId: e.target.value || null })} className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white font-medium">
                        <option value="">Non assigné</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button onClick={saveLead} disabled={busyAction === 'save'} className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-1.5">
                      {busyAction === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Enregistrer
                    </Button>
                    {selected.phone && (
                      <a href={`https://wa.me/${selected.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                        <Send className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                {/* Convert / Delete */}
                <div className="flex items-center gap-2">
                  {selected.status !== 'converted' && (
                    <Button onClick={() => convert(selected.id)} disabled={busyAction === 'convert'} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-2">
                      {busyAction === 'convert' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Convertir en Élève Inscrit
                    </Button>
                  )}
                  {selected.status === 'converted' && (
                    <div className="flex-1 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Converti en candidat
                    </div>
                  )}
                  {!selected.convertedApplicantId && (
                    !confirmDelete ? (
                      <Button variant="outline" onClick={() => setConfirmDelete(true)} className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs rounded-xl font-bold">Supprimer</Button>
                    ) : (
                      <Button variant="destructive" onClick={removeLead} disabled={busyAction === 'delete'} className="text-xs rounded-xl font-bold">
                        {busyAction === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />} Confirmer
                      </Button>
                    )
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.tags ?? []).map((t) => (
                      <button key={t} type="button" onClick={() => toggleTag(t)} className="cursor-pointer">
                        <Badge variant="info" className="text-[10px] font-bold gap-1">
                          {t} <X className="w-3 h-3" />
                        </Badge>
                      </button>
                    ))}
                    {selected.tags && selected.tags.length < 20 && (
                      <input
                        placeholder="+ tag"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); const v = (e.target as HTMLInputElement).value.trim(); if (v) { toggleTag(v); (e.target as HTMLInputElement).value = ''; } }
                        }}
                        className="w-20 text-[11px] px-2 py-1 rounded-lg border border-dashed border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#0066FF]"
                      />
                    )}
                  </div>
                </div>

                {/* Duplicates */}
                {duplicates.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Doublons détectés</label>
                    {duplicates.map((d) => (
                      <div key={d.id} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-amber-900">{d.contactName}</span>
                          <Badge variant="neutral" className="text-[9px] font-bold">{d.source}</Badge>
                        </div>
                        <div className="text-[10px] text-amber-700">{d.phone || d.email} · {d.status}</div>
                        <div className="flex gap-2">
                          {!confirmMergeId ? (
                            <button onClick={() => setConfirmMergeId(d.id)} className="text-[10px] font-bold text-[#0066FF] hover:underline cursor-pointer flex items-center gap-1"><Link2 className="w-3 h-3" /> Fusionner dans cette fiche</button>
                          ) : (
                            <button onClick={() => mergeInto(selected.id, d.id)} disabled={busyAction === 'merge'} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 cursor-pointer">
                              {busyAction === 'merge' ? 'Fusion...' : 'Confirmer la fusion'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Notes</label>
                  <textarea
                    value={selected.notes ?? ''}
                    onChange={(e) => setSelected({ ...selected, notes: e.target.value })}
                    rows={3}
                    placeholder="Notes internes..."
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>

                {/* Activity / follow-ups */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><History className="w-3.5 h-3.5" /> Activité & Relances</label>
                  {followUps.map((f) => (
                    <div key={f.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant={f.type === 'call' ? 'info' : f.type === 'email' ? 'warning' : f.type === 'meeting' ? 'success' : 'neutral'} className="text-[9px] font-bold uppercase">{f.type}</Badge>
                        <span className="text-[10px] text-slate-400 font-semibold">{new Date(f.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{f.notes}</p>
                      {f.createdByName && <p className="text-[10px] text-slate-400 font-semibold">par {f.createdByName}</p>}
                    </div>
                  ))}
                  {followUps.length === 0 && <p className="text-[11px] text-slate-400 font-medium">Aucun suivi enregistré.</p>}
                  <FollowUpComposer busy={busyAction === 'followup'} onSubmit={addFollowUp} />
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-slate-100 p-6 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium">Créé le {new Date(selected.createdAt).toLocaleString('fr-FR')}</span>
              <Button variant="ghost" onClick={() => setSelected(null)} className="text-xs rounded-xl">Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FollowUpComposer({ busy, onSubmit }: { busy: boolean; onSubmit: (type: FollowUp['type'], notes: string) => void }) {
  const [type, setType] = useState<FollowUp['type']>('call');
  const [notes, setNotes] = useState('');
  return (
    <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
      <div className="flex items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as any)} className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer">
          <option value="call">Appel</option>
          <option value="email">Email</option>
          <option value="meeting">Rendez-vous</option>
          <option value="note">Note</option>
        </select>
        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Journaliser une action</span>
      </div>
      <div className="flex gap-2">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Résumé de l'appel / de la relance..."
          className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
        />
        <Button
          size="sm"
          disabled={busy || !notes.trim()}
          onClick={() => { onSubmit(type, notes); setNotes(''); }}
          className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-lg cursor-pointer"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}
