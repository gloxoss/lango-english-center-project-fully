'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertCircle, CalendarPlus, CalendarCheck2, ClipboardList, Loader2, LogOut, MailPlus, PhoneCall, UserPlus, Users,
} from 'lucide-react';
import { PortalStateView } from '@/components/shared/portal-state';
import {
  api, fmtTime, APPOINTMENT_STATUS_LABELS, type Appointment, type Handoff, type Visitor,
} from './reception-api';
import { ReceptionInquiryDialog } from './reception-inquiry-dialog';
import { ReceptionLookupPanel } from './reception-lookup-panel';

type HomeData = {
  openInquiriesCount: number;
  todayVisitsCount: number;
  todayAppointmentsCount: number;
  openHandoffsCount: number;
  checkedInVisitorsCount: number;
  asOf: string;
};

export function ReceptionHomeView() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const today = new Date().toISOString().split('T')[0];
    const [h, a, v, ho] = await Promise.all([
      api<HomeData>('/api/reception/me/home'),
      api<Appointment[]>(`/api/reception/appointments?date=${today}&pageSize=8`),
      api<Visitor[]>('/api/reception/visitors?status=checked_in'),
      api<Handoff[]>('/api/reception/handoffs?status=open&pageSize=6'),
    ]);
    setLoading(false);
    if (h.ok && h.data) setHome(h.data);
    else if (h.error) setError(h.error.message ?? 'Chargement impossible.');
    if (a.ok && Array.isArray(a.data)) setAppointments(a.data);
    if (v.ok && Array.isArray(v.data)) setVisitors(v.data);
    if (ho.ok && Array.isArray(ho.data)) setHandoffs(ho.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const appointmentAction = async (id: string, action: 'check-in' | 'complete' | 'cancel') => {
    setActionError(null);
    const res = await api(`/api/reception/appointments/${id}/${action}`, { method: 'POST', body: {} });
    if (!res.ok) {
      setActionError(res.error?.message ?? 'Action impossible.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const a = await api<Appointment[]>(`/api/reception/appointments?date=${today}&pageSize=8`);
    if (a.ok && Array.isArray(a.data)) setAppointments(a.data);
    if (home) setHome({ ...home, todayAppointmentsCount: Math.max(0, home.todayAppointmentsCount - (action === 'check-in' ? 0 : 1)) });
    load();
  };

  if (loading && !home) {
    return <PortalStateView state="loading" />;
  }
  if (error && !home) {
    return <PortalStateView state="error" action={<Button size="sm" variant="outline" onClick={load}>Réessayer</Button>} />;
  }

  const kpis = [
    { label: 'Demandes ouvertes', value: home?.openInquiriesCount ?? 0, icon: ClipboardList, href: '/dashboard/receptionist/inquiries' },
    { label: 'Visiteurs du jour', value: home?.todayVisitsCount ?? 0, icon: Users, href: '/dashboard/receptionist/visitors' },
    { label: 'RDV aujourd’hui', value: home?.todayAppointmentsCount ?? 0, icon: CalendarCheck2, href: '/dashboard/receptionist/appointments' },
    { label: 'Tâches ouvertes', value: home?.openHandoffsCount ?? 0, icon: LogOut, href: '/dashboard/receptionist/handoffs' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Portail accueil</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Front office : renseignements, visiteurs, rendez-vous et transferts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setInquiryOpen(true)} className="gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white">
            <MailPlus className="h-4 w-4" /> Nouvelle demande
          </Button>
          <Button size="sm" asChild variant="outline" className="gap-1.5">
            <Link href="/dashboard/receptionist/appointments"><CalendarPlus className="h-4 w-4" /> Rendez-vous</Link>
          </Button>
        </div>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      {actionError && <p className="flex items-center gap-1 text-sm text-rose-600" role="alert"><AlertCircle className="h-4 w-4" />{actionError}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className="group flex h-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:border-[#1B6C93]/40 hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DCEBF4] text-[#1B6C93]">
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-extrabold leading-none text-[#16212B]">{k.value}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{k.label}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-extrabold text-[#16212B]"><CalendarCheck2 className="h-4 w-4 text-[#1B6C93]" /> Rendez-vous d&apos;aujourd&apos;hui</h2>
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard/receptionist/appointments">Tout voir</Link></Button>
          </div>
          {appointments.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Aucun rendez-vous aujourd&apos;hui.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {appointments.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#16212B]">{a.guestName}</p>
                    <p className="truncate text-xs text-slate-500">{a.purpose}{a.hostName ? ` · hôte ${a.hostName}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{fmtTime(a.startAt)}</span>
                    <Badge className="bg-[#DCEBF4] text-[#1B6C93]">{APPOINTMENT_STATUS_LABELS[a.status] ?? a.status}</Badge>
                    {a.status === 'scheduled' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => appointmentAction(a.id, 'check-in')}>Pointer</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] text-rose-600" onClick={() => appointmentAction(a.id, 'cancel')}>Annuler</Button>
                      </div>
                    )}
                    {a.status === 'checked_in' && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => appointmentAction(a.id, 'complete')}>Clôturer</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-2 font-extrabold text-[#16212B]"><Users className="h-4 w-4 text-[#1B6C93]" /> Visiteurs présents</h2>
          {visitors.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Aucun visiteur sur site.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {visitors.slice(0, 5).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#16212B]">{v.visitorFirstName} {v.visitorLastName}</p>
                    <p className="truncate text-xs text-slate-500">{v.purpose}</p>
                  </div>
                  <Link href={`/dashboard/receptionist/visitors#visit-${v.id}`} className="text-[11px] font-bold text-[#2487B8] hover:underline">
                    Sortie →
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Button asChild size="sm" variant="outline" className="w-full gap-1.5"><Link href="/dashboard/receptionist/visitors"><UserPlus className="h-3.5 w-3.5" /> Gérer les visiteurs</Link></Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-2 font-extrabold text-[#16212B]"><PhoneCall className="h-4 w-4 text-[#1B6C93]" /> Renseignements &amp; accueil</h2>
          <div className="mt-3">
            <ReceptionLookupPanel />
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-extrabold text-[#16212B]"><ClipboardList className="h-4 w-4 text-[#1B6C93]" /> Transferts ouverts</h2>
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard/receptionist/handoffs">Tout voir</Link></Button>
          </div>
          {handoffs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Aucun transfert en cours.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {handoffs.slice(0, 5).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#16212B]">{h.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {h.category}{h.assignedToName ? ` · ${h.assignedToName}` : ''}
                    </p>
                  </div>
                  <Badge className={h.priority === 'urgent' || h.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}>
                    {h.priority}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ReceptionInquiryDialog open={inquiryOpen} onOpenChange={setInquiryOpen} onCreated={() => load()} />
    </div>
  );
}
