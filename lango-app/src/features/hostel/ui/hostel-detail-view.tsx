'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle, BedDouble, Building2, Clock, Loader2, MapPin, Phone, ShieldAlert, Users,
} from 'lucide-react';
import Link from 'next/link';
import { api, errMessage } from './api';

type Hostel = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  genderPolicy: 'mixed' | 'male_only' | 'female_only';
  ageMin: number | null;
  ageMax: number | null;
  wardenEmployeeId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: string;
};

type HostelBoard = {
  hostelId: string;
  totalBeds: number;
  usableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  occupancyRate: number;
};

type ZoneRow = {
  id: string;
  zoneType: string;
  code: string | null;
  name: string;
  curfewTime: string | null;
  rollCallTime: string | null;
  emergencyAssemblyPoint: string | null;
  status: string;
};

const GENDER_LABELS: Record<string, string> = { mixed: 'Mixte', male_only: 'Garçons', female_only: 'Filles' };
const ZONE_TYPE_LABELS: Record<string, string> = { building: 'Bâtiment', floor: 'Étage', wing: 'Aile', zone: 'Zone' };

export function HostelDetailView({ hostelId }: { hostelId: string }) {
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [board, setBoard] = useState<HostelBoard[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [h, b, z] = await Promise.all([
      api<Hostel>(`/api/addons/hostel/hostels/${hostelId}`),
      api<HostelBoard[]>(`/api/addons/hostel/board?hostelId=${hostelId}`),
      api<ZoneRow[]>(`/api/addons/hostel/zones?hostelId=${hostelId}`),
    ]);
    if (h.ok && h.data) setHostel(h.data);
    else setError(errMessage(h));
    if (b.ok && Array.isArray(b.data)) setBoard(b.data);
    if (z.ok && Array.isArray(z.data)) setZones(z.data);
    setLoading(false);
  }, [hostelId]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const occupancy = board[0];
  const free = occupancy ? Math.max(0, occupancy.usableBeds - occupancy.occupiedBeds - occupancy.reservedBeds) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/dashboard/hostel/hostels" className="mb-1 inline-block text-sm text-[#2487B8] hover:underline">← Résidences</Link>
        <h1 className="text-2xl font-bold text-[#16212B]">{hostel?.name ?? 'Chargement…'}</h1>
        <p className="text-sm text-slate-500">{hostel?.code}</p>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : hostel ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">Lits occupés</p><p className="text-2xl font-bold text-[#16212B]">{occupancy?.occupiedBeds ?? 0} <span className="text-sm font-normal text-slate-400">/ {occupancy?.usableBeds ?? 0}</span></p></div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Users className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">Réservés</p><p className="text-2xl font-bold text-[#16212B]">{occupancy?.reservedBeds ?? 0}</p></div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">Lits libres</p><p className="text-2xl font-bold text-[#16212B]">{free}</p></div>
              </div>
            </Card>
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-[#16212B]">Informations</h2>
              <Badge className={hostel.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                {hostel.status === 'active' ? 'Actif' : hostel.status === 'inactive' ? 'Inactif' : 'Archivé'}
              </Badge>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" /><span className="text-slate-600">Politique de genre :</span><span className="font-medium text-[#16212B]">{GENDER_LABELS[hostel.genderPolicy] ?? hostel.genderPolicy}</span></div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /><span className="text-slate-600">Âge :</span><span className="font-medium text-[#16212B]">{hostel.ageMin ?? '—'} – {hostel.ageMax ?? '—'} ans</span></div>
              {hostel.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><span className="text-slate-600">Adresse :</span><span className="font-medium text-[#16212B]">{hostel.address}</span></div>}
              {hostel.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /><span className="text-slate-600">Téléphone :</span><span className="font-medium text-[#16212B]">{hostel.phone}</span></div>}
              {hostel.email && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" /><span className="text-slate-600">Email :</span><span className="font-medium text-[#16212B]">{hostel.email}</span></div>}
              {hostel.emergencyContactName && (
                <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-slate-400" /><span className="text-slate-600">Urgence :</span><span className="font-medium text-[#16212B]">{hostel.emergencyContactName} · {hostel.emergencyContactPhone ?? ''}</span></div>
              )}
            </dl>
            {occupancy && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Taux d&apos;occupation</span><span className="font-semibold text-[#16212B]">{Math.round(occupancy.occupancyRate * 100)}%</span></div>
                <Progress value={occupancy.occupancyRate * 100} className="h-2" />
              </div>
            )}
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h2 className="font-semibold text-[#16212B]">Zones ({zones.length})</h2>
              <Link href="/dashboard/hostel/zones" className="text-sm font-medium text-[#2487B8] hover:underline">Gérer →</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {zones.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Aucune zone.</div>}
              {zones.map(z => (
                <div key={z.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Building2 className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-semibold text-[#16212B]">{z.name}</p>
                      <p className="text-xs text-slate-500">
                        {ZONE_TYPE_LABELS[z.zoneType] ?? z.zoneType}
                        {z.curfewTime ? ` · couvre-feu ${z.curfewTime}` : ''}
                        {z.rollCallTime ? ` · appel ${z.rollCallTime}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge className={z.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {z.status === 'active' ? 'Actif' : 'Archivé'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex gap-3">
            <Link href={`/dashboard/hostel?hostelId=${hostelId}`}>
              <Button variant="outline">Ce soir</Button>
            </Link>
            <Link href={`/dashboard/hostel/roll-call?hostelId=${hostelId}`}>
              <Button variant="outline">Appel du soir</Button>
            </Link>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">Résidence introuvable.</div>
      )}
    </div>
  );
}
