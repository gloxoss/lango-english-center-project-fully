'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle, ClipboardCheck, Loader2, Lock, Plus,
} from 'lucide-react';
import { api, errMessage } from './api';

type HostelRow = { id: string; name: string; code: string; status: string };

type RollCallRow = {
  id: string;
  hostelId: string;
  hostelName: string | null;
  callDate: string;
  status: 'open' | 'closed';
  openedById: string;
  closedById: string | null;
  closedAt: string | null;
  createdAt: string;
};

type RollCallEntry = {
  id: string;
  allocationId: string;
  status: string;
  note: string | null;
  notedAt: string | null;
  studentId: string;
  studentName: string | null;
  bedCode: string;
  roomCode: string;
};

type RollCallDetail = RollCallRow & { entries: RollCallEntry[] };

const STATUS_LABELS: Record<string, string> = {
  present: 'Présent',
  approved_leave: 'Sortie autorisée',
  late: 'En retard',
  missing: 'Absent',
  sick: 'Malade',
  excused: 'Excusé',
};

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-[#D1F5E8] text-[#0b5c3a]',
  approved_leave: 'bg-[#D1F5E8] text-[#0b5c3a]',
  late: 'bg-amber-100 text-amber-700',
  missing: 'bg-red-100 text-red-700',
  sick: 'bg-slate-100 text-slate-600',
  excused: 'bg-slate-100 text-slate-600',
};

export function RollCallView() {
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [hostelId, setHostelId] = useState('');
  const [calls, setCalls] = useState<RollCallRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RollCallDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCalls = useCallback(async (hId?: string) => {
    const qs = hId ? `?hostelId=${encodeURIComponent(hId)}` : '';
    const res = await api<RollCallRow[]>(`/api/addons/hostel/roll-calls${qs}`);
    if (res.ok && Array.isArray(res.data)) setCalls(res.data);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const res = await api<RollCallDetail>(`/api/addons/hostel/roll-calls/${id}`);
    if (res.ok && res.data) setDetail(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  useEffect(() => {
    api<HostelRow[]>('/api/addons/hostel/hostels').then(res => {
      if (res.ok && Array.isArray(res.data)) {
        const active = res.data.filter(h => h.status === 'active');
        setHostels(active);
        if (active.length === 1 && active[0]) setHostelId(active[0].id);
      }
    }).catch(() => {});
    loadCalls().catch(() => {});
  }, [loadCalls]);

  useEffect(() => { loadCalls(hostelId || undefined).catch(() => {}); }, [hostelId, loadCalls]);

  useEffect(() => { if (selectedId) loadDetail(selectedId).catch(() => {}); }, [selectedId, loadDetail]);

  const open = async () => {
    if (!hostelId) return;
    setSaving(true);
    setError(null);
    const res = await api<{ id: string }>('/api/addons/hostel/roll-calls', {
      method: 'POST',
      body: JSON.stringify({ hostelId }),
    });
    setSaving(false);
    if (res.ok && res.data?.id) {
      setSelectedId(res.data.id);
      await loadCalls(hostelId);
      await loadDetail(res.data.id);
    } else {
      setError(errMessage(res));
    }
  };

  const markEntry = async (allocationId: string, status: string) => {
    if (!selectedId) return;
    const res = await api(`/api/addons/hostel/roll-calls/${selectedId}/entries`, {
      method: 'POST',
      body: JSON.stringify({ entries: [{ allocationId, status }] }),
    });
    if (res.ok) await loadDetail(selectedId);
    else setError(errMessage(res));
  };

  const close = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    const res = await api(`/api/addons/hostel/roll-calls/${selectedId}/close`, { method: 'POST' });
    setSaving(false);
    if (res.ok) {
      await loadDetail(selectedId);
      await loadCalls(hostelId || undefined);
    } else {
      setError(errMessage(res));
    }
  };

  const activeCount = (detail?.entries ?? []).filter(e => e.status === 'present' || e.status === 'approved_leave' || e.status === 'late' || e.status === 'sick' || e.status === 'excused').length;
  const missingCount = (detail?.entries ?? []).filter(e => e.status === 'missing').length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Appel du soir</h1>
          <p className="text-sm text-slate-500">Ouvrez l&apos;appel d&apos;une résidence, pointez les résidents puis clôturez.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={hostelId} onValueChange={setHostelId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Choisir une résidence" /></SelectTrigger>
            <SelectContent>
              {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={open} disabled={saving || !hostelId}><Plus className="mr-2 h-4 w-4" /> Ouvrir l&apos;appel</Button>
        </div>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs lg:col-span-1">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-semibold text-[#16212B]">Appels ({calls.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {calls.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">Aucun appel enregistré.</p>
            )}
            {calls.map(call => (
              <button
                key={call.id}
                onClick={() => setSelectedId(call.id)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${selectedId === call.id ? 'bg-[#D1F5E8]/40' : 'hover:bg-slate-50'}`}
              >
                <div>
                  <p className="text-sm font-semibold text-[#16212B]">Appel du {call.callDate}</p>
                  <p className="text-xs text-slate-500">Résidence {call.hostelName ?? call.hostelId.slice(0, 8)}</p>
                </div>
                <Badge className={call.status === 'open' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                  {call.status === 'open' ? 'Ouvert' : 'Clos'}
                </Badge>
              </button>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div>
              <h2 className="font-semibold text-[#16212B]">
                {detail ? `Feuille d'appel — ${detail.callDate}` : 'Détail de l\'appel'}
              </h2>
              {detail && (
                <p className="text-xs text-slate-500">
                  {activeCount} présent(s) · {missingCount} absent(s) · {detail.entries.length} résident(s)
                </p>
              )}
            </div>
            {detail?.status === 'open' && (
              <Button onClick={close} disabled={saving} variant="outline"><Lock className="mr-2 h-4 w-4" /> Clôturer l&apos;appel</Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : !detail ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-500">
              <ClipboardCheck className="h-8 w-8 text-slate-300" />
              Sélectionnez un appel pour pointer les résidents.
            </div>
          ) : detail.entries.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun résident enregistré pour cet appel.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {detail.entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      {(entry.studentName ?? '?').charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-[#16212B]">{entry.studentName ?? 'Élève inconnu'}</p>
                      <p className="text-xs text-slate-500">{entry.roomCode} · {entry.bedCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_BADGE[entry.status] ?? 'bg-slate-100 text-slate-500'}>
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </Badge>
                    {detail.status === 'open' && (
                      <Select value={entry.status} onValueChange={(v) => markEntry(entry.allocationId, v)}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Présent</SelectItem>
                          <SelectItem value="approved_leave">Sortie autorisée</SelectItem>
                          <SelectItem value="late">En retard</SelectItem>
                          <SelectItem value="missing">Absent</SelectItem>
                          <SelectItem value="sick">Malade</SelectItem>
                          <SelectItem value="excused">Excusé</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
