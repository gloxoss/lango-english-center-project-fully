'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarPlus, Loader2, History, Pencil, CheckCircle2, XCircle, UserX, LogIn } from 'lucide-react';
import { PortalStateView } from '@/components/shared/portal-state';
import {
  api, fmtDateTime, APPOINTMENT_STATUS_LABELS, type Appointment,
} from './reception-api';

type Staff = { id: string; name: string; role: string };
type HistoryRow = { id: string; fromStatus: string | null; toStatus: string; changedById: string; reason: string | null; createdAt: string };

export function ReceptionAppointmentsView() {
  const [data, setData] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ date, pageSize: '100' });
    if (status !== 'all') qs.set('status', status);
    const res = await api<Appointment[]>(`/api/reception/appointments?${qs}`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setData(res.data);
      setTotal(res.total ?? 0);
    } else {
      setError(res.error?.message ?? 'Chargement impossible.');
    }
  }, [date, status]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'check-in' | 'complete' | 'cancel' | 'no-show') => {
    setActionMsg(null);
    const res = await api(`/api/reception/appointments/${id}/${action}`, { method: 'POST', body: {} });
    if (!res.ok) {
      setActionMsg(res.error?.message ?? 'Action impossible.');
      return;
    }
    setActionMsg('Action effectuée.');
    load();
  };

  const showHistory = async (a: Appointment) => {
    setSelected(a);
    const res = await api<{ data: { appointment: Appointment; history: HistoryRow[] } }>(`/api/reception/appointments/${a.id}`);
    setHistory(res.ok && res.data ? res.data.data.history : []);
  };

  if (loading && data.length === 0) return <PortalStateView state="loading" />;
  if (error && data.length === 0) {
    return <PortalStateView state="error" action={<Button size="sm" variant="outline" onClick={load}>Réessayer</Button>} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Rendez-vous</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Planifier, pointer, reprogrammer, clôturer.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white">
          <CalendarPlus className="h-4 w-4" /> Créer un rendez-vous
        </Button>
      </div>

      {actionMsg && <p className="text-sm text-emerald-600">{actionMsg}</p>}

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ap-date">Date</Label>
            <Input id="ap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-status">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="ap-status" className="w-44" aria-label="Filtrer par statut"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="scheduled">Planifiés</SelectItem>
                <SelectItem value="checked_in">Pointés</SelectItem>
                <SelectItem value="completed">Terminés</SelectItem>
                <SelectItem value="cancelled">Annulés</SelectItem>
                <SelectItem value="no_show">Absents</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="ml-auto text-xs text-slate-400">{total} rendez-vous</span>
        </div>

        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucun rendez-vous pour cette sélection.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-bold">Visiteur</th>
                  <th className="py-2 pr-3 font-bold">Motif</th>
                  <th className="py-2 pr-3 font-bold">Hôte</th>
                  <th className="py-2 pr-3 font-bold">Heure</th>
                  <th className="py-2 pr-3 font-bold">Statut</th>
                  <th className="py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-[#16212B]">{a.guestName}</p>
                      <p className="text-xs text-slate-400">{a.guestType}{a.guestPhone ? ` · ${a.guestPhone}` : ''}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{a.purpose}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{a.hostName ?? '—'}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{fmtDateTime(a.startAt)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge className="bg-[#DCEBF4] text-[#1B6C93]">{APPOINTMENT_STATUS_LABELS[a.status] ?? a.status}</Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {a.status === 'scheduled' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => act(a.id, 'check-in')} title="Pointer l'arrivée"><LogIn className="h-3 w-3" /> Pointer</Button>
                        )}
                        {a.status === 'checked_in' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] text-emerald-700" onClick={() => act(a.id, 'complete')}><CheckCircle2 className="h-3 w-3" /> Clôturer</Button>
                        )}
                        {a.status === 'scheduled' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setHistory(null); setSelected(a); }}><Pencil className="h-3 w-3" /> Reprogrammer</Button>
                        )}
                        {a.status === 'scheduled' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] text-rose-600" onClick={() => act(a.id, 'cancel')}><XCircle className="h-3 w-3" /> Annuler</Button>
                        )}
                        {a.status === 'scheduled' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] text-slate-500" onClick={() => act(a.id, 'no-show')}><UserX className="h-3 w-3" /> Absent</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => showHistory(a)}><History className="h-3 w-3" /> Historique</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateAppointmentDialog
        open={createOpen}
        onOpenChange={(v) => { setCreateOpen(v); if (v) loadStaff(setStaff); }}
        staff={staff}
        onCreated={load}
      />

      <RescheduleDialog
        appointment={selected}
        history={history}
        onClose={() => { setSelected(null); setHistory(null); }}
        onDone={() => { setSelected(null); setHistory(null); load(); }}
      />
    </div>
  );
}

