'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CalendarPlus, Loader2, History, Pencil, CheckCircle2, XCircle, UserX, LogIn } from 'lucide-react';
import { PortalStateView } from '@/components/shared/portal-state';
import {
  api, fmtDateTime, APPOINTMENT_STATUS_KEYS, APPOINTMENT_STATUS_LABELS, type Appointment,
} from './reception-api';

type Staff = { id: string; name: string; role: string };
type HistoryRow = { id: string; fromStatus: string | null; toStatus: string; changedById: string; reason: string | null; createdAt: string };

export function ReceptionAppointmentsView({ locale = 'fr' }: { locale?: string } = {}) {
  const t = useTranslations('Reception');
  const tCommon = useTranslations('Common');

  const [data, setData] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ date, pageSize: '100' });
    if (status !== 'all') qs.set('status', status);
    const res = await api<Appointment[]>(`/api/reception/appointments?${qs}`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setData(res.data);
      setTotal(res.total ?? 0);
    } else {
      setError(res.error?.message ?? t('errorLoad'));
    }
  }, [date, status, t]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'check-in' | 'complete' | 'cancel' | 'no-show') => {
    setActionMsg(null);
    const res = await api(`/api/reception/appointments/${id}/${action}`, { method: 'POST', body: {} });
    if (!res.ok) {
      setActionMsg(res.error?.message ?? t('actionFailed'));
      return;
    }
    setActionMsg(t('actionSuccess'));
    load();
  };

  const showHistory = async (a: Appointment) => {
    setSelected(a);
    const res = await api<{ data: { appointment: Appointment; history: HistoryRow[] } }>(`/api/reception/appointments/${a.id}`);
    setHistory(res.ok && res.data ? res.data.data.history : []);
  };

  if (loading && data.length === 0) return <PortalStateView state="loading" />;
  if (error && data.length === 0) {
    return <PortalStateView state="error" action={<Button size="sm" variant="outline" onClick={load}>{t('retry')}</Button>} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('appointmentsTitle')}</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{t('appointmentsSubtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white">
          <CalendarPlus className="h-4 w-4" /> {t('btnCreateAppointment')}
        </Button>
      </div>

      {actionMsg && <p className="text-sm text-emerald-600">{actionMsg}</p>}

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ap-date">{tCommon('date')}</Label>
            <Input id="ap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-status">{t('filterStatus')}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="ap-status" className="w-44" aria-label={t('filterStatus')}><SelectValue placeholder={t('filterStatus')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filterStatusAll')}</SelectItem>
                <SelectItem value="scheduled">{t('statusScheduled')}</SelectItem>
                <SelectItem value="checked_in">{t('statusCheckedIn')}</SelectItem>
                <SelectItem value="completed">{t('statusCompleted')}</SelectItem>
                <SelectItem value="cancelled">{t('statusCancelled')}</SelectItem>
                <SelectItem value="no_show">{t('statusNoShow')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="ml-auto text-xs text-slate-400">{t('totalAppointmentsCount', { count: total })}</span>
        </div>

        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">{t('noAppointmentsToday')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-bold">{t('colGuest')}</th>
                  <th className="py-2 pr-3 font-bold">{t('colPurpose')}</th>
                  <th className="py-2 pr-3 font-bold">{t('colHost')}</th>
                  <th className="py-2 pr-3 font-bold">{t('colTime')}</th>
                  <th className="py-2 pr-3 font-bold">{t('colStatus')}</th>
                  <th className="py-2 font-bold text-right">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((a) => {
                  const statusKey = APPOINTMENT_STATUS_KEYS[a.status];
                  const statusLabel = statusKey ? t(statusKey as any) : (APPOINTMENT_STATUS_LABELS[a.status] ?? a.status);
                  return (
                    <tr key={a.id} className="align-top">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-[#16212B]">{a.guestName}</p>
                        <p className="text-xs text-slate-400">{a.guestType}{a.guestPhone ? ` · ${a.guestPhone}` : ''}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{a.purpose}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{a.hostName ?? '—'}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{fmtDateTime(a.startAt, locale)}</td>
                      <td className="py-2.5 pr-3">
                        <Badge className="bg-[#DCEBF4] text-[#1B6C93]">{statusLabel}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {a.status === 'scheduled' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => act(a.id, 'check-in')} title={t('btnCheckIn')}>
                              <LogIn className="h-3 w-3" /> {t('btnCheckIn')}
                            </Button>
                          )}
                          {a.status === 'checked_in' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] text-emerald-700" onClick={() => act(a.id, 'complete')}>
                              <CheckCircle2 className="h-3 w-3" /> {t('btnComplete')}
                            </Button>
                          )}
                          {a.status === 'scheduled' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setHistory(null); setSelected(a); }}>
                              <Pencil className="h-3 w-3" /> {t('btnReschedule')}
                            </Button>
                          )}
                          {a.status === 'scheduled' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] text-rose-600" onClick={() => act(a.id, 'cancel')}>
                              <XCircle className="h-3 w-3" /> {t('btnCancel')}
                            </Button>
                          )}
                          {a.status === 'scheduled' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] text-slate-500" onClick={() => act(a.id, 'no-show')}>
                              <UserX className="h-3 w-3" /> {t('statusNoShow')}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => showHistory(a)}>
                            <History className="h-3 w-3" /> {t('btnHistory')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateAppointmentDialog
        open={createOpen}
        onOpenChange={(v) => { setCreateOpen(v); if (v) loadStaff(setStaff); }}
        staff={staff}
        onCreated={load}
        t={t}
      />

      <RescheduleDialog
        appointment={selected}
        history={history}
        onClose={() => { setSelected(null); setHistory(null); }}
        onDone={() => { setSelected(null); setHistory(null); load(); }}
        t={t}
        locale={locale}
      />
    </div>
  );
}

