'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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

export function HostelDetailView({ hostelId }: { hostelId: string }) {
  const t = useTranslations('Hostel');
  const tCommon = useTranslations('Common');

  const GENDER_LABELS: Record<string, string> = {
    mixed: t('genderMixed'),
    male_only: t('genderMaleOnly'),
    female_only: t('genderFemaleOnly'),
  };

  const ZONE_TYPE_LABELS: Record<string, string> = {
    building: t('zoneBuilding'),
    floor: t('zoneFloor'),
    wing: t('zoneWing'),
    zone: t('zoneZone'),
  };

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
        <Link href="/dashboard/hostel/hostels" className="mb-1 inline-block text-sm text-[#2487B8] hover:underline">
          {t('backToHostels')}
        </Link>
        <h1 className="text-2xl font-bold text-[#16212B]">{hostel?.name ?? tCommon('loading')}</h1>
        <p className="text-sm text-slate-500">{hostel?.code}</p>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}
        </div>
      ) : hostel ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">{t('occupiedBeds')}</p><p className="text-2xl font-bold text-[#16212B]">{occupancy?.occupiedBeds ?? 0} <span className="text-sm font-normal text-slate-400">/ {occupancy?.usableBeds ?? 0}</span></p></div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Users className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">{t('stateReserved')}</p><p className="text-2xl font-bold text-[#16212B]">{occupancy?.reservedBeds ?? 0}</p></div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
                <div><p className="text-sm text-slate-500">{t('availableBeds')}</p><p className="text-2xl font-bold text-[#16212B]">{free}</p></div>
              </div>
            </Card>
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-[#16212B]">{tCommon('details')}</h2>
              <Badge className={hostel.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                {hostel.status === 'active' ? t('statusActive') : hostel.status === 'inactive' ? t('statusInactive') : t('statusArchived')}
              </Badge>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" /><span className="text-slate-600">{t('genderPolicy')} :</span><span className="font-medium text-[#16212B]">{GENDER_LABELS[hostel.genderPolicy] ?? hostel.genderPolicy}</span></div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /><span className="text-slate-600">{t('ageMin')} / {t('ageMax')} :</span><span className="font-medium text-[#16212B]">{hostel.ageMin ?? '—'} – {hostel.ageMax ?? '—'}</span></div>
              {hostel.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><span className="text-slate-600">{t('address')} :</span><span className="font-medium text-[#16212B]">{hostel.address}</span></div>}
              {hostel.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /><span className="text-slate-600">{t('phone')} :</span><span className="font-medium text-[#16212B]">{hostel.phone}</span></div>}
              {hostel.email && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" /><span className="text-slate-600">{t('email')} :</span><span className="font-medium text-[#16212B]">{hostel.email}</span></div>}
              {hostel.emergencyContactName && (
                <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-slate-400" /><span className="text-slate-600">{t('emergencyContactName')} :</span><span className="font-medium text-[#16212B]">{hostel.emergencyContactName} · {hostel.emergencyContactPhone ?? ''}</span></div>
              )}
            </dl>
            {occupancy && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{t('occupancyRate')}</span><span className="font-semibold text-[#16212B]">{Math.round(occupancy.occupancyRate * 100)}%</span></div>
                <Progress value={occupancy.occupancyRate * 100} className="h-2" />
              </div>
            )}
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h2 className="font-semibold text-[#16212B]">{t('zones')} ({zones.length})</h2>
              <Link href="/dashboard/hostel/zones" className="text-sm font-medium text-[#2487B8] hover:underline">{tCommon('viewAll')} →</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {zones.length === 0 && <div className="p-6 text-center text-sm text-slate-500">{t('noZones')}</div>}
              {zones.map(z => (
                <div key={z.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Building2 className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-semibold text-[#16212B]">{z.name}</p>
                      <p className="text-xs text-slate-500">
                        {ZONE_TYPE_LABELS[z.zoneType] ?? z.zoneType}
                        {z.curfewTime ? ` · ${t('curfewTime')} ${z.curfewTime}` : ''}
                        {z.rollCallTime ? ` · ${t('rollCallTime')} ${z.rollCallTime}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge className={z.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {z.status === 'active' ? t('statusActive') : t('statusArchived')}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex gap-3">
            <Link href={`/dashboard/hostel?hostelId=${hostelId}`}>
              <Button variant="outline">{t('tonightTitle')}</Button>
            </Link>
            <Link href={`/dashboard/hostel/roll-call?hostelId=${hostelId}`}>
              <Button variant="outline">{t('eveningRollCall')}</Button>
            </Link>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">{t('noHostelsFound')}</div>
      )}
    </div>
  );
}