async function loadStaff(setter: (s: Staff[]) => void) {
  const res = await api<Staff[]>('/api/reception/staff');
  if (res.ok && Array.isArray(res.data)) setter(res.data);
}

function CreateAppointmentDialog({ open, onOpenChange, staff, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: Staff[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    guestType: 'parent', guestName: '', guestPhone: '', purpose: '', hostId: '', startAt: '', endAt: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idem, setIdem] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ guestType: 'parent', guestName: '', guestPhone: '', purpose: '', hostId: '', startAt: '', endAt: '' });
      setError(null);
      setIdem(crypto.randomUUID());
    }
  }, [open]);

  const submit = async () => {
    if (!form.guestName.trim() || !form.purpose.trim() || !form.hostId || !form.startAt || !form.endAt) {
      setError('Tous les champs obligatoires doivent être remplis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api<{ data: Appointment; created: boolean }>('/api/reception/appointments', {
      method: 'POST',
      body: {
        guestType: form.guestType,
        guestName: form.guestName.trim(),
        guestPhone: form.guestPhone.trim() || null,
        purpose: form.purpose.trim(),
        hostId: form.hostId,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        notificationTemplate: 'appointment_scheduled',
        idempotencyKey: idem,
      },
    });
    setSubmitting(false);
    if (res.ok) {
      onOpenChange(false);
      onCreated();
    } else {
      setError(res.error?.message ?? 'Création impossible.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="appt-dialog-desc">
        <DialogHeader>
          <DialogTitle>Créer un rendez-vous</DialogTitle>
          <DialogDescription id="appt-dialog-desc">Planifier une visite pour un parent, visiteur, prospect ou fournisseur.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="apt-guest">Nom du visiteur *</Label>
              <Input id="apt-guest" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-type">Type</Label>
              <Select value={form.guestType} onValueChange={(v) => setForm({ ...form, guestType: v })}>
                <SelectTrigger id="apt-type" aria-label="Type de visiteur"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="visitor">Visiteur</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="supplier">Fournisseur</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="apt-phone">Téléphone</Label>
              <Input id="apt-phone" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-host">Hôte *</Label>
              <Select value={form.hostId} onValueChange={(v) => setForm({ ...form, hostId: v })}>
                <SelectTrigger id="apt-host" aria-label="Hôte du rendez-vous"><SelectValue placeholder="Choisir un hôte" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apt-purpose">Motif *</Label>
            <Input id="apt-purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Ex. Suivi scolaire, inscription…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="apt-start">Début *</Label>
              <Input id="apt-start" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-end">Fin *</Label>
              <Input id="apt-end" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Planifier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ appointment, history, onClose, onDone }: {
  appointment: Appointment | null;
  history: HistoryRow[] | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (appointment) {
      setStartAt(new Date(appointment.startAt).toISOString().slice(0, 16));
      setEndAt(new Date(appointment.endAt).toISOString().slice(0, 16));
      setReason('');
      setError(null);
    }
  }, [appointment]);

  if (!appointment) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await api(`/api/reception/appointments/${appointment.id}/reschedule`, {
      method: 'POST',
      body: {
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: reason.trim() || null,
      },
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error?.message ?? 'Reprogrammation impossible.');
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="resched-desc">
        <DialogHeader>
          <DialogTitle>Reprogrammer · {appointment.guestName}</DialogTitle>
          <DialogDescription id="resched-desc">Modifier les horaires du rendez-vous. Le motif est tracé dans l&apos;historique.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rs-start">Début *</Label>
              <Input id="rs-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-end">Fin *</Label>
              <Input id="rs-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-reason">Motif</Label>
            <Input id="rs-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. Indisponibilité de l'hôte" />
          </div>

          {history && history.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Historique des statuts</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-semibold">{h.fromStatus ?? '—'}</span> → <span className="font-semibold">{h.toStatus}</span>
                    {h.reason ? <span className="text-slate-400"> · {h.reason}</span> : null}
                    <span className="text-slate-400"> · {fmtDateTime(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Fermer</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
