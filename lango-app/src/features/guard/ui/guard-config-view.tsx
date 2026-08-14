'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle, Archive, Clock, DoorOpen, Loader2, Pencil, Plus, ShieldCheck, Trash2,
} from 'lucide-react';

type ApiErrorShape = { code?: string; message?: string };

type Branch = { id: string; name: string; code: string; isActive: boolean };
type GuardUser = { id: string; fullName: string; role: string };
type Device = { id: string; deviceLabel: string; isDisabled: boolean };

type Gate = {
  id: string; branchId: string | null; gateCode: string; gateName: string;
  direction: 'entry' | 'exit' | 'both'; isActive: boolean;
};
type Shift = {
  id: string; branchId: string | null; name: string; startTime: string;
  endTime: string; isActive: boolean;
};
type Assignment = {
  id: string; branchId: string; guardUserId: string; guardName: string | null;
  gateId: string; gateCode: string | null; gateName: string | null;
  shiftId: string; shiftName: string | null; startTime: string | null; endTime: string | null;
  deviceId: string | null; deviceLabel: string | null;
  effectiveFrom: string; effectiveUntil: string | null; status: string;
};

type Tab = 'gates' | 'shifts' | 'assignments';

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'active': return <Badge className="bg-[#D1F5E8] text-[#0b5c3a]">Actif</Badge>;
    case 'scheduled': return <Badge className="bg-[#DCEBF4] text-[#1B6C93]">Planifié</Badge>;
    case 'expired': return <Badge className="bg-slate-100 text-slate-500">Expiré</Badge>;
    case 'cancelled': return <Badge className="bg-slate-100 text-slate-500">Annulé</Badge>;
    default: return <Badge className="bg-slate-100 text-slate-600">{status}</Badge>;
  }
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDisplay(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export function GuardConfigView() {
  const [tab, setTab] = useState<Tab>('gates');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gates, setGates] = useState<Gate[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [guards, setGuards] = useState<GuardUser[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const loadGates = useCallback(async () => {
    const res = await api<Gate[]>('/api/guard/gates');
    if (res.ok && Array.isArray(res.data)) setGates(res.data);
  }, []);

  const loadShifts = useCallback(async () => {
    const res = await api<Shift[]>('/api/guard/shifts');
    if (res.ok && Array.isArray(res.data)) setShifts(res.data);
  }, []);

  const loadAssignments = useCallback(async () => {
    const res = await api<Assignment[]>('/api/guard/assignments');
    if (res.ok && Array.isArray(res.data)) setAssignments(res.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const [g, s, b, u, d] = await Promise.all([
        api<Gate[]>('/api/guard/gates'),
        api<Shift[]>('/api/guard/shifts'),
        api<Branch[]>('/api/settings/branches'),
        api<GuardUser[]>('/api/users?role=guard&status=active'),
        api<Device[]>('/api/scanner-devices'),
      ]);
      if (g.ok && Array.isArray(g.data)) setGates(g.data);
      if (s.ok && Array.isArray(s.data)) setShifts(s.data);
      if (b.ok && Array.isArray(b.data)) setBranches(b.data);
      if (u.ok && Array.isArray(u.data)) setGuards(u.data);
      if (d.ok && Array.isArray(d.data)) setDevices(d.data);
      await loadAssignments();
      setLoading(false);
    })().catch(() => { setLoading(false); setError('Chargement impossible.'); });
  }, [loadAssignments]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Sécurité &amp; Gardiens</h1>
          <p className="text-sm text-slate-500">Configuration des portails, quarts et affectations.</p>
        </div>
        <Badge className="bg-[#DCEBF4] text-[#1B6C93]"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Accès réservé aux administrateurs</Badge>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="gates">Portails</TabsTrigger>
          <TabsTrigger value="shifts">Quarts</TabsTrigger>
          <TabsTrigger value="assignments">Affectations</TabsTrigger>
        </TabsList>

        <TabsContent value="gates">
          <GatesTab
            gates={gates}
            branches={branches}
            onChanged={loadGates}
            onError={setError}
          />
        </TabsContent>

        <TabsContent value="shifts">
          <ShiftsTab
            shifts={shifts}
            branches={branches}
            onChanged={loadShifts}
            onError={setError}
          />
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentsTab
            assignments={assignments}
            gates={gates}
            shifts={shifts}
            guards={guards}
            devices={devices}
            loading={loading}
            onChanged={loadAssignments}
            onError={setError}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portails
// ---------------------------------------------------------------------------

function GatesTab({ gates, branches, onChanged, onError }: {
  gates: Gate[];
  branches: Branch[];
  onChanged: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Gate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ gateCode: '', gateName: '', branchId: '', direction: 'both' });

  const openCreate = () => {
    setEditing(null);
    setForm({ gateCode: '', gateName: '', branchId: '', direction: 'both' });
    setOpen(true);
  };

  const openEdit = (g: Gate) => {
    setEditing(g);
    setForm({ gateCode: g.gateCode, gateName: g.gateName, branchId: g.branchId ?? '', direction: g.direction });
    setOpen(true);
  };

  const save = async () => {
    if (!form.gateCode.trim() || !form.gateName.trim()) return;
    setSaving(true);
    onError(null);
    const body = {
      gateCode: form.gateCode.trim(),
      gateName: form.gateName.trim(),
      branchId: form.branchId || null,
      direction: form.direction as 'entry' | 'exit' | 'both',
    };
    const res = editing
      ? await api(`/api/guard/gates/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/guard/gates', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      await onChanged();
    } else {
      onError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const archive = async (g: Gate) => {
    onError(null);
    const res = await api(`/api/guard/gates/${g.id}`, { method: 'DELETE' });
    if (res.ok) await onChanged();
    else onError(res.error?.message ?? 'Archivage impossible.');
  };

  const branchName = (id: string | null) => branches.find(b => b.id === id)?.name ?? '—';

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{gates.filter(g => g.isActive).length} portail(s) actif(s)</p>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouveau portail</Button>
      </div>
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="divide-y divide-slate-100">
          {gates.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun portail configuré.</div>
          ) : (
            gates.map(g => (
              <div key={g.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${g.isActive ? 'bg-[#DCEBF4] text-[#1B6C93]' : 'bg-slate-100 text-slate-500'}`}>
                    <DoorOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{g.gateName} <span className="font-mono text-xs text-slate-400">{g.gateCode}</span></p>
                    <p className="text-xs text-slate-500">
                      {branchName(g.branchId)} · {g.direction === 'both' ? 'Entrée & sortie' : g.direction === 'entry' ? 'Entrée' : 'Sortie'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={g.isActive ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {g.isActive ? 'Actif' : 'Archivé'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                  {g.isActive && (
                    <Button variant="ghost" size="icon" onClick={() => archive(g)}><Archive className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le portail' : 'Nouveau portail'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Code *</Label>
                <Input value={form.gateCode} onChange={e => setForm({ ...form, gateCode: e.target.value })} placeholder="Ex : ENTREE-A" />
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Nom *</Label>
                <Input value={form.gateName} onChange={e => setForm({ ...form, gateName: e.target.value })} placeholder="Ex : Portail principal" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Branche</Label>
              <Select value={form.branchId || undefined} onValueChange={v => setForm({ ...form, branchId: v })}>
                <SelectTrigger><SelectValue placeholder="Toutes branches" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Direction</Label>
              <Select value={form.direction} onValueChange={v => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Entrée &amp; sortie</SelectItem>
                  <SelectItem value="entry">Entrée</SelectItem>
                  <SelectItem value="exit">Sortie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.gateCode.trim() || !form.gateName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Quarts
// ---------------------------------------------------------------------------

function ShiftsTab({ shifts, branches, onChanged, onError }: {
  shifts: Shift[];
  branches: Branch[];
  onChanged: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', branchId: '', startTime: '07:00', endTime: '15:00' });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', branchId: '', startTime: '07:00', endTime: '15:00' });
    setOpen(true);
  };

  const openEdit = (s: Shift) => {
    setEditing(s);
    setForm({ name: s.name, branchId: s.branchId ?? '', startTime: s.startTime, endTime: s.endTime });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    onError(null);
    const body = { name: form.name.trim(), branchId: form.branchId || null, startTime: form.startTime, endTime: form.endTime };
    const res = editing
      ? await api(`/api/guard/shifts/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/guard/shifts', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      await onChanged();
    } else {
      onError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const archive = async (s: Shift) => {
    onError(null);
    const res = await api(`/api/guard/shifts/${s.id}`, { method: 'DELETE' });
    if (res.ok) await onChanged();
    else onError(res.error?.message ?? 'Archivage impossible.');
  };

  const branchName = (id: string | null) => branches.find(b => b.id === id)?.name ?? '—';

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{shifts.filter(s => s.isActive).length} quart(s) actif(s)</p>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouveau quart</Button>
      </div>
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="divide-y divide-slate-100">
          {shifts.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun quart configuré.</div>
          ) : (
            shifts.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.isActive ? 'bg-[#DCEBF4] text-[#1B6C93]' : 'bg-slate-100 text-slate-500'}`}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.startTime} → {s.endTime} · {branchName(s.branchId)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={s.isActive ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {s.isActive ? 'Actif' : 'Archivé'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  {s.isActive && (
                    <Button variant="ghost" size="icon" onClick={() => archive(s)}><Archive className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le quart' : 'Nouveau quart'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Nom *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : Matin" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Début (HH:MM) *</Label>
                <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Fin (HH:MM) *</Label>
                <Input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Branche</Label>
              <Select value={form.branchId || undefined} onValueChange={v => setForm({ ...form, branchId: v })}>
                <SelectTrigger><SelectValue placeholder="Toutes branches" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Affectations
// ---------------------------------------------------------------------------

function AssignmentsTab({ assignments, gates, shifts, guards, devices, loading, onChanged, onError }: {
  assignments: Assignment[];
  gates: Gate[];
  shifts: Shift[];
  guards: GuardUser[];
  devices: Device[];
  loading: boolean;
  onChanged: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    guardUserId: '', gateId: '', shiftId: '', deviceId: '',
    effectiveFrom: '', effectiveUntil: '',
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ guardUserId: '', gateId: '', shiftId: '', deviceId: '', effectiveFrom: '', effectiveUntil: '' });
    setOpen(true);
  };

  const openEdit = (a: Assignment) => {
    setEditing(a);
    setForm({
      guardUserId: a.guardUserId,
      gateId: a.gateId,
      shiftId: a.shiftId,
      deviceId: a.deviceId ?? '',
      effectiveFrom: toLocalInput(a.effectiveFrom),
      effectiveUntil: a.effectiveUntil ? toLocalInput(a.effectiveUntil) : '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.guardUserId || !form.gateId || !form.shiftId || !form.effectiveFrom) return;
    setSaving(true);
    onError(null);
    const body = {
      guardUserId: form.guardUserId,
      gateId: form.gateId,
      shiftId: form.shiftId,
      deviceId: form.deviceId || null,
      effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      effectiveUntil: form.effectiveUntil ? new Date(form.effectiveUntil).toISOString() : null,
    };
    const res = editing
      ? await api(`/api/guard/assignments/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/guard/assignments', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      await onChanged();
    } else {
      onError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const cancel = async (a: Assignment) => {
    onError(null);
    const res = await api(`/api/guard/assignments/${a.id}`, { method: 'DELETE' });
    if (res.ok) await onChanged();
    else onError(res.error?.message ?? 'Annulation impossible.');
  };

  const activeGates = gates.filter(g => g.isActive);
  const activeShifts = shifts.filter(s => s.isActive);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {assignments.length} affectation(s) · gardien actif si <span className="font-mono text-xs">active</span> et dans la fenêtre
        </p>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouvelle affectation</Button>
      </div>
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
        ) : assignments.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Aucune affectation.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#16212B]">{a.guardName ?? a.guardUserId}</p>
                  <p className="truncate text-xs text-slate-500">
                    <span className="font-medium">{a.gateName ?? a.gateCode}</span>
                    {a.shiftName ? ` · ${a.shiftName} (${a.startTime}–${a.endTime})` : ''}
                    {a.deviceLabel ? ` · ${a.deviceLabel}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    {toDisplay(a.effectiveFrom)} → {a.effectiveUntil ? toDisplay(a.effectiveUntil) : 'sans fin'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {statusBadge(a.status)}
                  {a.status === 'scheduled' && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => cancel(a)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier l\'affectation' : 'Nouvelle affectation'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Gardien *</Label>
              <Select value={form.guardUserId || undefined} onValueChange={v => setForm({ ...form, guardUserId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir un gardien" /></SelectTrigger>
                <SelectContent>
                  {guards.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Aucun compte gardien actif. Créez-le dans Utilisateurs.</div>}
                  {guards.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Portail *</Label>
                <Select value={form.gateId || undefined} onValueChange={v => setForm({ ...form, gateId: v })}>
                  <SelectTrigger><SelectValue placeholder="Portail" /></SelectTrigger>
                  <SelectContent>
                    {activeGates.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.gateName} ({g.gateCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Quart *</Label>
                <Select value={form.shiftId || undefined} onValueChange={v => setForm({ ...form, shiftId: v })}>
                  <SelectTrigger><SelectValue placeholder="Quart" /></SelectTrigger>
                  <SelectContent>
                    {activeShifts.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Scanner (optionnel)</Label>
              <Select value={form.deviceId || undefined} onValueChange={v => setForm({ ...form, deviceId: v })}>
                <SelectTrigger><SelectValue placeholder="Aucun scanner" /></SelectTrigger>
                <SelectContent>
                  {devices.filter(d => !d.isDisabled).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.deviceLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Début d'effet *</Label>
                <Input type="datetime-local" value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Fin d'effet</Label>
                <Input type="datetime-local" value={form.effectiveUntil} onChange={e => setForm({ ...form, effectiveUntil: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-slate-400">La fin est optionnelle : sans fin, l&apos;affectation reste valide indéfiniment.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.guardUserId || !form.gateId || !form.shiftId || !form.effectiveFrom}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
