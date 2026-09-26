'use client';

import { CalendarClock, CalendarDays, CheckCircle2, Clock, DoorOpen, Loader2, RotateCcw, User } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { casablancaTodayIso } from '@/libs/finance/today';

/**
 * APPEL DU JOUR — the day's real lessons, in order, with their attendance state.
 *
 * There is deliberately no class / subject / period picker: a lesson's identity
 * comes from the published timetable, so the admin reads a schedule rather than
 * reconstructing one. Past days are view-only and are corrected through an
 * explicit, reasoned "Corriger le registre"; future days are a preview.
 */

type SessionState = 'A_VENIR' | 'EN_COURS' | 'A_COMPLETER' | 'NON_POINTE' | 'POINTAGE_TERMINE' | 'CORRIGE' | 'ANNULE';

type Register = { id: string; status: string; reference: string } | null;

type ExceptionType = 'CANCELLED' | 'SUBSTITUTE' | 'ROOM_CHANGE' | 'RESCHEDULE';

type SessionException = {
  type: ExceptionType;
  reason: string;
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
  roomLabel: string | null;
  startTime: string | null;
  endTime: string | null;
};

type DaySession = {
  slotId: string;
  startTime: string;
  endTime: string;
  baseStartTime: string;
  baseEndTime: string;
  subjectName: string | null;
  className: string | null;
  sectionName: string | null;
  teacherName: string | null;
  room: string | null;
  period: number;
  state: SessionState;
  register: Register;
  exception: SessionException | null;
};

type LegacyRegister = {
  id: string;
  classId: string;
  className: string | null;
  counts: { present: number; late: number; absent: number; excused: number };
};

type DayData = {
  date: string;
  businessDate: string;
  mode: 'past' | 'today' | 'future';
  sessions: DaySession[];
  legacyRegisters?: LegacyRegister[];
  counts: { total: number; toComplete: number; nonPointe?: number; done: number };
};

