'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle, BadgeCheck, IdCard, Loader2, LogIn, LogOut, Plus, Search, UserPlus,
} from 'lucide-react';
import { PortalStateView } from '@/components/shared/portal-state';
import { api, fmtDateTime, type Visitor } from './reception-api';

type Staff = { id: string; name: string; role: string };
type Gate = { id: string; gateCode: string; gateName: string; direction: string; branchId: string | null };
type GateAction = { replayed: boolean; checkInAt?: string; checkOutAt?: string };

const VISITOR_STATUS_LABELS: Record<string, string> = {
  invited: 'Invité',
  pending: 'En attente',
  approved: 'Approuvé',
  checked_in: 'Présent',
  checked_out: 'Sorti',
};

export function ReceptionVisitorsView() {
  const [data, setData] = useState<Visitor[]>([]);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [gateTarget, setGateTarget] = useState<{ visit: Visitor; action: 'check-in' | 'check-out' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (status !== 'all') qs.set('status', status);
    if (q.trim().length >= 3) qs.set('q', q.trim());
    const res = await api<Visitor[]>(`/api/reception/visitors?${qs}`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setData(res.data);
    } else {
      setError(res.error?.message ?? 'Chargement impossible.');
    }
  }, [status, q]);

  useEffect(() => { load(); }, [load]);

  const openGatePicker = async (visit: Visitor, action: 'check-in' | 'check-out') => {
    setActionMsg(null);
    const g = await api<Gate[]>('/api/reception/gates');
    if (g.ok && Array.isArray(g.data)) setGates(g.data);
    else setGates([]);
    setGateTarget({ visit, action });
  };

  const gateAction = async (gateId: string) => {
    if (!gateTarget) return;
    setActionMsg(null);
    const action = gateTarget.action;
    const res = await api<{ data: GateAction }>(`/api/reception/visitors/${gateTarget.visit.id}/${action}`, {
      method: 'POST',
      body: { gateId, idempotencyKey: crypto.randomUUID() },
    });
    setGateTarget(null);
    if (!res.ok) {
      setActionMsg(res.error?.message ?? 'Action impossible.');
      return;
    }
    setActionMsg(action === 'check-in' ? 'Entrée pointée.' : 'Sortie pointée.');
    load();
  };

  const issuePass = async (visit: Visitor) => {
    setActionMsg(null);
    const res = await api(`/api/reception/visitors/${visit.id}/pass`, { method: 'POST', body: {} });
    if (!res.ok) {
      setActionMsg(res.error?.message ?? 'Émission impossible.');
      return;
    }
    setActionMsg('Pass émis.');
    load();
  };

  const openCreate = () => {
    loadStaff(setStaff);
    setCreateOpen(true);
  };

  if (loading && data.length === 0) return <PortalStateView state="loading" />;
  if (error && data.length === 0) {
    return <PortalStateView state="error" action={<Button size="sm" variant="outline" onClick={load}>Réessayer</Button>} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Visiteurs</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Accueil des visites, émission des passes, pointage d&apos;entrée et de sortie.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white">
          <UserPlus className="h-4 w-4" /> Nouveau visiteur
        </Button>
      </div>

      {actionMsg && <p className="text-sm text-emerald-600">{actionMsg}</p>}

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vs-q">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="vs-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, pass, téléphone…"
                className="w-56 pl-8"
                aria-label="Rechercher un visiteur"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vs-status">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="vs-status" className="w-44" aria-label="Filtrer par statut"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="approved">Approuvés</SelectItem>
                <SelectItem value="checked_in">Présents</SelectItem>
                <SelectItem value="checked_out">Sortis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Actualiser'}
          </Button>
        </div>

        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucun visiteur pour cette sélection.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-bold">Visiteur</th>
                  <th className="py-2 pr-3 font-bold">Motif</th>
                  <th className="py-2 pr-3 font-bold">Hôte</th>
                  <th className="py-2 pr-3 font-bold">Pass</th>
                  <th className="py-2 pr-3 font-bold">Statut</th>
                  <th className="py-2 pr-3 font-bold">Entrée</th>
                  <th className="py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((v) => (
                  <tr key={v.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-[#16212B]">{v.visitorFirstName} {v.visitorLastName}</p>
                      {v.visitorPhone ? <p className="font-mono text-xs text-slate-400">{v.visitorPhone}</p> : null}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{v.purpose}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{v.hostName ?? '—'}</td>
                    <td className="py-2.5 pr-3">
                      {v.hasPass
                        ? <Badge className="gap-1 bg-emerald-50 text-emerald-700"><IdCard className="h-3 w-3" />{v.passNumber ?? 'émission en cours'}</Badge>
                        : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge className="bg-[#DCEBF4] text-[#1B6C93]">{VISITOR_STATUS_LABELS[v.status] ?? v.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{fmtDateTime(v.checkInAt)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {v.status === 'approved' && !v.hasPass && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => issuePass(v)}>
                            <BadgeCheck className="h-3 w-3" /> Émettre le pass
                          </Button>
                        )}
                        {v.status === 'approved' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => openGatePicker(v, 'check-in')}>
                            <LogIn className="h-3 w-3" /> Pointer l&apos;entrée
                          </Button>
                        )}
                        {v.status === 'checked_in' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] text-slate-600" onClick={() => openGatePicker(v, 'check-out')}>
                            <LogOut className="h-3 w-3" /> Pointer la sortie
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateVisitDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        staff={staff}
        onCreated={() => { setCreateOpen(false); load(); }}
      />

      <GatePickerDialog
        target={gateTarget}
        gates={gates}
        onClose={() => setGateTarget(null)}
        onConfirm={gateAction}
      />
    </div>
  );
}

