'use client';

import { CalendarDays, CheckCircle2, Clock, DoorOpen, Loader2, RotateCcw, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
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

type SessionState = 'A_VENIR' | 'EN_COURS' | 'A_COMPLETER' | 'POINTAGE_TERMINE' | 'CORRIGE' | 'ANNULE';

type Register = { id: string; status: string; reference: string } | null;

type DaySession = {
  slotId: string;
  startTime: string;
  endTime: string;
  subjectName: string | null;
  className: string | null;
  sectionName: string | null;
  teacherName: string | null;
  room: string | null;
  period: number;
  state: SessionState;
  register: Register;
};

type DayData = {
  date: string;
  businessDate: string;
  mode: 'past' | 'today' | 'future';
  sessions: DaySession[];
  counts: { total: number; toComplete: number; done: number };
};

const STATE_STYLES: Record<SessionState, string> = {
  A_VENIR: 'bg-slate-100 text-slate-700 border-slate-200',
  EN_COURS: 'bg-sky-50 text-sky-800 border-sky-200',
  A_COMPLETER: 'bg-amber-50 text-amber-800 border-amber-200',
  POINTAGE_TERMINE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CORRIGE: 'bg-violet-50 text-violet-800 border-violet-200',
  ANNULE: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATE_KEYS: Record<SessionState, string> = {
  A_VENIR: 'stateUpcoming',
  EN_COURS: 'stateOngoing',
  A_COMPLETER: 'stateToComplete',
  POINTAGE_TERMINE: 'stateDone',
  CORRIGE: 'stateCorrected',
  ANNULE: 'stateCancelled',
};

export function AppelDuJourView() {
  const t = useTranslations('Attendance');
  const [date, setDate] = useState(casablancaTodayIso());
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<DaySession | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
            {data.counts.done} {t('doneLabel')}
          </span>
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
                        {t('roomLabel')} {session.room}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
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
    </div>
  );
}
