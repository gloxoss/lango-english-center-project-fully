'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, Check, DoorOpen, Loader2, Plus, X,
} from 'lucide-react';
import { api, errMessage } from './api';

type AllocationRow = {
  id: string;
  studentId: string;
  studentName: string | null;
  bedCode: string;
  roomCode: string;
  state: string;
};

type LeavePassRow = {
  id: string;
  allocationId: string;
  studentId: string;
  studentName: string | null;
  destination: string | null;
  reason: string | null;
  startDateTime: string;
  expectedReturnAt: string;
  actualReturnAt: string | null;
  guardianApprovalRequired: boolean;
  status: 'pending' | 'approved' | 'denied' | 'returned';
  createdById: string;
  createdAt: string;
  updatedAt: string;
  bedCode: string;
  roomCode: string;
};

type ApprovalRow = {
  id: string;
  approverRole: string;
  decision: string;
  reason: string | null;
  createdAt: string;
};

type LeavePassDetail = LeavePassRow & {
  approvals: ApprovalRow[];
  returned: { returnedAt: string; note: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  denied: 'Refusée',
  returned: 'Retourné',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-[#D1F5E8] text-[#0b5c3a]',
  denied: 'bg-red-100 text-red-700',
  returned: 'bg-slate-100 text-slate-500',
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeavePassesView() {
  const [rows, setRows] = useState<LeavePassRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeavePassDetail | null>(null);

  const [form, setForm] = useState({
    allocationId: '',
    destination: '',
    reason: '',
    startDateTime: toLocalInput(new Date().toISOString()),
    expectedReturnAt: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = filterStatus !== 'all' ? `?status=${encodeURIComponent(filterStatus)}` : '';
    const res = await api<LeavePassRow[]>(`/api/addons/hostel/leave-passes${qs}`);
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => {
    api<AllocationRow[]>('/api/addons/hostel/allocations?state=checked_in').then(res => {
      if (res.ok && Array.isArray(res.data)) setAllocations(res.data);
    }).catch(() => {});
    load().catch(() => {});
  }, [load]);

  const openCreate = () => {
    const first = allocations[0];
    setForm({
      allocationId: first?.id ?? '',
      destination: '',
      reason: '',
      startDateTime: toLocalInput(new Date().toISOString()),
      expectedReturnAt: '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.allocationId || !form.startDateTime || !form.expectedReturnAt) return;
    setSaving(true);
    setError(null);
    const body = {
      allocationId: form.allocationId,
      destination: form.destination.trim() || null,
      reason: form.reason.trim() || null,
      startDateTime: new Date(form.startDateTime).toISOString(),
      expectedReturnAt: new Date(form.expectedReturnAt).toISOString(),
    };
    const res = await api('/api/addons/hostel/leave-passes', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(errMessage(res));
    }
  };

  const loadDetail = async (id: string) => {
    const res = await api<LeavePassDetail>(`/api/addons/hostel/leave-passes/${id}`);
    if (res.ok && res.data) setDetail(res.data);
    else setError(errMessage(res));
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    setDetail(null);
    loadDetail(id).catch(() => {});
  };

  const decide = async (id: string, decision: 'approved' | 'denied') => {
    const res = await api(`/api/addons/hostel/leave-passes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, approverRole: 'warden' }),
    });
    if (res.ok) {
      await load();
      await loadDetail(id);
    } else {
      setError(errMessage(res));
    }
  };

  const recordReturn = async (id: string) => {
    const res = await api(`/api/addons/hostel/leave-passes/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ note: null }),
    });
    if (res.ok) {
      await load();
      await loadDetail(id);
    } else {
      setError(errMessage(res));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Permissions de sortie</h1>
          <p className="text-sm text-slate-500">Autorisations de sortie des résidents, approbations et retours.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvées</SelectItem>
              <SelectItem value="denied">Refusées</SelectItem>
              <SelectItem value="returned">Retournées</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} disabled={allocations.length === 0}><Plus className="mr-2 h-4 w-4" /> Nouvelle permission</Button>
        </div>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {allocations.length === 0 ? 'Aucun résident enregistré (affectations check-in requis).' : 'Aucune permission de sortie.'}
            </div>
          ) : (
            rows.map(row => (
              <div key={row.id}>
                <div className="flex items-center justify-between gap-4 p-4">
                  <button className="flex flex-1 items-center gap-3 text-left" onClick={() => toggleExpand(row.id)}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><DoorOpen className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold text-[#16212B]">{row.studentName ?? 'Élève inconnu'}</p>
                      <p className="text-xs text-slate-500">
                        {row.roomCode} · {row.bedCode}
                        {row.destination ? ` → ${row.destination}` : ''}
                        {' · '}Départ {new Date(row.startDateTime).toLocaleString('fr-MA')}
                        {' · '}Retour prévu {new Date(row.expectedReturnAt).toLocaleString('fr-MA')}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    {row.guardianApprovalRequired && <Badge className="bg-slate-100 text-slate-500">Tuteur requis</Badge>}
                    <Badge className={STATUS_BADGE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                    {row.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 px-2 text-green-700" onClick={() => decide(row.id, 'approved')}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" className="h-8 px-2 text-red-700" onClick={() => decide(row.id, 'denied')}><X className="h-4 w-4" /></Button>
                      </>
                    )}
                    {row.status === 'approved' && (
                      <Button size="sm" onClick={() => recordReturn(row.id)}>Enregistrer le retour</Button>
                    )}
                  </div>
                </div>

                {expandedId === row.id && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                    {!detail ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
                    ) : (
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold text-slate-500">Motif</p>
                          <p className="text-[#16212B]">{detail.reason ?? '—'}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-slate-500">Approbations</p>
                          {detail.approvals.length === 0 && <p className="text-slate-500">Aucune approbation enregistrée.</p>}
                          <ul className="space-y-1">
                            {detail.approvals.map(a => (
                              <li key={a.id} className="text-slate-600">
                                {a.approverRole === 'warden' ? 'Surveillant' : a.approverRole === 'guardian' ? 'Tuteur' : 'Admin'} — {a.decision}
                                {a.reason ? ` (${a.reason})` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-slate-500">Destination</p>
                          <p className="text-[#16212B]">{detail.destination ?? '—'}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-slate-500">Retour enregistré</p>
                          <p className="text-[#16212B]">
                            {detail.returned ? `${new Date(detail.returned.returnedAt).toLocaleString('fr-MA')}${detail.returned.note ? ` — ${detail.returned.note}` : ''}` : '—'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle permission de sortie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Résident *</label>
              <Select value={form.allocationId} onValueChange={v => setForm({ ...form, allocationId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allocations.map(a =>
                    <SelectItem key={a.id} value={a.id}>{a.studentName ?? a.studentId} — {a.roomCode} {a.bedCode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Destination</label>
              <Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="Ex : Maison, Casablanca" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Départ *</label>
                <Input type="datetime-local" value={form.startDateTime} onChange={e => setForm({ ...form, startDateTime: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Retour prévu *</label>
                <Input type="datetime-local" value={form.expectedReturnAt} onChange={e => setForm({ ...form, expectedReturnAt: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Motif</label>
              <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.allocationId || !form.startDateTime || !form.expectedReturnAt}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