async function loadStaff(setter: (s: Staff[]) => void) {
  const res = await api<Staff[]>('/api/reception/staff');
  if (res.ok && Array.isArray(res.data)) setter(res.data);
}

function CreateVisitDialog({ open, onOpenChange, staff, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: Staff[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    visitorFirstName: '', visitorLastName: '', visitorPhone: '', visitorEmail: '', purpose: '', hostId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ visitorFirstName: '', visitorLastName: '', visitorPhone: '', visitorEmail: '', purpose: '', hostId: '' });
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!form.visitorFirstName.trim() || !form.purpose.trim()) {
      setError('Le nom et le motif sont obligatoires.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api<{ data: Visitor }>('/api/reception/visitors', {
      method: 'POST',
      body: {
        visitorFirstName: form.visitorFirstName.trim(),
        visitorLastName: form.visitorLastName.trim(),
        visitorPhone: form.visitorPhone.trim() || null,
        visitorEmail: form.visitorEmail.trim() || null,
        purpose: form.purpose.trim(),
        hostId: form.hostId || null,
      },
    });
    setSubmitting(false);
    if (res.ok) onCreated();
    else setError(res.error?.message ?? 'Création impossible.');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="visit-dialog-desc">
        <DialogHeader>
          <DialogTitle>Nouveau visiteur</DialogTitle>
          <DialogDescription id="visit-dialog-desc">
            Enregistrer une visite sur site. L&apos;inscription vaut approbation ; le pass peut ensuite être émis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vs-first">Prénom *</Label>
              <Input id="vs-first" value={form.visitorFirstName} onChange={(e) => setForm({ ...form, visitorFirstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vs-last">Nom</Label>
              <Input id="vs-last" value={form.visitorLastName} onChange={(e) => setForm({ ...form, visitorLastName: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vs-phone">Téléphone</Label>
              <Input id="vs-phone" value={form.visitorPhone} onChange={(e) => setForm({ ...form, visitorPhone: e.target.value })} placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vs-email">Email</Label>
              <Input id="vs-email" type="email" value={form.visitorEmail} onChange={(e) => setForm({ ...form, visitorEmail: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vs-purpose">Motif *</Label>
              <Input id="vs-purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Ex. Rendez-vous, livraison…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vs-host">Hôte</Label>
              <Select value={form.hostId} onValueChange={(v) => setForm({ ...form, hostId: v })}>
                <SelectTrigger id="vs-host" aria-label="Hôte du visiteur"><SelectValue placeholder="Membre du personnel" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GatePickerDialog({ target, gates, onClose, onConfirm }: {
  target: { visit: Visitor; action: 'check-in' | 'check-out' } | null;
  gates: Gate[];
  onClose: () => void;
  onConfirm: (gateId: string) => void;
}) {
  const [gateId, setGateId] = useState('');

  useEffect(() => {
    if (target) {
      setGateId('');
      if (gates.length > 0) setGateId(gates[0]!.id);
    }
  }, [target, gates]);

  if (!target) return null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby="gate-desc">
        <DialogHeader>
          <DialogTitle>{target.action === 'check-in' ? 'Pointer l\'entrée' : 'Pointer la sortie'} · {target.visit.visitorFirstName} {target.visit.visitorLastName}</DialogTitle>
          <DialogDescription id="gate-desc">Choisir le portail de pointage. L&apos;opération est protégée contre les doubles traitements.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {gates.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-amber-700"><AlertCircle className="h-4 w-4" /> Aucun portail actif disponible.</p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="gate-pick">Portail</Label>
              <Select value={gateId} onValueChange={setGateId}>
                <SelectTrigger id="gate-pick" aria-label="Portail de pointage"><SelectValue placeholder="Choisir un portail" /></SelectTrigger>
                <SelectContent>
                  {gates.map((g) => <SelectItem key={g.id} value={g.id}>{g.gateName} ({g.gateCode})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => gateId && onConfirm(gateId)} disabled={!gateId}>
              {target.action === 'check-in' ? <LogIn className="mr-1 h-4 w-4" /> : <LogOut className="mr-1 h-4 w-4" />}
              Confirmer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
