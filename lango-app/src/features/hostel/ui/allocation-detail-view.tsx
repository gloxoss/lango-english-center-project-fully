'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, ArrowLeftRight, CheckCircle2, History, Loader2, LogOut, UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { api, errMessage } from './api';

type AllocationDetail = {
  id: string;
  applicationId: string | null;
  studentId: string;
  studentName: string | null;
  bedId: string;
  bedCode: string;
  roomId: string;
  roomCode: string;
  roomName: string | null;
  hostelId: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  state: string;
  chargeSnapshot: unknown;
  sourceAllocationId: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AllocationEvent = {
  id: string;
  allocationId: string;
  eventType: string;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
  actorId: string;
  actorName: string | null;
};

type BedRow = { id: string; roomId: string; code: string; status: string };

export function AllocationDetailView({ allocationId }: { allocationId: string }) {
  const t = useTranslations('Hostel');
  const tCommon = useTranslations('Common');

  const STATE_LABELS: Record<string, string> = {
    reserved: t('stateReserved'),
    checked_in: t('stateCheckedIn'),
    checked_out: t('stateCheckedOut'),
    cancelled: t('stateCancelled'),
  };

  const EVENT_LABELS: Record<string, string> = {
    created: t('eventCreated'),
    checked_in: t('eventCheckedIn'),
    checked_out: t('eventCheckedOut'),
    transferred: t('eventTransferred'),
    cancelled: t('eventCancelled'),
  };

  const [row, setRow] = useState<AllocationDetail | null>(null);
  const [events, setEvents] = useState<AllocationEvent[]>([]);
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetBedId, setTargetBedId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [allocationRes, eventsRes, bedsRes] = await Promise.all([
      api<AllocationDetail>(`/api/addons/hostel/allocations/${allocationId}`),
      api<AllocationEvent[]>(`/api/addons/hostel/allocations/${allocationId}/events`),
      api<BedRow[]>('/api/addons/hostel/beds'),
    ]);
    if (allocationRes.ok && allocationRes.data) setRow(allocationRes.data);
    else setError(errMessage(allocationRes));
    if (eventsRes.ok && Array.isArray(eventsRes.data)) setEvents(eventsRes.data);
    if (bedsRes.ok && Array.isArray(bedsRes.data)) setBeds(bedsRes.data.filter(b => b.status === 'active'));
    setLoading(false);
  }, [allocationId]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const act = async (path: string, body?: object) => {
    setBusy(true);
    setError(null);
    const res = await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (res.ok) {
      await load();
    } else {
      setError(errMessage(res));
    }
  };

  const checkIn = () => act(`/api/addons/hostel/allocations/${allocationId}/check-in`);
  const checkOut = () => act(`/api/addons/hostel/allocations/${allocationId}/check-out`);
  const emergencyCheckOut = () => act(`/api/addons/hostel/allocations/${allocationId}/check-out`, { simulateFinanceFailure: true });

  const transfer = async () => {
    if (!targetBedId || !effectiveDate) return;
    await act(`/api/addons/hostel/allocations/${allocationId}/transfer`, { targetBedId, effectiveDate });
    if (!error) setTransferOpen(false);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/hostel/allocations" className="mb-1 inline-block text-sm text-[#2487B8] hover:underline">{t('backToAllocations')}</Link>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('allocationTitle', { room: row?.roomCode ?? '', bed: row?.bedCode ?? '' })}</h1>
          <p className="text-sm text-slate-500">{row?.studentName ?? tCommon('loading')}</p>
        </div>
        {row && (
          <Badge className={row.state === 'checked_in' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : row.state === 'reserved' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}>
            {STATE_LABELS[row.state] ?? row.state}
          </Badge>
        )}
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}</div>
      ) : !row ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">{t('allocationNotFound')}</div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-2">
              <h2 className="mb-4 font-semibold text-[#16212B]">{t('detailsSection')}</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-xs text-slate-500">{t('student')}</dt><dd className="font-medium text-[#16212B]">{row.studentName ?? row.studentId}</dd></div>
                <div><dt className="text-xs text-slate-500">{t('room')}</dt><dd className="font-medium text-[#16212B]">{row.roomCode}{row.roomName ? ` — ${row.roomName}` : ''}</dd></div>
                <div><dt className="text-xs text-slate-500">{t('bed')}</dt><dd className="font-medium text-[#16212B]">{row.bedCode}</dd></div>
                <div><dt className="text-xs text-slate-500">{t('period')}</dt><dd className="font-medium text-[#16212B]">{row.effectiveStartDate} → {row.effectiveEndDate}</dd></div>
                <div><dt className="text-xs text-slate-500">{t('checkInTime')}</dt><dd className="font-medium text-[#16212B]">{row.checkedInAt ? new Date(row.checkedInAt).toLocaleString() : '—'}</dd></div>
                <div><dt className="text-xs text-slate-500">{t('checkOutTime')}</dt><dd className="font-medium text-[#16212B]">{row.checkedOutAt ? new Date(row.checkedOutAt).toLocaleString() : '—'}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-slate-500">{t('notes')}</dt><dd className="font-medium text-[#16212B]">{row.notes ?? '—'}</dd></div>
              </dl>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h2 className="mb-4 font-semibold text-[#16212B]">{t('actionsSection')}</h2>
              <div className="space-y-2">
                {row.state === 'reserved' && (
                  <Button className="w-full" onClick={checkIn} disabled={busy}><UserCheck className="mr-2 h-4 w-4" /> {t('btnCheckIn')}</Button>
                )}
                {row.state === 'checked_in' && (
                  <>
                    <Button variant="outline" className="w-full" onClick={() => setTransferOpen(true)} disabled={busy}>
                      <ArrowLeftRight className="mr-2 h-4 w-4" /> {t('btnTransferBed')}
                    </Button>
                    <Button className="w-full" onClick={checkOut} disabled={busy}><LogOut className="mr-2 h-4 w-4" /> {t('btnCheckOut')}</Button>
                    <Button variant="outline" className="w-full text-red-700" onClick={emergencyCheckOut} disabled={busy} title={t('btnEmergencyCheckOutTitle')}>
                      <LogOut className="mr-2 h-4 w-4" /> {t('btnEmergencyCheckOut')}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="flex items-center gap-2 border-b border-slate-100 p-4">
              <History className="h-4 w-4 text-slate-400" />
              <h2 className="font-semibold text-[#16212B]">{t('historySection', { count: events.length })}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {events.length === 0 && <div className="p-6 text-center text-sm text-slate-500">{t('noEventsFound')}</div>}
              {events.map(ev => (
                <div key={ev.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      {ev.eventType === 'checked_in' ? <CheckCircle2 className="h-4 w-4 text-[#0b5c3a]" /> : <History className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#16212B]">{EVENT_LABELS[ev.eventType] ?? ev.eventType}</p>
                      <p className="text-xs text-slate-500">{ev.actorName ?? '—'} · {new Date(ev.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {ev.reason && <p className="max-w-xs text-xs text-slate-500">{ev.reason}</p>}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('dialogTransferTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('targetBed')}</label>
              <Select value={targetBedId} onValueChange={setTargetBedId}>
                <SelectTrigger><SelectValue placeholder={t('selectBedPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {beds.filter(b => b.id !== row?.bedId).map(b => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('effectiveDate')}</label>
              <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('reason')}</label>
              <Input placeholder={t('transferReasonPlaceholder')} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>{t('btnCancel')}</Button>
            <Button onClick={transfer} disabled={busy || !targetBedId || !effectiveDate}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('eventTransferred')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
