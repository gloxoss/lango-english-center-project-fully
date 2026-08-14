'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, BedDouble, CalendarDays, Clock, DoorOpen, Loader2, Plus, UserX,
} from 'lucide-react';
import { api, errMessage } from './api';

type LeavePass = {
  id: string;
  destination: string | null;
  reason: string | null;
  startDateTime: string;
  expectedReturnAt: string;
  actualReturnAt: string | null;
  status: 'pending' | 'approved' | 'denied' | 'returned';
  bedCode: string;
  roomCode: string;
};

type ResidentProjection =
  | { enrolled: false }
  | {
      enrolled: true;
      stay: {
        allocationId: string;
        state: string;
        effectiveStartDate: string;
        effectiveEndDate: string;
        checkedInAt: string | null;
        bedCode: string;
        roomCode: string;
        hostel: { id: string; code: string; name: string };
      };
      tonight: {
        rollCallStatus: string | null;
        onLeaveTonight: boolean;
        overdueReturn: boolean;
        leavePass: { id: string; destination: string | null; expectedReturnAt: string } | null;
      } | null;
      leavePasses: LeavePass[];
    };

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  denied: 'Refusée',
  returned: 'Retourné',
};

const ROLL_CALL_LABELS: Record<string, string> = {
  present: 'Présent',
  approved_leave: 'Sortie autorisée',
  late: 'En retard',
  missing: 'Absent',
  sick: 'Malade',
  excused: 'Excusé',
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ResidentMeView() {
  const [data, setData] = useState<ResidentProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState({
    destination: '',
    reason: '',
    startDateTime: toLocalInput(new Date().toISOString()),
    expectedReturnAt: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<ResidentProjection>('/api/addons/hostel/resident/me');
    if (res.ok && res.data) setData(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const requestLeave = async () => {
    if (!form.startDateTime || !form.expectedReturnAt) return;
    setSaving(true);
    setError(null);
    const res = await api('/api/addons/hostel/resident/me/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        destination: form.destination.trim() || null,
        reason: form.reason.trim() || null,
        startDateTime: new Date(form.startDateTime).toISOString(),
        expectedReturnAt: new Date(form.expectedReturnAt).toISOString(),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setRequestOpen(false);
      setForm({ destination: '', reason: '', startDateTime: toLocalInput(new Date().toISOString()), expectedReturnAt: '' });
      await load();
    } else {
      setError(errMessage(res));
    }
  };

  const enrolled = data?.enrolled === true;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#16212B]">Mon espace internat</h1>
        <p className="text-sm text-slate-500">Votre hébergement, votre appel du soir et vos permissions de sortie.</p>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">Impossible de charger votre espace.</div>
      ) : !enrolled ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
          <DoorOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-semibold text-[#16212B]">Vous n&apos;êtes pas hébergé(e)</p>
          <p className="mt-1 text-sm text-slate-500">Aucune affectation active n&apos;est associée à votre profil.</p>
        </div>
      ) : (
        <>
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-6 w-6" /></div>
                <div>
                  <p className="font-bold text-[#16212B]">{data.stay.hostel.name}</p>
                  <p className="text-sm text-slate-500">
                    {data.stay.roomCode} · {data.stay.bedCode} · {data.stay.effectiveStartDate} → {data.stay.effectiveEndDate}
                  </p>
                </div>
              </div>
              <Button onClick={() => setRequestOpen(true)}><Plus className="mr-2 h-4 w-4" /> Demander une sortie</Button>
            </div>
            {data.tonight && (
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Appel de ce soir</p>
                    <p className="text-sm font-semibold text-[#16212B]">{data.tonight.rollCallStatus ? ROLL_CALL_LABELS[data.tonight.rollCallStatus] ?? data.tonight.rollCallStatus : 'Non pointé'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <DoorOpen className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Sortie ce soir</p>
                    <p className="text-sm font-semibold text-[#16212B]">{data.tonight.onLeaveTonight ? 'Autorisée' : 'Non'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <UserX className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Retour prévu</p>
                    <p className="text-sm font-semibold text-[#16212B]">
                      {data.tonight.leavePass ? new Date(data.tonight.leavePass.expectedReturnAt).toLocaleString('fr-MA') : '—'}
                      {data.tonight.overdueReturn ? ' (en retard)' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-[#16212B]">Mes permissions de sortie ({data.leavePasses.length})</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data.leavePasses.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">Aucune permission de sortie.</div>
              )}
              {data.leavePasses.map(p => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Clock className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-semibold text-[#16212B]">
                        {new Date(p.startDateTime).toLocaleString('fr-MA')} → {new Date(p.expectedReturnAt).toLocaleString('fr-MA')}
                      </p>
                      <p className="text-xs text-slate-500">{p.destination ?? '—'}{p.reason ? ` · ${p.reason}` : ''}</p>
                    </div>
                  </div>
                  <Badge className={p.status === 'approved' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : p.status === 'denied' ? 'bg-red-100 text-red-700' : p.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Demander une permission de sortie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Destination</label>
              <Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
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
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Annuler</Button>
            <Button onClick={requestLeave} disabled={saving || !form.startDateTime || !form.expectedReturnAt}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
