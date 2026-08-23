'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle, AlertTriangle, ChevronDown, FileUp, Loader2, Plus, ShieldAlert, Trash2,
} from 'lucide-react';

type ApiErrorShape = { code?: string; message?: string };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

type Incident = {
  id: string;
  category: string;
  severity: string;
  location: string | null;
  description: string;
  status: string;
  occurredAt: string;
  resolutionNotes: string | null;
  createdAt: string;
  reporterName: string | null;
  gateName: string | null;
};

type Action = { id: string; actionType: string; notes: string | null; createdAt: string; actorName: string | null };
type Attachment = { id: string; originalName: string; mimeType: string; fileSize: number; createdAt: string };

const CATEGORY_LABELS: Record<string, string> = {
  comportement: 'Comportement', objet_perdu: 'Objet perdu', acces: 'Accès', securite: 'Sécurité', medical: 'Médical', autre: 'Autre',
};
const SEVERITY_LABELS: Record<string, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé', critical: 'Critique' };
const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert', in_progress: 'En cours', escalated: 'Escaladé', resolved: 'Résolu', closed: 'Clos',
};

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-amber-50 text-amber-700',
    high: 'bg-orange-50 text-orange-700',
    critical: 'bg-rose-50 text-rose-700',
  };
  return <Badge className={map[severity] ?? 'bg-slate-100 text-slate-600'}>{SEVERITY_LABELS[severity] ?? severity}</Badge>;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    open: 'bg-[#DCEBF4] text-[#1B6C93]',
    in_progress: 'bg-amber-50 text-amber-700',
    escalated: 'bg-orange-50 text-orange-700',
    resolved: 'bg-[#D1F5E8] text-[#0b5c3a]',
    closed: 'bg-slate-100 text-slate-500',
  };
  return <Badge className={map[status] ?? 'bg-slate-100 text-slate-600'}>{STATUS_LABELS[status] ?? status}</Badge>;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function GuardIncidentsView() {
  const [statusFilter, setStatusFilter] = useState('');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    category: 'acces', severity: 'medium', location: '', description: '',
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [actionNotes, setActionNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await api<Incident[]>(`/api/guard/me/incidents?${params.toString()}`);
    if (res.ok && Array.isArray(res.data)) setIncidents(res.data);
    else if (res.error) setError(res.error.message ?? 'Chargement impossible.');
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    const [a, at] = await Promise.all([
      api<Action[]>(`/api/guard/incidents/${id}/actions`),
      api<Attachment[]>(`/api/guard/incidents/${id}/attachments`),
    ]);
    setActions(a.ok && Array.isArray(a.data) ? a.data : []);
    setAttachments(at.ok && Array.isArray(at.data) ? at.data : []);
    setActionNotes('');
    setDetailError(null);
    setOpenId(id);
  };

  const create = async () => {
    if (!createForm.description.trim()) return;
    setSaving(true);
    setError(null);
    const res = await api('/api/guard/incidents', {
      method: 'POST',
      body: JSON.stringify({
        ...createForm,
        location: createForm.location.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setCreateForm({ category: 'acces', severity: 'medium', location: '', description: '' });
      setCreating(false);
      setStatusFilter('');
      await load();
    } else {
      setError(res.error?.message ?? 'Signalement impossible.');
    }
  };

  const addAction = async (actionType: string) => {
    if (!openId) return;
    setDetailError(null);
    const res = await api(`/api/guard/incidents/${openId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ actionType, notes: actionNotes.trim() || null }),
    });
    if (res.ok) {
      setActionNotes('');
      await openDetail(openId);
      await load();
    } else {
      setDetailError(res.error?.message ?? 'Action impossible.');
    }
  };

  const uploadAttachment = async (file: File) => {
    if (!openId) return;
    setUploading(true);
    setDetailError(null);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/guard/incidents/${openId}/attachments`, {
      method: 'POST', credentials: 'include', body: form,
    });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok) {
      await openDetail(openId);
    } else {
      setDetailError(json?.error?.message ?? 'Envoi impossible.');
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!openId) return;
    setDetailError(null);
    const res = await fetch(`/api/guard/incidents/${openId}/attachments/${attachmentId}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (res.ok) await openDetail(openId);
    else setDetailError('Suppression impossible.');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Incidents</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Signaler, suivre et escalader les incidents de sécurité.
          </p>
        </div>
        <Badge className="bg-[#DCEBF4] text-[#1B6C93]"><ShieldAlert className="mr-1 h-3.5 w-3.5" /> Journal</Badge>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={statusFilter || undefined} onValueChange={v => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Ouvert</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="escalated">Escaladé</SelectItem>
            <SelectItem value="resolved">Résolu</SelectItem>
            <SelectItem value="closed">Clos</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { setCreateForm({ category: 'acces', severity: 'medium', location: '', description: '' }); setCreating(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Signaler un incident
        </Button>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        {incidents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Aucun incident.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {incidents.map(i => (
              <div key={i.id} className="flex flex-col gap-3 p-4">
                <button onClick={() => void openDetail(i.id)} className="flex w-full items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-[#16212B]">
                      {CATEGORY_LABELS[i.category] ?? i.category}
                      {severityBadge(i.severity)}
                      {statusBadge(i.status)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {fmtDateTime(i.occurredAt)}{i.gateName ? ` · ${i.gateName}` : ''}{i.location ? ` · ${i.location}` : ''}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                </button>

                {openId === i.id && (
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{i.description}</p>
                    <p className="mt-2 text-xs text-slate-400">Signalé par {i.reporterName ?? '—'}</p>
                    {i.resolutionNotes && (
                      <p className="mt-3 rounded-lg border border-emerald-200 bg-[#D1F5E8]/40 p-3 text-xs text-[#0b5c3a]">
                        <strong>Notes de résolution :</strong> {i.resolutionNotes}
                      </p>
                    )}

                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Suivi</p>
                      {actions.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-400">Aucune action.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {actions.map(a => (
                            <li key={a.id} className="flex items-start gap-2 text-xs">
                              <span className="shrink-0 rounded bg-white px-1.5 py-0.5 font-bold text-[#1B6C93] ring-1 ring-slate-200">
                                {a.actionType}
                              </span>
                              <span className="text-slate-600">
                                {a.notes ?? ''}
                                <span className="text-slate-400"> — {a.actorName ?? ''} · {fmtDateTime(a.createdAt)}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pièces jointes</p>
                      {attachments.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-400">Aucune pièce jointe.</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {attachments.map(at => (
                            <li key={at.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-slate-200">
                              <span className="truncate text-slate-600">{at.originalName} <span className="text-slate-400">({fmtBytes(at.fileSize)})</span></span>
                              <button onClick={() => void removeAttachment(at.id)} className="text-slate-400 transition hover:text-rose-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) void uploadAttachment(f); e.target.value = ''; }}
                        />
                        <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                          {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />} Joindre un fichier
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <Label className="mb-1 block text-xs font-medium text-slate-600">Note / résolution</Label>
                        <Input value={actionNotes} onChange={e => setActionNotes(e.target.value)} placeholder="Note interne…" />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void addAction('note')}>Ajouter une note</Button>
                      {i.status !== 'escalated' && <Button size="sm" variant="outline" onClick={() => void addAction('escalate')}>Escalader</Button>}
                      {i.status !== 'resolved' && <Button size="sm" variant="outline" onClick={() => void addAction('resolve')}>Résoudre</Button>}
                      {i.status !== 'closed' && <Button size="sm" variant="outline" onClick={() => void addAction('close')}>Clore</Button>}
                      {i.status === 'closed' && <Button size="sm" variant="outline" onClick={() => void addAction('reopen')}>Réouvrir</Button>}
                    </div>
                    {detailError && <p className="mt-2 flex items-center gap-1 text-xs text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{detailError}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Signaler un incident</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Catégorie</Label>
                <Select value={createForm.category} onValueChange={v => setCreateForm({ ...createForm, category: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Sévérité</Label>
                <Select value={createForm.severity} onValueChange={v => setCreateForm({ ...createForm, severity: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Lieu</Label>
              <Input value={createForm.location} onChange={e => setCreateForm({ ...createForm, location: e.target.value })} placeholder="Optionnel" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Description *</Label>
              <textarea
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                rows={4}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2487B8]/40"
                placeholder="Décrivez l'incident…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Annuler</Button>
            <Button onClick={() => void create()} disabled={saving || !createForm.description.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />} Signaler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
