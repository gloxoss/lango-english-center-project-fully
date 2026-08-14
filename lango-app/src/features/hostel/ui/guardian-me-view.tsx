'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, BedDouble, CalendarDays, DoorOpen, Loader2, UserX, Users,
} from 'lucide-react';
import { api, errMessage } from './api';

type ChildLeavePass = {
  id: string;
  destination: string | null;
  startDateTime: string;
  expectedReturnAt: string;
  status: string;
};

type GuardianChild = {
  studentId: string;
  studentName: string;
  enrolled: boolean;
  stay?: {
    allocationId: string;
    effectiveStartDate: string;
    effectiveEndDate: string;
    bedCode: string;
    roomCode: string;
    hostel: { id: string; code: string; name: string };
  };
  tonight?: {
    rollCallStatus: string | null;
    onLeaveTonight: boolean;
    overdueReturn: boolean;
    leavePass: { id: string; destination: string | null; expectedReturnAt: string } | null;
  } | null;
  leavePasses: ChildLeavePass[];
};

type GuardianProjection = { children: GuardianChild[] };

const ROLL_CALL_LABELS: Record<string, string> = {
  present: 'Présent',
  approved_leave: 'Sortie autorisée',
  late: 'En retard',
  missing: 'Absent',
  sick: 'Malade',
  excused: 'Excusé',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  denied: 'Refusée',
  returned: 'Retourné',
};

export function GuardianMeView() {
  const [data, setData] = useState<GuardianProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<GuardianProjection>('/api/addons/hostel/guardian/me');
    if (res.ok && res.data) setData(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#16212B]">Espace tuteur</h1>
        <p className="text-sm text-slate-500">Suivi de l&apos;hébergement de vos enfants à l&apos;internat.</p>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">Impossible de charger vos enfants.</div>
      ) : data.children.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-semibold text-[#16212B]">Aucun enfant lié</p>
          <p className="mt-1 text-sm text-slate-500">Aucun enfant n&apos;est associé à votre profil tuteur.</p>
        </div>
      ) : (
        data.children.map(child => (
          <Card key={child.studentId} className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${child.enrolled ? 'bg-[#D1F5E8] text-[#16212B]' : 'bg-slate-100 text-slate-500'}`}>
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-[#16212B]">{child.studentName}</p>
                  <p className="text-xs text-slate-500">{child.enrolled ? 'Hébergé' : 'Non hébergé'}</p>
                </div>
              </div>
              {child.tonight && (
                <div className="flex items-center gap-2">
                  {child.tonight.onLeaveTonight && <Badge className="bg-[#D1F5E8] text-[#0b5c3a]">Sortie ce soir</Badge>}
                  {child.tonight.overdueReturn && <Badge className="bg-red-100 text-red-700">Retour en retard</Badge>}
                  {child.tonight.rollCallStatus && (
                    <Badge className="bg-slate-100 text-slate-600">{ROLL_CALL_LABELS[child.tonight.rollCallStatus] ?? child.tonight.rollCallStatus}</Badge>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {child.stay ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Hébergement</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-slate-400" /><span className="font-medium text-[#16212B]">{child.stay.hostel.name}</span></div>
                    <p className="pl-6 text-slate-600">{child.stay.roomCode} · {child.stay.bedCode}</p>
                    <p className="pl-6 text-xs text-slate-500">{child.stay.effectiveStartDate} → {child.stay.effectiveEndDate}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  <UserX className="h-4 w-4" /> Non hébergé actuellement
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Permissions de sortie ({child.leavePasses?.length ?? 0})</p>
                <div className="space-y-2">
                  {(child.leavePasses ?? []).length === 0 && <p className="text-sm text-slate-500">Aucune.</p>}
                  {(child.leavePasses ?? []).map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">{new Date(p.startDateTime).toLocaleString('fr-MA')} → {new Date(p.expectedReturnAt).toLocaleString('fr-MA')}</span>
                      </div>
                      <Badge className={p.status === 'approved' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : p.status === 'denied' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
