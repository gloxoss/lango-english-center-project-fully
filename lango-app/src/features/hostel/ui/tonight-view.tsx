'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle, BedDouble, Bell, CheckCircle2, Clock, Loader2, Moon, Search, UserX,
} from 'lucide-react';
import Link from 'next/link';
import { api, errMessage } from './api';

type HostelRow = { id: string; name: string; code: string; status: string };

type TonightResident = {
  allocationId: string;
  studentId: string;
  studentName: string | null;
  bedCode: string;
  roomCode: string;
  rollCallStatus: string | null;
  onLeaveTonight: boolean;
  overdueReturn: boolean;
  accounted: boolean;
  leavePass: { id: string; destination: string | null; startDateTime: string; expectedReturnAt: string } | null;
};

type TonightData = {
  callDate: string;
  hostelId: string;
  rollCall: { id: string; status: string; openedById: string; closedAt: string | null } | null;
  residents: TonightResident[];
  summary: { total: number; present: number; onLeave: number; missing: number; unaccounted: number; overdueReturns: number };
  openEscalations: { missing_rollcall: number; overdue_return: number };
};

const ROLL_CALL_LABELS: Record<string, string> = {
  present: 'Présent',
  approved_leave: 'Sortie autorisée',
  late: 'En retard',
  missing: 'Absent',
  sick: 'Malade',
  excused: 'Excusé',
};

export function TonightView() {
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [hostelId, setHostelId] = useState('');
  const [data, setData] = useState<TonightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadHostels = useCallback(async () => {
    const res = await api<HostelRow[]>('/api/addons/hostel/hostels');
    if (res.ok && Array.isArray(res.data)) {
      const active = res.data.filter(h => h.status === 'active');
      setHostels(active);
      if (active.length === 1 && active[0]) setHostelId(active[0].id);
    }
  }, []);

  useEffect(() => { loadHostels().catch(() => {}); }, [loadHostels]);

  useEffect(() => {
    if (!hostelId) return;
    setLoading(true);
    setError(null);
    api<TonightData>(`/api/addons/hostel/tonight?hostelId=${hostelId}`)
      .then(res => {
        if (res.ok && res.data) setData(res.data);
        else setError(errMessage(res));
      })
      .catch(() => setError('Impossible de joindre le serveur.'))
      .finally(() => setLoading(false));
  }, [hostelId]);

  const refresh = () => {
    if (!hostelId) return;
    setLoading(true);
    setError(null);
    api<TonightData>(`/api/addons/hostel/tonight?hostelId=${hostelId}`)
      .then(res => {
        if (res.ok && res.data) setData(res.data);
        else setError(errMessage(res));
      })
      .catch(() => setError('Impossible de joindre le serveur.'))
      .finally(() => setLoading(false));
  };

  const s = data?.summary;
  const openMissing = data?.openEscalations.missing_rollcall ?? 0;
  const openOverdue = data?.openEscalations.overdue_return ?? 0;
  const q = search.trim().toLowerCase();
  const filteredResidents = (data?.residents ?? []).filter(r =>
    !q || (r.studentName ?? '').toLowerCase().includes(q) || r.roomCode.toLowerCase().includes(q) || r.bedCode.toLowerCase().includes(q),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Ce soir</h1>
          <p className="text-sm text-slate-500">Appel du soir, sorties autorisées et non-répartis pour une résidence.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={hostelId} onValueChange={setHostelId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Choisir une résidence" /></SelectTrigger>
            <SelectContent>
              {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refresh}><Moon className="mr-2 h-4 w-4" /> Actualiser</Button>
        </div>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      {!hostelId && !loading && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">
          {hostels.length === 0 ? 'Créez d\'abord une résidence.' : 'Sélectionnez une résidence.'}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">Résidents ce soir</p><p className="text-2xl font-bold text-[#16212B]">{s?.total ?? 0}</p></div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><CheckCircle2 className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">Présents</p><p className="text-2xl font-bold text-[#16212B]">{s?.present ?? 0}</p></div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Clock className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">En sortie</p><p className="text-2xl font-bold text-[#16212B]">{s?.onLeave ?? 0}</p></div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Bell className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">Absents / non comptés</p><p className="text-2xl font-bold text-amber-600">{s?.missing ?? 0} / {s?.unaccounted ?? 0}</p></div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><UserX className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">Retour en retard</p><p className="text-2xl font-bold text-red-600">{s?.overdueReturns ?? 0}</p></div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-1">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-[#16212B]">Appel du soir</h2>
                {data.rollCall && (
                  <Badge className={data.rollCall.status === 'open' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {data.rollCall.status === 'open' ? 'Ouvert' : 'Clos'}
                  </Badge>
                )}
              </div>
              {data.rollCall ? (
                <div className="space-y-2 text-sm">
                  <p className="text-slate-600">Appel du {data.callDate}</p>
                  <Link href={`/dashboard/hostel/roll-call`} className="block rounded-lg bg-[#2487B8]/10 px-3 py-2 font-medium text-[#2487B8] hover:bg-[#2487B8]/20">
                    Voir l&apos;appel →
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun appel ouvert pour cette date.</p>
              )}

              <div className="mt-4 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-[#16212B]">Alertes ouvertes</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                    <span className="text-amber-800">Appel manquant</span>
                    <Badge className="bg-amber-100 text-amber-700">{openMissing}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                    <span className="text-red-800">Retour en retard</span>
                    <Badge className="bg-red-100 text-red-700">{openOverdue}</Badge>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <h2 className="font-semibold text-[#16212B]">Résidents ({s?.total ?? 0})</h2>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un résident…" className="pl-9" />
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {data.residents.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">Aucun résident présent ce soir.</div>
                ) : filteredResidents.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">Aucun résident ne correspond à la recherche.</div>
                ) : (
                  filteredResidents.map(r => (
                    <div key={r.allocationId} className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${r.accounted ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-red-50 text-red-600'}`}>
                          {(r.studentName ?? '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-[#16212B]">{r.studentName ?? 'Élève inconnu'}</p>
                          <p className="text-xs text-slate-500">{r.roomCode} · {r.bedCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.onLeaveTonight && (
                          <Badge className="bg-[#D1F5E8] text-[#0b5c3a]">
                            Sortie{r.overdueReturn ? ' · retard' : ''}
                          </Badge>
                        )}
                        {r.rollCallStatus && (
                          <Badge className="bg-slate-100 text-slate-600">{ROLL_CALL_LABELS[r.rollCallStatus] ?? r.rollCallStatus}</Badge>
                        )}
                        {!r.accounted && <Badge className="bg-red-100 text-red-700">Non compté</Badge>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      )}
    </div>
  );
}