async function loadStaff(setter: (s: Staff[]) => void) {
  const res = await api<Staff[]>('/api/reception/staff');
  if (res.ok && Array.isArray(res.data)) setter(res.data);
}

function CreateAppointmentDialog({ open, onOpenChange, staff, onCreated, t }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: Staff[];
  onCreated: () => void;
  t: ReturnType<typeof useTranslations<'Reception'>>;
}) {
  const [form, setForm] = useState({
    guestType: 'parent', guestName: '', guestPhone: '', purpose: '', hostId: '', startAt: '', endAt: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idem, setIdem] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ guestType: 'parent', guestName: '', guestPhone: '', purpose: '', hostId: '', startAt: '', endAt: '' });
      setError(null);
      setIdem(crypto.randomUUID());
    }
  }, [open]);

  const submit = async () => {
    if (!form.guestName.trim() || !form.purpose.trim() || !form.hostId || !form.startAt || !form.endAt) {
      setError(t('errAllRequiredFields'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api<{ data: Appointment; created: boolean }>('/api/reception/appointments', {
      method: 'POST',
      body: {
        guestType: form.guestType,
        guestName: form.guestName.trim(),
        guestPhone: form.guestPhone.trim() || null,
        purpose: form.purpose.trim(),
        hostId: form.hostId,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        notificationTemplate: 'appointment_scheduled',
        idempotencyKey: idem,
      },
    });
    setSubmitting(false);
    if (res.ok) {
      onOpenChange(false);
      onCreated();
    } else {
      setError(res.error?.message ?? t('actionFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="appt-dialog-desc">
        <DialogHeader>
          <DialogTitle>{t('createAppointmentTitle')}</DialogTitle>
          <DialogDescription id="appt-dialog-desc">{t('createAppointmentDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="apt-guest">{t('labelGuestName')}</Label>
              <Input id="apt-guest" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-type">{t('labelGuestType')}</Label>
              <Select value={form.guestType} onValueChange={(v) => setForm({ ...form, guestType: v })}>
                <SelectTrigger id="apt-type" aria-label={t('labelGuestType')}><SelectValue placeholder={t('labelGuestType')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">{t('typeParent')}</SelectItem>
                  <SelectItem value="visitor">{t('typeVisitor')}</SelectItem>
                  <SelectItem value="prospect">{t('typeProspect')}</SelectItem>
                  <SelectItem value="supplier">{t('typeSupplier')}</SelectItem>
                  <SelectItem value="other">{t('typeOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="apt-phone">{t('labelPhone')}</Label>
              <Input id="apt-phone" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} placeholder={t('phPhone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-host">{t('labelHost')} *</Label>
              <Select value={form.hostId} onValueChange={(v) => setForm({ ...form, hostId: v })}>
                <SelectTrigger id="apt-host" aria-label={t('labelHost')}><SelectValue placeholder={t('phStaffMember')} /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apt-purpose">{t('labelPurpose')}</Label>
            <Input id="apt-purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder={t('phPurposeAppointment')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="apt-start">{t('labelStart')}</Label>
              <Input id="apt-start" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-end">{t('labelEnd')}</Label>
              <Input id="apt-end" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t('btnCancel')}</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} {t('btnRegister')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ appointment, history, onClose, onDone, t, locale }: {
  appointment: Appointment | null;
  history: HistoryRow[] | null;
  onClose: () => void;
  onDone: () => void;
  t: ReturnType<typeof useTranslations<'Reception'>>;
  locale: string;
}) {
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (appointment) {
      setStartAt(new Date(appointment.startAt).toISOString().slice(0, 16));
      setEndAt(new Date(appointment.endAt).toISOString().slice(0, 16));
      setReason('');
      setError(null);
    }
  }, [appointment]);

  if (!appointment) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await api(`/api/reception/appointments/${appointment.id}/reschedule`, {
      method: 'POST',
      body: {
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: reason.trim() || null,
      },
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error?.message ?? t('actionFailed'));
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="resched-desc">
        <DialogHeader>
          <DialogTitle>{t('rescheduleTitle', { name: appointment.guestName })}</DialogTitle>
          <DialogDescription id="resched-desc">{t('rescheduleDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rs-start">{t('labelStart')}</Label>
              <Input id="rs-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-end">{t('labelEnd')}</Label>
              <Input id="rs-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-reason">{t('labelReason')}</Label>
            <Input id="rs-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('phReason')} />
          </div>

          {history && history.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('statusHistoryTitle')}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {history.map((h) => {
                  const fromKey = h.fromStatus ? APPOINTMENT_STATUS_KEYS[h.fromStatus] : null;
                  const toKey = APPOINTMENT_STATUS_KEYS[h.toStatus];
                  const fromLabel = fromKey ? t(fromKey as any) : (h.fromStatus ?? '—');
                  const toLabel = toKey ? t(toKey as any) : h.toStatus;
                  return (
                    <li key={h.id}>
                      <span className="font-semibold">{fromLabel}</span> → <span className="font-semibold">{toLabel}</span>
                      {h.reason ? <span className="text-slate-400"> · {h.reason}</span> : null}
                      <span className="text-slate-400"> · {fmtDateTime(h.createdAt, locale)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>{t('btnCancel')}</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} {t('btnConfirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
