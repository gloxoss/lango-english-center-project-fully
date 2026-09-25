'use client';

import { AlertTriangle, BellRing, Clock, DoorOpen, Loader2, User } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * SUIVI & ALERTES — the operational page.
 *
 * Two questions, in the order a head of year asks them: which lessons still
 * have no register, and which students need following up. Previously these sat
 * on two separate pages (Signalements and Audit & Alertes) that each answered
 * half of it, so answering both meant visiting both and reconciling by hand.
 *
 * Nothing here is a new data source: the register list is the exact-session
 * answer from audit-summary, and the alerts are the detector's own rows. The
 * duplication the two old pages carried is gone, not re-implemented.
 */

type MissingRegister = {
  id: string;
  startTime: string;
  endTime: string;
  subjectName: string | null;
  className: string | null;
  sectionName: string | null;
  teacherName: string | null;
  room: string | null;
};

type Flag = {
  id: string;
  studentName: string | null;
  type: string;
  status: string;
  severity: string;
  assignedToName: string | null;
  detectedAt: string;
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITIQUE: 'bg-rose-50 text-rose-700 border-rose-200',
  ELEVE: 'bg-amber-50 text-amber-800 border-amber-200',
  MOYEN: 'bg-slate-100 text-slate-700 border-slate-200',
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-800 border-amber-200',
  ACKNOWLEDGED: 'bg-sky-50 text-sky-700 border-sky-200',
  CONTACTED: 'bg-violet-50 text-violet-700 border-violet-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISMISSED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function SuiviAlertesView() {
  const t = useTranslations('Attendance');
  const locale = useLocale();
  const [missing, setMissing] = useState<MissingRegister[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, flagsRes] = await Promise.all([
        fetch('/api/attendance/audit-summary'),
        // Open work only: a resolved case is history, not a task.
        fetch('/api/attendance/flags?status=OPEN&status=ACKNOWLEDGED&status=CONTACTED&pageSize=100'),
      ]);
      const summary = await summaryRes.json();
      const flagsJson = await flagsRes.json();
      setMissing(summary?.data?.missingRegistersToday ?? []);
      setFlags(Array.isArray(flagsJson?.data) ? flagsJson.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function sendReminder(slotId: string) {
    setSendingId(slotId);
    try {
      const res = await fetch('/api/attendance/audit-summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classScheduleSlotId: slotId }),
      });
      if (res.ok) {
        setSentIds(prev => new Set(prev).add(slotId));
      }
    } finally {
      setSendingId(null);
    }
  }

  const flagLabel = (type: string) => {
    if (type === 'UNJUSTIFIED_ABSENCE') {
      return t('flagUnjustifiedAbsence');
    }
    if (type === 'CONSECUTIVE_ABSENCE') {
      return t('flagConsecutiveAbsence');
    }
    return t('flagRepeatedLate');
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('suiviTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('suiviSubtitle')}</p>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock className="h-4 w-4 text-slate-400" aria-hidden />
          {t('suiviRegistersHeading')}
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-normal text-slate-500">
            {missing.length}
          </span>
        </h2>

        {missing.length === 0
          ? <Card className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{t('noMissingRegisters')}</Card>
          : (
              <ul className="space-y-2">
                {missing.map(slot => (
                  <li key={slot.id}>
                    <Card className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <span className="text-sm font-medium tabular-nums text-slate-900">{slot.startTime}–{slot.endTime}</span>
                        <span className="ms-2 text-sm font-semibold text-slate-900">{slot.subjectName ?? '—'}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                          <span>{[slot.className, slot.sectionName].filter(Boolean).join(' · ') || '—'}</span>
                          {slot.teacherName && (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                              {slot.teacherName}
                            </span>
                          )}
                          {slot.room && (
                            <span className="inline-flex items-center gap-1">
                              <DoorOpen className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                              {slot.room}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 rounded-lg"
                        disabled={sendingId === slot.id || sentIds.has(slot.id)}
                        onClick={() => void sendReminder(slot.id)}
                      >
                        {sentIds.has(slot.id) ? t('reminderSent') : t('sendReminderBtn')}
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <BellRing className="h-4 w-4 text-slate-400" aria-hidden />
          {t('suiviAlertsHeading')}
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-normal text-slate-500">
            {flags.length}
          </span>
        </h2>

        {flags.length === 0
          ? <Card className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{t('suiviNoAlerts')}</Card>
          : (
              <ul className="space-y-2">
                {flags.map(flag => (
                  <li key={flag.id}>
                    <Link
                      href={`/${locale}/dashboard/attendance/flags/${flag.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                        <span className="text-sm font-semibold text-slate-900">{flag.studentName ?? '—'}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${SEVERITY_STYLE[flag.severity] ?? SEVERITY_STYLE.MOYEN}`}>
                          {flagLabel(flag.type)}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[flag.status] ?? STATUS_STYLE.OPEN}`}>
                          {flag.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
                        {flag.assignedToName
                          ? <span>{t('staffAssigned')}: {flag.assignedToName}</span>
                          : <span className="text-slate-400">—</span>}
                        <span className="ms-auto text-xs text-slate-400">{t('suiviOpenHint')}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
      </section>
    </div>
  );
}
