'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertCircle, AlertTriangle, Clock, DoorOpen, LogOut, QrCode, ShieldAlert, UserRound, Users,
} from 'lucide-react';

type ApiErrorShape = { code?: string; message?: string };

async function api<T>(url: string): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

type Overview = {
  now: string;
  shift: {
    assignment: { gateId: string; deviceId: string | null; effectiveFrom: string; effectiveUntil: string; status: string };
    gate: { id: string; gateCode: string; gateName: string; direction: string } | null;
    shift: { id: string; name: string; startTime: string; endTime: string } | null;
    kioskSession: { id: string; status: string } | null;
  };
  gate: { gate: { id: string; gateCode: string; gateName: string; direction: string; isActive: boolean } };
  handoffs: { hostel: { enabled: false }; transport: { enabled: false } };
  expected: {
    visitors: Array<{ id: string; visitorFirstName: string; visitorLastName: string; purpose: string; hostName: string | null; expectedStart: string; expectedEnd: string }>;
    pickups: Array<{ id: string; studentName: string | null; matricule: string | null; relationshipType: string; authorizedUntil: string }>;
  };
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function GuardHomeView() {
  const t = useTranslations('Guard');
  const tCommon = useTranslations('Common');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [incidents, setIncidents] = useState<Array<{ id: string; severity: string; status: string; category: string; description: string }>>([]);
  const [emergencyActive, setEmergencyActive] = useState<{ active: boolean; acknowledged: boolean }>({ active: false, acknowledged: false });
  const [error, setError] = useState<string | null>(null);

  const directionLabel = (d: string): string => {
    if (d === 'entry') return t('dirEntry');
    if (d === 'exit') return t('dirExit');
    return t('dirBoth');
  };

  const load = useCallback(async () => {
    setError(null);
    const [ov, inc, emg] = await Promise.all([
      api<Overview>('/api/guard/me/expected'),
      api<Array<{ id: string; severity: string; status: string; category: string; description: string }>>('/api/guard/me/incidents'),
      api<{ procedures: unknown[]; contacts: unknown[]; emergency: { active: boolean; acknowledged: boolean } }>('/api/guard/emergency/procedures'),
    ]);
    if (ov.ok && ov.data) setOverview(ov.data);
    else if (ov.error) setError(ov.error.message ?? tCommon('loading'));
    if (inc.ok && Array.isArray(inc.data)) setIncidents(inc.data);
    if (emg.ok && emg.data) setEmergencyActive(emg.data.emergency);
  }, [tCommon]);

  useEffect(() => { load(); }, [load]);

  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'in_progress' || i.status === 'escalated');
  const highSeverity = incidents.filter(i => i.severity === 'high' || i.severity === 'critical');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('portalHome')}</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {overview
              ? `${overview.shift.shift?.name ?? t('activeShift')} · ${overview.shift.gate?.gateName ?? ''} · ${directionLabel(overview.shift.gate?.direction ?? 'both')}`
              : error ?? tCommon('loading')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {emergencyActive.active && (
            <Badge className="animate-pulse bg-rose-600 text-white"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> {t('activeEmergencyBadge')}</Badge>
          )}
          <Badge className="bg-[#DCEBF4] text-[#1B6C93]"><DoorOpen className="mr-1 h-3.5 w-3.5" /> {t('catSecurity')}</Badge>
        </div>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/portals/guard/scanner">
          <Card className="group h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:border-[#1B6C93]/40 hover:shadow-md">
            <QrCode className="h-8 w-8 text-[#1B6C93]" />
            <p className="mt-3 font-extrabold text-[#16212B]">{t('scannerTitle')}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t('scanBadgeCard')}</p>
          </Card>
        </Link>
        <Link href="/dashboard/portals/guard/visitors">
          <Card className="group h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:border-[#1B6C93]/40 hover:shadow-md">
            <Users className="h-8 w-8 text-[#1B6C93]" />
            <p className="mt-3 font-extrabold text-[#16212B]">{t('visitorsTitle')}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t('visitorsCardDesc')}</p>
          </Card>
        </Link>
        <Link href="/dashboard/portals/guard/pickups">
          <Card className="group h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:border-[#1B6C93]/40 hover:shadow-md">
            <LogOut className="h-8 w-8 text-[#1B6C93]" />
            <p className="mt-3 font-extrabold text-[#16212B]">{t('pickupsTitle')}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t('pickupsCardDesc')}</p>
          </Card>
        </Link>
        <Link href="/dashboard/portals/guard/incidents">
          <Card className="group h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:border-[#1B6C93]/40 hover:shadow-md">
            <ShieldAlert className="h-8 w-8 text-[#1B6C93]" />
            <p className="mt-3 font-extrabold text-[#16212B]">{t('incidentsTitle')}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t('incidentsCardDesc')}</p>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-extrabold text-[#16212B]"><Clock className="h-4 w-4 text-[#1B6C93]" /> {t('expectedToday')}</h2>
            <span className="text-xs text-slate-400">{(overview?.expected.visitors.length ?? 0) + (overview?.expected.pickups.length ?? 0)}</span>
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">{t('expectedVisitors')}</p>
          {overview?.expected.visitors.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {overview.expected.visitors.map(v => (
                <div key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#16212B]">{v.visitorFirstName} {v.visitorLastName}</p>
                    <p className="truncate text-xs text-slate-500">{v.purpose}{v.hostName ? ` · ${t('hostLabel', { name: v.hostName })}` : ''}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-slate-400">{v.expectedStart}–{v.expectedEnd}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">{t('noExpectedVisitors')}</p>
          )}

          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">{t('activePickups')}</p>
          {overview?.expected.pickups.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {overview.expected.pickups.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#16212B]">{p.studentName ?? t('student')}</p>
                    {p.matricule && <p className="font-mono text-xs text-slate-400">{p.matricule}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{p.relationshipType} · {t('untilDate', { date: fmtDate(p.authorizedUntil) })}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">{t('noActivePickups')}</p>
          )}
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-2 font-extrabold text-[#16212B]"><AlertTriangle className="h-4 w-4 text-[#1B6C93]" /> {t('recentIncidents')}</h2>
          {openIncidents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">{t('noOpenIncidents')}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {openIncidents.slice(0, 5).map(i => (
                <div key={i.id} className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                  {highSeverity.some(h => h.id === i.id)
                    ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#16212B]">{i.category}</p>
                    <p className="truncate text-xs text-slate-500">{i.description}</p>
                  </div>
                  <Badge className="ml-auto shrink-0 bg-amber-50 text-amber-700">{i.status}</Badge>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/portals/guard/incidents">{t('viewIncidents')}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/portals/guard/emergency">{t('emergencyProcedures')}</Link>
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('stationAndShift')}</p>
            {overview && (
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <p><UserRound className="mr-1 inline h-3.5 w-3.5 text-slate-400" /> {t('gateLabel')} : {overview.shift.gate?.gateName ?? '—'} ({overview.shift.gate?.gateCode ?? '—'})</p>
                <p><Clock className="mr-1 inline h-3.5 w-3.5 text-slate-400" /> {t('shiftLabel')} : {overview.shift.shift?.name ?? '—'} ({overview.shift.shift?.startTime ?? '—'}–{overview.shift.shift?.endTime ?? '—'})</p>
                <p><DoorOpen className="mr-1 inline h-3.5 w-3.5 text-slate-400" /> {t('deviceLabel')} : {overview.shift.assignment.deviceId ?? '—'}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
