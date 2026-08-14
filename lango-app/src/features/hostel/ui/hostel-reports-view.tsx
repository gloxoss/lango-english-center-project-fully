'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertCircle, BarChart3, BedDouble, Download, Loader2,
} from 'lucide-react';
import { api, errMessage } from './api';

type HostelRow = { id: string; name: string; code: string; status: string };

type BoardRow = {
  hostelId: string;
  hostelCode: string;
  hostelName: string;
  totalBeds: number;
  usableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  rooms: Array<{ room: { code: string }; zoneName: string | null; occupiedBeds: number; reservedBeds: number; availableBeds: number }>;
};

type AllocationRow = {
  id: string;
  studentId: string;
  studentName: string | null;
  bedCode: string;
  roomCode: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  state: string;
};

const STATE_LABELS: Record<string, string> = {
  reserved: 'Réservé',
  checked_in: 'Présent',
  checked_out: 'Sorti',
  cancelled: 'Annulé',
};

function toCsv(value: (string | number | null)[][]): string {
  return value.map(row => row.map(cell => {
    const s = cell == null ? '' : String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

export function HostelReportsView() {
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [filterHostel, setFilterHostel] = useState('all');
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [allocState, setAllocState] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = filterHostel !== 'all' ? `&hostelId=${encodeURIComponent(filterHostel)}` : '';
    const [o, a] = await Promise.all([
      api<BoardRow[]>(`/api/addons/hostel/reports/occupancy?${qs.replace('&', '')}`),
      api<AllocationRow[]>(`/api/addons/hostel/reports/allocations?state=${allocState}${qs}`),
    ]);
    if (o.ok && Array.isArray(o.data)) setBoard(o.data);
    else setError(errMessage(o));
    if (a.ok && Array.isArray(a.data)) setAllocations(a.data);
    else setError(errMessage(a));
    setLoading(false);
  }, [filterHostel, allocState]);

  useEffect(() => {
    api<HostelRow[]>('/api/addons/hostel/hostels').then(res => {
      if (res.ok && Array.isArray(res.data)) setHostels(res.data);
    }).catch(() => {});
    loadAll().catch(() => {});
  }, [loadAll]);

  const downloadOccupancy = () => {
    const rows: (string | number | null)[][] = [
      ['Résidence', 'Lits', 'Utilisables', 'Occupés', 'Réservés', 'Libres', 'Taux %'],
      ...board.flatMap(b => b.rooms.map(r => [b.hostelName, b.totalBeds, b.usableBeds, r.occupiedBeds, r.reservedBeds, r.availableBeds, Math.round(b.occupancyRate * 100)])),
    ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'occupancy.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllocations = () => {
    const rows: (string | number | null)[][] = [
      ['ID', 'Élève', 'Chambre', 'Lit', 'Début', 'Fin', 'État'],
      ...allocations.map(a => [a.id, a.studentName ?? a.studentId, a.roomCode, a.bedCode, a.effectiveStartDate, a.effectiveEndDate, STATE_LABELS[a.state] ?? a.state]),
    ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'allocations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOccupied = board.reduce((acc, b) => acc + b.occupiedBeds, 0);
  const totalUsable = board.reduce((acc, b) => acc + b.usableBeds, 0);
  const totalAvailable = board.reduce((acc, b) => acc + b.availableBeds, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Rapports Internat</h1>
          <p className="text-sm text-slate-500">Occupation et registre des affectations, exportables en CSV.</p>
        </div>
        <Select value={filterHostel} onValueChange={setFilterHostel}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les résidences</SelectItem>
            {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      <Tabs defaultValue="occupancy">
        <TabsList>
          <TabsTrigger value="occupancy"><BarChart3 className="mr-2 h-4 w-4" /> Occupation</TabsTrigger>
          <TabsTrigger value="allocations"><BedDouble className="mr-2 h-4 w-4" /> Affectations</TabsTrigger>
        </TabsList>

        <TabsContent value="occupancy" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {totalUsable} lits utilisables · {totalOccupied} occupés · {totalAvailable} libres
            </p>
            <Button variant="outline" onClick={downloadOccupancy}><Download className="mr-2 h-4 w-4" /> CSV</Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : board.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">Aucune donnée d&apos;occupation.</div>
          ) : (
            board.map(b => (
              <Card key={b.hostelId} className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
                  <p className="font-bold text-[#16212B]">{b.hostelName}</p>
                  <p className="text-sm text-slate-500">{b.occupiedBeds}/{b.usableBeds} occupés · {Math.round(b.occupancyRate * 100)}%</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {b.rooms.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <span className="font-medium text-[#16212B]">{r.room.code}</span>
                      <span className="text-xs text-slate-500">{r.zoneName ?? 'Sans zone'}</span>
                      <span className="text-[#0b5c3a]">{r.occupiedBeds} occ.</span>
                      <span className="text-amber-600">{r.reservedBeds} rés.</span>
                      <span className="text-slate-500">{r.availableBeds} libres</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4">
          <div className="flex items-center justify-between">
            <Select value={allocState} onValueChange={setAllocState}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les états</SelectItem>
                <SelectItem value="reserved">Réservé</SelectItem>
                <SelectItem value="checked_in">Présent</SelectItem>
                <SelectItem value="checked_out">Sorti</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={downloadAllocations}><Download className="mr-2 h-4 w-4" /> CSV</Button>
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
              ) : allocations.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">Aucune affectation.</div>
              ) : (
                allocations.map(a => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-semibold text-[#16212B]">{a.studentName ?? a.studentId}</p>
                      <p className="text-xs text-slate-500">{a.roomCode} · {a.bedCode} · {a.effectiveStartDate} → {a.effectiveEndDate}</p>
                    </div>
                    <Badge className={a.state === 'checked_in' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : a.state === 'reserved' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}>
                      {STATE_LABELS[a.state] ?? a.state}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
