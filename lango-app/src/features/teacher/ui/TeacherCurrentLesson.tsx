'use client';

import { CalendarClock, CheckSquare, Clock, DoorOpen, Loader2, QrCode, Users } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * VOTRE COURS ACTUEL — the teacher's entry point.
 *
 * No class, subject or period picker: the lesson is resolved from the published
 * timetable and the current time, server-side, against the session user. The
 * teacher either has a lesson to take now, or they do not.
 */

type ScheduleItem = {
  slotId: string;
  startTime: string;
  endTime: string;
  subjectName: string | null;
  className: string | null;
  sectionName: string | null;
  room: string | null;
  window: 'BEFORE' | 'OPEN' | 'CLOSED';
  register: { id: string; status: string; reference: string } | null;
};

type LessonNow = ScheduleItem & { studentCount: number };

type Payload = {
  date: string;
  currentLesson: LessonNow | null;
  nextLesson: ScheduleItem | null;
  schedule: ScheduleItem[];
};

function LessonLine({ item }: { item: ScheduleItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
      <span className="inline-flex items-center gap-1 tabular-nums">
        <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        {item.startTime}–{item.endTime}
      </span>
      <span>{[item.className, item.sectionName].filter(Boolean).join(' · ') || '—'}</span>
      {item.room && (
        <span className="inline-flex items-center gap-1">
          <DoorOpen className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          {item.room}
        </span>
      )}
    </div>
  );
}

export function TeacherCurrentLesson() {
  const t = useTranslations('Attendance');
  const locale = useLocale();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/me/current-lesson');
      const json = await res.json();
      if (json?.success) {
        setData(json.data as Payload);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <Card className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('loading')}
      </Card>
    );
  }

  const current = data?.currentLesson ?? null;
  const next = data?.nextLesson ?? null;
  const schedule = data?.schedule ?? [];

  const rollCallHref = (slotId: string, mode?: 'scan' | 'manual') =>
    `/${locale}/dashboard/attendance?slot=${encodeURIComponent(slotId)}&date=${encodeURIComponent(data?.date ?? '')}${mode ? `&mode=${mode}` : ''}`;

  if (current) {
    const windowMessage = current.window === 'OPEN'
      ? t('teacherWindowOpen')
      : current.window === 'BEFORE'
        ? t('teacherWindowBefore')
        : t('teacherWindowClosed');

    return (
      <Card className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0B6FA4]">{t('teacherCurrentLesson')}</p>

        <h2 className="mt-2 text-xl font-semibold text-slate-900">{current.subjectName ?? '—'}</h2>
        <div className="mt-1">
          <LessonLine item={current} />
        </div>

        <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600">
          <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          {current.studentCount} {t('studentsCount')}
        </p>

        <p className={`mt-3 text-sm ${current.window === 'OPEN' ? 'text-emerald-700' : 'text-amber-700'}`}>
          {windowMessage}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {current.window === 'OPEN' ? (
            <>
              <Button asChild size="sm" className="h-9 gap-1.5 rounded-lg bg-[#0B6FA4] text-white hover:bg-[#095783]">
                <Link href={rollCallHref(current.slotId, 'scan')}>
                  <QrCode className="h-4 w-4" aria-hidden />
                  {t('scanBadgesButton')}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-50">
                <Link href={rollCallHref(current.slotId, 'manual')}>
                  <CheckSquare className="h-4 w-4" aria-hidden />
                  {t('manualRollCallButton')}
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" className="h-9 gap-1.5 rounded-lg" disabled>
                <QrCode className="h-4 w-4" aria-hidden />
                {t('scanBadgesButton')}
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-lg border-slate-200 text-slate-400" disabled>
                <CheckSquare className="h-4 w-4" aria-hidden />
                {t('manualRollCallButton')}
              </Button>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('teacherCurrentLesson')}</p>
        <p className="mt-2 text-base text-slate-700">{t('teacherNoLesson')}</p>

        {next && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {t('teacherNextLesson')}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{next.subjectName ?? '—'}</p>
            <LessonLine item={next} />
          </div>
        )}
      </Card>

      {schedule.length > 0 && (
        <Card className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('teacherTodaySchedule')}</p>
          <ul className="mt-3 space-y-3">
            {schedule.map(item => (
              <li key={item.slotId} className="border-s-2 border-slate-100 ps-3">
                <p className="text-sm font-medium text-slate-900">{item.subjectName ?? '—'}</p>
                <LessonLine item={item} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
