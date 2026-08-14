'use client';

import { useCallback, useEffect, useState } from 'react';
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
  AlertCircle, CheckCircle2, DoorOpen, Loader2, LogIn, LogOut, Plus, QrCode, Search, UserPlus,
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

type Visit = {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorPhone: string | null;
  visitorEmail: string | null;
  purpose: string;
  hostName: string | null;
  passNumber: string | null;
  hasPass: boolean;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  createdAt: string;
};

type Invitation = {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorPhone: string | null;
  purpose: string;
  hostId: string;
  hostName: string | null;
  expectedDate: string;
  expectedStart: string;
  expectedEnd: string;
  status: string;
  approvedAt: string | null;
  createdAt: string;
};

function statusBadge(status: string) {
  switch (status) {
    case 'approved': return <Badge className="bg-[#D1F5E8] text-[#0b5c3a]">Approuvé</Badge>;
    case 'checked_in': return <Badge className="bg-[#DCEBF4] text-[#1B6C93]">Pointé entrée</Badge>;
    case 'checked_out': return <Badge className="bg-slate-100 text-slate-600">Sorti</Badge>;
    case 'pending': return <Badge className="bg-amber-50 text-amber-700">En attente</Badge>;
    case 'invited': return <Badge className="bg-amber-50 text-amber-700">Invité</Badge>;
    case 'rejected': return <Badge className="bg-rose-50 text-rose-700">Refusé</Badge>;
    case 'cancelled': return <Badge className="bg-slate-100 text-slate-500">Annulé</Badge>;
    default: return <Badge className="bg-slate-100 text-slate-600">{status}</Badge>;
  }
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function GuardVisitorsView() {
  const [tab, setTab] = useState<'visits' | 'invitations'>('visits');
  const [error, setError] = useState<string | null>(null);

  const [gate, setGate] = useState<{ id: string; gateName: string } | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ visitorFirstName: '', visitorLastName: '', visitorPhone: '', purpose: '', approved: true });

  const [passDialog, setPassDialog] = useState<{ visitId: string; rawToken: string } | null>(null);

  const loadGate = useCallback(async () => {
    const res = await api<{ gate: { id: string; gateName: string } }>('/api/guard/me/gate');
    if (res.ok && res.data?.gate) {
      setGate({ id: res.data.gate.id, gateName: res.data.gate.gateName });
      setGateError(null);
    } else {
      setGate(null);
      setGateError(res.error?.message ?? 'Aucun portail actif.');
    }
  }, []);

  const loadVisits = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    const res = await api<Visit[]>(`/api/guard/visits?${params.toString()}`);
    if (res.ok && Array.isArray(res.data)) setVisits(res.data);
  }, [q, statusFilter]);

  const loadInvitations = useCallback(async () => {
    const res = await api<Invitation[]>('/api/guard/visitor-invitations');
    if (res.ok && Array.isArray(res.data)) setInvitations(res.data);
  }, []);

  useEffect(() => {
    loadGate();
  }, [loadGate]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const createVisit = async () => {
    if (!createForm.visitorFirstName.trim() || !createForm.purpose.trim()) return;
    setCreating(true);
    setError(null);
    const res = await api('/api/guard/visits', {
      method: 'POST',
      body: JSON.stringify({
        visitorFirstName: createForm.visitorFirstName.trim(),
        visitorLastName: createForm.visitorLastName.trim(),
        visitorPhone: createForm.visitorPhone.trim() || null,
        purpose: createForm.purpose.trim(),
        approved: createForm.approved,
      }),
    });
    setCreating(false);
    if (res.ok) {
      setCreateForm({ visitorFirstName: '', visitorLastName: '', visitorPhone: '', purpose: '', approved: true });
      await loadVisits();
    } else {
      setError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const checkIn = async (v: Visit) => {
    setError(null);
    if (!gate) return;
    const res = await api(`/api/guard/visits/${v.id}/check-in`, {
      method: 'POST',
      body: JSON.stringify({ gateId: gate.id, idempotencyKey: crypto.randomUUID() }),
    });
    if (res.ok) await loadVisits();
    else setError(res.error?.message ?? 'Pointage d\'entrée impossible.');
  };

  const checkOut = async (v: Visit) => {
    setError(null);
    if (!gate) return;
    const res = await api(`/api/guard/visits/${v.id}/check-out`, {
      method: 'POST',
      body: JSON.stringify({ gateId: gate.id, idempotencyKey: crypto.randomUUID() }),
    });
    if (res.ok) await loadVisits();
    else setError(res.error?.message ?? 'Pointage de sortie impossible.');
  };

  const issuePass = async (v: Visit) => {
    setError(null);
    const res = await api<{ rawToken: string }>(`/api/guard/visits/${v.id}/pass`, { method: 'POST' });
    if (res.ok && res.data?.rawToken) {
      setPassDialog({ visitId: v.id, rawToken: res.data.rawToken });
      await loadVisits();
    } else {
      setError(res.error?.message ?? 'Émission du pass impossible.');
    }
  };

  const decideInvitation = async (inv: Invitation, decision: 'approve' | 'reject') => {
    setError(null);
    const res = await api(`/api/guard/visitor-invitations/${inv.id}/${decision}`, { method: 'POST' });
    if (res.ok) await loadInvitations();
    else setError(res.error?.message ?? 'Décision impossible.');
  };

  const gateAware = gate || gateError;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Visiteurs</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Pointage entrée/sortie, émission des pass et invitations.
            {gate ? ` · Portail : ${gate.gateName}` : gateError ? ` · ${gateError}` : ' · Chargement du portail…'}
          </p>
        </div>
        <Badge className="bg-[#DCEBF4] text-[#1B6C93]"><DoorOpen className="mr-1 h-3.5 w-3.5" /> Visiteurs &amp; pass</Badge>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      {!gate && !gateError && <p className="text-xs text-slate-500">Chargement du portail…</p>}

      <div className="flex gap-2">
        <button
          onClick={() => setTab('visits')}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === 'visits' ? 'bg-[#16212B] text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >Visites</button>
        <button
          onClick={() => setTab('invitations')}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === 'invitations' ? 'bg-[#16212B] text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >Invitations ({invitations.length})</button>
      </div>

      {tab === 'visits' && (
        <>
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Rechercher (nom, pass, téléphone — 3 caractères min)"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter || undefined} onValueChange={v => setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approuvé</SelectItem>
                  <SelectItem value="checked_in">Pointé entrée</SelectItem>
                  <SelectItem value="checked_out">Sorti</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => { setCreateForm({ visitorFirstName: '', visitorLastName: '', visitorPhone: '', purpose: '', approved: true }); }}>
                <UserPlus className="mr-2 h-4 w-4" /> Visiteur sans rendez-vous
              </Button>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            {visits.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">Aucune visite.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visits.map(v => (
                  <div key={v.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#16212B]">
                        {v.visitorFirstName} {v.visitorLastName}
                        {v.passNumber && <span className="ml-2 font-mono text-xs text-slate-400">Pass {v.passNumber}</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {v.purpose}{v.hostName ? ` · reçu par ${v.hostName}` : ''}{v.visitorPhone ? ` · ${v.visitorPhone}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {statusBadge(v.status)}
                      {v.status === 'approved' && !v.hasPass && (
                        <Button size="sm" onClick={() => void issuePass(v)}><QrCode className="mr-1.5 h-3.5 w-3.5" /> Émettre le pass</Button>
                      )}
                      {(v.status === 'approved') && (
                        <Button size="sm" variant="outline" disabled={!gate} onClick={() => void checkIn(v)}>
                          <LogIn className="mr-1.5 h-3.5 w-3.5" /> Entrée
                        </Button>
                      )}
                      {v.status === 'checked_in' && (
                        <Button size="sm" variant="outline" disabled={!gate} onClick={() => void checkOut(v)}>
                          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sortie
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'invitations' && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          {invitations.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucune invitation.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {invitations.map(inv => (
                <div key={inv.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#16212B]">
                      {inv.visitorFirstName} {inv.visitorLastName}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {toDateInput(inv.expectedDate)} · {inv.expectedStart}–{inv.expectedEnd}
                      </span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {inv.purpose}{inv.hostName ? ` · hôte : ${inv.hostName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {statusBadge(inv.status)}
                    {inv.status === 'invited' && (
                      <>
                        <Button size="sm" onClick={() => void decideInvitation(inv, 'approve')}>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approuver
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void decideInvitation(inv, 'reject')}>Refuser</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Visiteur sans rendez-vous</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Prénom *</Label>
                <Input value={createForm.visitorFirstName} onChange={e => setCreateForm({ ...createForm, visitorFirstName: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Nom *</Label>
                <Input value={createForm.visitorLastName} onChange={e => setCreateForm({ ...createForm, visitorLastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Téléphone</Label>
              <Input value={createForm.visitorPhone} onChange={e => setCreateForm({ ...createForm, visitorPhone: e.target.value })} placeholder="Optionnel" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Motif *</Label>
              <Input value={createForm.purpose} onChange={e => setCreateForm({ ...createForm, purpose: e.target.value })} placeholder="Ex : entretien, livraison…" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createForm.approved}
                onChange={e => setCreateForm({ ...createForm, approved: e.target.checked })}
                className="h-4 w-4 accent-[#1B6C93]"
              />
              Approuver immédiatement (permet d&apos;émettre un pass)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Annuler</Button>
            <Button
              onClick={() => void createVisit()}
              disabled={!createForm.visitorFirstName.trim() || !createForm.purpose.trim()}
            >
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passDialog !== null} onOpenChange={o => { if (!o) setPassDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pass visiteur émis</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Scannez ou saisissez ce jeton pour la carte du visiteur. Il n&apos;est affiché qu&apos;une seule fois — copiez-le pour générer le QR.
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="break-all select-all font-mono text-xs text-[#16212B]">{passDialog?.rawToken}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPassDialog(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
