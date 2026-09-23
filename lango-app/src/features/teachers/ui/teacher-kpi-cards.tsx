'use client';

import type { TeacherDirectorySummary } from '../model/types';
import { AlertCircle, Calendar, Clock, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/**
 * Four KPI cards backed by the server-side summary (never by the current page
 * or the current search filter):
 *   1. Enseignants actifs
 *   2. Charge moyenne planifiée (published timetable; explicit "no timetable"
 *      state instead of a misleading 0h)
 *   3. Dossiers à compléter (computed completeness rule)
 *   4. En congé (HR employmentStatus = on_leave only — never fabricated)
 */
export function TeacherKpiCards({
  summary,
  loading,
}: {
  summary: TeacherDirectorySummary | null;
  loading: boolean;
}) {
  const t = useTranslations('Teachers');

  if (loading || !summary) {
    return (
      <div
        className="
          grid grid-cols-1 gap-4
          sm:grid-cols-2
          lg:grid-cols-4
        "
        aria-busy="true"
      >
        {[0, 1, 2, 3].map(i => (
          <Card
            key={i}
            className="
              flex items-center justify-between rounded-2xl border
              border-slate-200/80 bg-white p-5 shadow-2xs
            "
          >
            <div className="w-full space-y-2">
              <Skeleton className="h-3 w-28 bg-slate-200/70" />
              <Skeleton className="h-7 w-16 bg-slate-200/70" />
              <Skeleton className="h-3 w-24 bg-slate-200/70" />
            </div>
            <Skeleton className="size-10 rounded-full bg-slate-200/70" />
          </Card>
        ))}
      </div>
    );
  }

  // A dash (not a truncated sentence) when there is no published timetable;
  // the sub-line states why, in full.
  const workloadValue = summary.workload.hasTimetable
    ? t('hoursPerWeek', { hours: formatHours(summary.workload.averageWeeklyHours ?? 0) })
    : '—';
  const workloadSub = summary.workload.hasTimetable
    ? t('scheduledTeachersCount', { count: summary.workload.scheduledTeachers })
    : t('noPlannedWorkload');

  const cards = [
    {
      label: t('activeTeachers'),
      value: String(summary.activeTeachers),
      sub: t('ofTotalTeachers', { count: summary.scopedTeachers }),
      color: 'text-emerald-600',
      icon: Users,
      iconBg: 'bg-[#DCEBF4]',
      iconColor: 'text-[#1B6C93]',
    },
    {
      label: t('averageWorkloadPlanned'),
      value: workloadValue,
      sub: workloadSub,
      color: 'text-blue-600',
      icon: Clock,
      iconBg: 'bg-[#DCEBF4]',
      iconColor: 'text-[#1B6C93]',
    },
    {
      label: t('dossiersToComplete'),
      value: String(summary.dossiers.toComplete),
      sub: t('dossiersCompleteCount', { count: summary.dossiers.complete }),
      color: 'text-amber-600',
      icon: AlertCircle,
      iconBg: 'bg-[#FCF0DC]',
      iconColor: 'text-[#E8A33D]',
    },
    {
      label: t('onLeave'),
      value: String(summary.onLeave),
      sub: t('onLeaveHint'),
      color: 'text-rose-600',
      icon: Calendar,
      iconBg: 'bg-[#FCE4E2]',
      iconColor: 'text-[#E5544B]',
    },
  ];

  return (
    <div className="
      grid grid-cols-1 gap-4
      sm:grid-cols-2
      lg:grid-cols-4
    "
    >
      {cards.map(card => (
        <Card
          key={card.label}
          className="
            flex items-center justify-between rounded-2xl border
            border-slate-200/80 bg-white p-5 shadow-2xs
          "
        >
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-bold text-slate-500">{card.label}</p>
            <p className="truncate text-2xl font-extrabold text-[#16212B]" title={card.value}>{card.value}</p>
            <p className={`
              text-[11px] font-bold
              ${card.color}
            `}
            >
              {card.sub}
            </p>
          </div>
          <div className={`
            flex size-10 shrink-0 items-center justify-center rounded-full
            ${card.iconBg}
            ${card.iconColor}
          `}
          >
            <card.icon className="size-5" />
          </div>
        </Card>
      ))}
    </div>
  );
}