const STATE_STYLES: Record<SessionState, string> = {
  A_VENIR: 'bg-slate-100 text-slate-700 border-slate-200',
  EN_COURS: 'bg-sky-50 text-sky-800 border-sky-200',
  A_COMPLETER: 'bg-amber-50 text-amber-800 border-amber-200',
  NON_POINTE: 'bg-slate-50 text-slate-500 border-slate-200',
  POINTAGE_TERMINE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CORRIGE: 'bg-violet-50 text-violet-800 border-violet-200',
  ANNULE: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATE_KEYS: Record<SessionState, string> = {
  A_VENIR: 'stateUpcoming',
  EN_COURS: 'stateOngoing',
  A_COMPLETER: 'stateToComplete',
  NON_POINTE: 'stateNonPointeParCours',
  POINTAGE_TERMINE: 'stateDone',
  CORRIGE: 'stateCorrected',
  ANNULE: 'stateCancelled',
};

export function AppelDuJourView() {
  const t = useTranslations('Attendance');
  const locale = useLocale();
  const [date, setDate] = useState(casablancaTodayIso());
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<DaySession | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Late completion for past sessions without registers
  const [lateCompleting, setLateCompleting] = useState<DaySession | null>(null);
  const [lateReason, setLateReason] = useState('');
  const [lateSaving, setLateSaving] = useState(false);

  // One-day exception editor.
  const [exceptionFor, setExceptionFor] = useState<DaySession | null>(null);
  const [exceptionType, setExceptionType] = useState<ExceptionType>('CANCELLED');
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionSubstitute, setExceptionSubstitute] = useState('');
  const [exceptionRoom, setExceptionRoom] = useState('');
  const [exceptionStart, setExceptionStart] = useState('');
  const [exceptionEnd, setExceptionEnd] = useState('');
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; name: string | null }[]>([]);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/day?date=${encodeURIComponent(target)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? 'failed');
      }
      setData(json.data as DayData);
    } catch {
      setError(t('correctionFailed'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(date); }, [date, load]);

  async function submitCorrection() {
    if (!correcting?.register || reason.trim().length < 3) {
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/attendance/registers/reopen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ registerId: correcting.register.id, reason: reason.trim() }),
      });
      if (!res.ok) {
        throw new Error('failed');
      }
      setNotice(t('correctionSuccess'));
      setCorrecting(null);
      setReason('');
      await load(date);
    } catch {
      setNotice(t('correctionFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function submitLateComplete() {
    if (!lateCompleting || lateReason.trim().length < 3) {
      return;
    }
    setLateSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/attendance/registers/late-complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slotId: lateCompleting.slotId, date, reason: lateReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? 'failed');
      }
      setNotice(t('completeLateSuccess'));
      setLateCompleting(null);
      setLateReason('');
      await load(date);
    } catch (e: any) {
      setNotice(e?.message ?? t('completeLateFailed'));
    } finally {
      setLateSaving(false);
    }
  }

  // Session-scoped link: the roll call reads ?slot=…&date=… and resolves the
  // lesson from the timetable, so its context cannot be mis-picked.
  const rollCallHref = (slotId: string) =>
    `/${locale}/dashboard/attendance?slot=${encodeURIComponent(slotId)}&date=${encodeURIComponent(date)}`;

  const EXCEPTION_LABEL: Record<ExceptionType, string> = {
    CANCELLED: t('exceptionTypeCancel'),
    SUBSTITUTE: t('exceptionTypeSubstitute'),
    ROOM_CHANGE: t('exceptionTypeRoom'),
    RESCHEDULE: t('exceptionTypeReschedule'),
  };

  function openException(session: DaySession) {
    setExceptionFor(session);
    setExceptionType(session.exception?.type ?? 'CANCELLED');
    setExceptionReason(session.exception?.reason ?? '');
    setExceptionSubstitute(session.exception?.substituteTeacherId ?? '');
    setExceptionRoom(session.exception?.roomLabel ?? '');
    setExceptionStart(session.exception?.startTime ?? session.startTime);
    setExceptionEnd(session.exception?.endTime ?? session.endTime);
    setNotice(null);
    void loadTeachers();
  }

  async function loadTeachers() {
    if (teachers.length > 0) {
      return;
    }
    try {
      const res = await fetch('/api/users?role=teacher&pageSize=200');
      const json = await res.json();
      const items = json?.data?.items ?? json?.data ?? [];
      setTeachers((Array.isArray(items) ? items : []).map((u: { id: string; name: string | null }) => ({ id: u.id, name: u.name })));
    } catch {
      // The field simply stays empty; the admin can reopen to retry.
    }
  }

  async function saveException() {
    if (!exceptionFor || exceptionReason.trim().length < 3) {
      return;
    }
    setExceptionSaving(true);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        classScheduleSlotId: exceptionFor.slotId,
        date,
        type: exceptionType,
        reason: exceptionReason.trim(),
      };
      if (exceptionType === 'SUBSTITUTE') {
        body.substituteTeacherId = exceptionSubstitute || undefined;
      }
      if (exceptionType === 'ROOM_CHANGE') {
        body.roomLabel = exceptionRoom.trim() || undefined;
      }
      if (exceptionType === 'RESCHEDULE') {
        body.startTime = exceptionStart;
        body.endTime = exceptionEnd;
      }

      const res = await fetch('/api/attendance/session-exceptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error('failed');
      }
      setNotice(t('exceptionSaved'));
      setExceptionFor(null);
      await load(date);
    } catch {
      setNotice(t('exceptionFailed'));
    } finally {
      setExceptionSaving(false);
    }
  }

  async function removeException() {
    if (!exceptionFor) {
      return;
    }
    setExceptionSaving(true);
    try {
      const res = await fetch(
        `/api/attendance/session-exceptions?classScheduleSlotId=${encodeURIComponent(exceptionFor.slotId)}&date=${encodeURIComponent(date)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        throw new Error('failed');
      }
      setNotice(t('exceptionRemoved'));
      setExceptionFor(null);
      await load(date);
    } catch {
      setNotice(t('exceptionFailed'));
    } finally {
      setExceptionSaving(false);
    }
  }

  const sessions = data?.sessions ?? [];
  const mode = data?.mode ?? 'today';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('appelTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('appelSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            aria-label={t('selectDate')}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
          />
        </div>
      </div>

      {mode === 'past' && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{t('pastDayNotice')}</p>
      )}
      {mode === 'future' && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{t('futureDayNotice')}</p>
      )}
      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      )}

      {data && (
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
            {data.counts.total} {t('sessionsCount')}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
            {data.counts.toComplete} {t('toCompleteLabel')}
          </span>
          {typeof data.counts.nonPointe === 'number' && data.counts.nonPointe > 0 && (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600">
              {data.counts.nonPointe} {t('stateNonPointeParCours')}
            </span>
          )}
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
            {data.counts.done} {t('doneLabel')}
          </span>
        </div>
      )}

      {mode === 'past' && data?.legacyRegisters && data.legacyRegisters.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t('legacyRegisterTitle')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('legacyRegisterHint')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.legacyRegisters.map((reg) => (
              <div key={reg.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{reg.className ?? t('scanUnknownClass')}</span>
                  <Link
                    href={`/${locale}/dashboard/attendance/registres?date=${encodeURIComponent(date)}&classId=${encodeURIComponent(reg.classId)}`}
                    className="text-[#2487B8] hover:underline font-semibold"
                  >
                    {t('viewInRegisters')} &rarr;
                  </Link>
                </div>
                <div className="flex gap-3 text-slate-600 font-mono text-[11px]">
                  <span className="text-emerald-700">{reg.counts.present} P</span>
                  <span className="text-amber-700">{reg.counts.late} R</span>
                  <span className="text-rose-700">{reg.counts.absent} A</span>
                  <span className="text-blue-700">{reg.counts.excused} E</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('loading')}
        </div>
      )}

      {!loading && error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {!loading && !error && sessions.length === 0 && (
        <Card className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {t('noSessionsScheduled')}
        </Card>
      )}

      <ul className="space-y-3">
        {sessions.map(session => (
          <li key={session.slotId}>
            <Card className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums text-slate-900">
                      <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                      {session.startTime}–{session.endTime}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES[session.state]}`}>
                      {t(STATE_KEYS[session.state])}
                    </span>
                  </div>

                  <p className="mt-2 truncate text-base font-semibold text-slate-900">
                    {session.subjectName ?? '—'}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>{[session.className, session.sectionName].filter(Boolean).join(' · ') || '—'}</span>
                    {session.teacherName && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                        {session.teacherName}
                      </span>
                    )}
                    {session.room && (
                      <span className="inline-flex items-center gap-1">
                        <DoorOpen className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                        {/* roomLabel is already human text ("Salle 5"), so it is
                            shown as-is rather than prefixed with a label. */}
                        {session.room}
                      </span>
                    )}
                  </div>

                  {/* What changed, and why. The times and room above are already
                      the effective ones; this names the deviation so a modified
                      lesson is never mistaken for the usual timetable. */}
                  {session.exception && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                      <span className="font-semibold">{EXCEPTION_LABEL[session.exception.type]}</span>
                      {' · '}
                      {session.exception.reason}
                      {session.exception.type === 'RESCHEDULE' && (
                        <span className="ms-1">
                          ({t('exceptionOriginalTimes')} {session.baseStartTime}–{session.baseEndTime})
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* A one-day exception is managed from the lesson itself, not
                      from a separate admin page — the admin is already looking at
                      the lesson they want to change. */}
                  {mode !== 'past' && (
                    <Button
                      variant={session.exception ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() => openException(session)}
                    >
                      <CalendarClock className="me-1 h-3.5 w-3.5" aria-hidden />
                      {t('exceptionAction')}
                    </Button>
                  )}
                  {/* Today's lessons are the operational ones. Opening one goes to
                      its roll call with the lesson already resolved, so the admin
                      never re-picks class/subject/period. */}
                  {mode === 'today' && (session.state === 'EN_COURS' || session.state === 'A_COMPLETER') && (
                    <Button asChild size="sm" className="h-8 rounded-lg">
                      <Link href={rollCallHref(session.slotId)}>{t('takeRegister')}</Link>
                    </Button>
                  )}
                  {mode === 'today' && session.state === 'POINTAGE_TERMINE' && (
                    <Button asChild variant="outline" size="sm" className="h-8 rounded-lg">
                      <Link href={rollCallHref(session.slotId)}>{t('markAttendance')}</Link>
                    </Button>
                  )}
                  {mode === 'past' && (session.state === 'A_COMPLETER' || session.state === 'NON_POINTE') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
                      onClick={() => { setLateCompleting(session); setLateReason(''); setNotice(null); }}
                    >
                      <Clock className="me-1 h-3.5 w-3.5" aria-hidden />
                      {t('completeLateBtn')}
                    </Button>
                  )}
                  {session.state === 'POINTAGE_TERMINE' && session.register && mode === 'past' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() => { setCorrecting(session); setReason(''); setNotice(null); }}
                    >
                      <RotateCcw className="me-1 h-3.5 w-3.5" aria-hidden />
                      {t('correctRegister')}
                    </Button>
                  )}
                  {session.state === 'CORRIGE' && (
                    <span className="inline-flex items-center gap-1 text-xs text-violet-700">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      {session.register?.reference}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('correctRegister')}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-base font-semibold text-slate-900">{t('correctRegister')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {correcting.subjectName} · {[correcting.className, correcting.sectionName].filter(Boolean).join(' · ')} · {correcting.startTime}–{correcting.endTime}
            </p>

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="correction-reason">
              {t('correctionReasonLabel')}
            </label>
            <textarea
              id="correction-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('correctionReasonPlaceholder')}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm text-slate-700"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => setCorrecting(null)}>
                {t('correctionCancel')}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-lg"
                disabled={saving || reason.trim().length < 3}
                onClick={() => void submitCorrection()}
              >
                {saving && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t('correctionSubmit')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {lateCompleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('completeLateTitle')}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-base font-semibold text-slate-900">{t('completeLateTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {lateCompleting.subjectName} · {[lateCompleting.className, lateCompleting.sectionName].filter(Boolean).join(' · ')} · {lateCompleting.startTime}–{lateCompleting.endTime}
            </p>

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="late-reason">
              {t('completeLateReasonLabel')}
            </label>
            <textarea
              id="late-reason"
              value={lateReason}
              onChange={e => setLateReason(e.target.value)}
              placeholder={t('completeLateReasonPlaceholder')}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm text-slate-700"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => setLateCompleting(null)}>
                {t('correctionCancel')}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-lg bg-[#2487B8] hover:bg-[#1B6C93] text-white"
                disabled={lateSaving || lateReason.trim().length < 3}
                onClick={() => void submitLateComplete()}
              >
                {lateSaving && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t('correctionSubmit')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {exceptionFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('exceptionTitle')}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-base font-semibold text-slate-900">{t('exceptionTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {exceptionFor.subjectName} · {[exceptionFor.className, exceptionFor.sectionName].filter(Boolean).join(' · ')}
              {' · '}{exceptionFor.baseStartTime}–{exceptionFor.baseEndTime}
            </p>
            <p className="mt-1 text-xs text-slate-400">{t('exceptionHint')}</p>

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="exception-type">
              {t('exceptionTypeLabel')}
            </label>
            <select
              id="exception-type"
              value={exceptionType}
              onChange={e => setExceptionType(e.target.value as ExceptionType)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
            >
              <option value="CANCELLED">{t('exceptionTypeCancel')}</option>
              <option value="SUBSTITUTE">{t('exceptionTypeSubstitute')}</option>
              <option value="ROOM_CHANGE">{t('exceptionTypeRoom')}</option>
              <option value="RESCHEDULE">{t('exceptionTypeReschedule')}</option>
            </select>

            {exceptionType === 'SUBSTITUTE' && (
              <>
                <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="exception-substitute">
                  {t('exceptionSubstituteLabel')}
                </label>
                <select
                  id="exception-substitute"
                  value={exceptionSubstitute}
                  onChange={e => setExceptionSubstitute(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="">{t('exceptionChooseTeacher')}</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name ?? teacher.id}</option>
                  ))}
                </select>
              </>
            )}

            {exceptionType === 'ROOM_CHANGE' && (
              <>
                <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="exception-room">
                  {t('exceptionRoomLabel')}
                </label>
                <input
                  id="exception-room"
                  value={exceptionRoom}
                  onChange={e => setExceptionRoom(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-700"
                />
              </>
            )}

            {exceptionType === 'RESCHEDULE' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="exception-start">
                    {t('exceptionStartLabel')}
                  </label>
                  <input
                    id="exception-start"
                    type="time"
                    value={exceptionStart}
                    onChange={e => setExceptionStart(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="exception-end">
                    {t('exceptionEndLabel')}
                  </label>
                  <input
                    id="exception-end"
                    type="time"
                    value={exceptionEnd}
                    onChange={e => setExceptionEnd(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-700"
                  />
                </div>
              </div>
            )}

            <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="exception-reason">
              {t('exceptionReasonLabel')}
            </label>
            <textarea
              id="exception-reason"
              value={exceptionReason}
              onChange={e => setExceptionReason(e.target.value)}
              placeholder={t('exceptionReasonPlaceholder')}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm text-slate-700"
            />

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {exceptionFor.exception && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-rose-700"
                  disabled={exceptionSaving}
                  onClick={() => void removeException()}
                >
                  {t('exceptionRemove')}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => setExceptionFor(null)}>
                {t('correctionCancel')}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-lg"
                disabled={exceptionSaving || exceptionReason.trim().length < 3 || (exceptionType === 'SUBSTITUTE' && !exceptionSubstitute)}
                onClick={() => void saveException()}
              >
                {exceptionSaving && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t('exceptionSave')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
