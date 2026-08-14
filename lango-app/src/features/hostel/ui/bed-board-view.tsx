'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle, BedDouble, Building2, ChevronDown, ChevronRight, Loader2, Users,
} from 'lucide-react';
import { api, errMessage } from './api';

type HostelRow = { id: string; name: string; code: string; status: string };

type BedOccupancy = {
  bed: { id: string; code: string; status: string; isAccessible: boolean };
  allocationId: string | null;
  studentId: string | null;
  studentName: string | null;
  state: 'reserved' | 'checked_in' | null;
};

type RoomOccupancy = {
  room: { id: string; code: string; name: string | null; status: string };
  categoryCode: string | null;
  zoneName: string | null;
  totalBeds: number;
  usableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  beds: BedOccupancy[];
};

type HostelBoard = {
  hostelId: string;
  hostelCode: string;
  hostelName: string;
  status: string;
  genderPolicy: string;
  totalBeds: number;
  usableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  rooms: RoomOccupancy[];
};

const GENDER_LABELS: Record<string, string> = { mixed: 'Mixte', male_only: 'Garçons', female_only: 'Filles' };

export function BedBoardView() {
  const [board, setBoard] = useState<HostelBoard[]>([]);
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [filterHostel, setFilterHostel] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<Set<string>>(new Set());

  const load = useCallback(async (hostelId?: string) => {
    setLoading(true);
    setError(null);
    const qs = hostelId ? `?hostelId=${encodeURIComponent(hostelId)}` : '';
    const res = await api<HostelBoard[]>(`/api/addons/hostel/board${qs}`);
    if (res.ok && Array.isArray(res.data)) setBoard(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  useEffect(() => {
    api<HostelRow[]>('/api/addons/hostel/hostels').then(res => {
      if (res.ok && Array.isArray(res.data)) setHostels(res.data);
    }).catch(() => {});
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    load(filterHostel === 'all' ? undefined : filterHostel).catch(() => {});
  }, [filterHostel, load]);

  const toggleRoom = (roomId: string) => {
    setOpenRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
      return next;
    });
  };

  const totals = board.reduce((acc, b) => ({
    totalBeds: acc.totalBeds + b.totalBeds,
    usableBeds: acc.usableBeds + b.usableBeds,
    occupiedBeds: acc.occupiedBeds + b.occupiedBeds,
    reservedBeds: acc.reservedBeds + b.reservedBeds,
  }), { totalBeds: 0, usableBeds: 0, occupiedBeds: 0, reservedBeds: 0 });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Occupancy — Vue d&apos;ensemble</h1>
          <p className="text-sm text-slate-500">Occupation dérivée des affectations effectives, jamais d&apos;un compteur manuel.</p>
        </div>
        <Select value={filterHostel} onValueChange={setFilterHostel}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les résidences</SelectItem>
            {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Lits occupés</p><p className="text-2xl font-bold text-[#16212B]">{totals.occupiedBeds} <span className="text-sm font-normal text-slate-400">/ {totals.usableBeds}</span></p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Users className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Réservés</p><p className="text-2xl font-bold text-[#16212B]">{totals.reservedBeds}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Lits disponibles</p><p className="text-2xl font-bold text-[#16212B]">{totals.usableBeds - totals.occupiedBeds - totals.reservedBeds}</p></div>
          </div>
        </Card>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
        ) : board.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">Aucune résidence trouvée.</div>
        ) : (
          board.map(hostel => (
            <Card key={hostel.hostelId} className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Building2 className="h-5 w-5" /></div>
                  <div>
                    <p className="font-bold text-[#16212B]">{hostel.hostelName}</p>
                    <p className="text-xs text-slate-500">
                      {hostel.hostelCode} · {GENDER_LABELS[hostel.genderPolicy] ?? hostel.genderPolicy} · {hostel.occupiedBeds}/{hostel.usableBeds} occupés
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-40">
                    <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Taux d&apos;occupation</span><span className="font-semibold text-[#16212B]">{Math.round(hostel.occupancyRate * 100)}%</span></div>
                    <Progress value={hostel.occupancyRate * 100} className="h-2" />
                  </div>
                  <Badge className={hostel.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {hostel.status === 'active' ? 'Actif' : hostel.status === 'inactive' ? 'Inactif' : 'Archivé'}
                  </Badge>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {hostel.rooms.map(room => {
                  const isOpen = openRooms.has(room.room.id);
                  return (
                    <div key={room.room.id}>
                      <button
                        onClick={() => toggleRoom(room.room.id)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          <div>
                            <p className="text-sm font-semibold text-[#16212B]">{room.room.code}{room.room.name ? ` — ${room.room.name}` : ''}</p>
                            <p className="text-xs text-slate-500">
                              {room.zoneName ?? 'Sans zone'}
                              {room.categoryCode ? ` · ${room.categoryCode}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="text-[#0b5c3a]">{room.occupiedBeds} occupé{room.occupiedBeds > 1 ? 's' : ''}</span>
                          <span className="text-amber-600">{room.reservedBeds} réservé{room.reservedBeds > 1 ? 's' : ''}</span>
                          <span>{room.availableBeds} libre{room.availableBeds > 1 ? 's' : ''}</span>
                          <Badge className="bg-slate-100 text-slate-600">{Math.round(room.occupancyRate * 100)}%</Badge>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="grid gap-2 px-5 pb-4 sm:grid-cols-2 lg:grid-cols-4">
                          {room.beds.map(bed => (
                            <div
                              key={bed.bed.id}
                              className={`rounded-xl border p-3 ${
                                bed.state === 'checked_in'
                                  ? 'border-[#D1F5E8] bg-[#D1F5E8]/30'
                                  : bed.state === 'reserved'
                                    ? 'border-amber-200 bg-amber-50'
                                    : bed.bed.status === 'active'
                                      ? 'border-slate-200/80 bg-white'
                                      : 'border-slate-100 bg-slate-50 opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-[#16212B]">{bed.bed.code}</p>
                                {bed.state === 'checked_in' && <Badge className="bg-[#D1F5E8] text-[#0b5c3a]">Présent</Badge>}
                                {bed.state === 'reserved' && <Badge className="bg-amber-100 text-amber-700">Réservé</Badge>}
                                {bed.state === null && bed.bed.status === 'active' && <Badge className="bg-slate-100 text-slate-500">Libre</Badge>}
                                {bed.bed.status !== 'active' && <Badge className="bg-slate-200 text-slate-600">Hors service</Badge>}
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{bed.studentName ?? '—'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
