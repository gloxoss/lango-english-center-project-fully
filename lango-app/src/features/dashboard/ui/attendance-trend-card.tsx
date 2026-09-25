'use client';

import type { AttendanceDayPoint, AttendanceTrendData } from '../model/types';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import React from 'react';
import { formatPercentage } from '../model/formatters';

type AttendanceTrendCardProps = {
  data: AttendanceTrendData;
  locale: string;
};

function dayStateLabel(
  d: AttendanceDayPoint,
  t: ReturnType<typeof useTranslations<'Dashboard'>>,
): { text: string; tone: 'rate' | 'muted' | 'warning' } {
  // Real states only: complete days show their rate, no-class days say so,
  // and a scheduled day without finished marking says "pointage incomplet"
  // instead of a meaningless dash (ENH-ADMIN-DASH-01).
  if (d.completionState === 'no_class') {
    return { text: t('noClassDay'), tone: 'muted' };
  }
  if (d.completionState === 'complete' && d.studentRate !== null) {
    return { text: formatPercentage(d.studentRate), tone: 'rate' };
  }
  return { text: t('markingIncompleteDay'), tone: 'warning' };
}

export function AttendanceTrendCard({ data, locale }: AttendanceTrendCardProps) {
  const t = useTranslations('Dashboard');
  const th = useTranslations('DashboardHome');
  const {
    weeklyAverageRate,
    days,
    classesBelowThresholdCount,
    daysBelowThresholdCount,
    thresholdPercent,
    weekUnjustifiedCount,
    weekLateCount,
    todayMissingClasses,
  } = data;

  const opsFacts: Array<{ key: string; count: number; tone: 'warning' | 'neutral' }> = [];
  if (weekUnjustifiedCount > 0) {
    opsFacts.push({ key: th('weekUnjustified', { count: weekUnjustifiedCount }), count: weekUnjustifiedCount, tone: 'warning' });
  }
  if (weekLateCount > 0) {
    opsFacts.push({ key: th('weekLate', { count: weekLateCount }), count: weekLateCount, tone: 'neutral' });
  }
  if (todayMissingClasses > 0) {
    opsFacts.push({ key: th('todayMissingClasses', { count: todayMissingClasses }), count: todayMissingClasses, tone: 'warning' });
  }

  return (
    <div className="
      flex h-full flex-col justify-between rounded-2xl border
      border-slate-200/80 bg-white p-4 shadow-2xs
      sm:p-5
    "
    >
      <div>
        {/* Header */}
        <div className="
          flex items-center justify-between border-b border-slate-100 pb-3
        "
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                {th('attendanceTitle')}
              </h3>
              {weeklyAverageRate !== null && (
                <span className={`
                  rounded-full px-2 py-0.5 text-[11px] font-extrabold
                  ${
                weeklyAverageRate >= thresholdPercent
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
                }
                `}
                >
                  {th('attendanceAverage', { rate: formatPercentage(weeklyAverageRate) })}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {th('attendanceSubtitle')}
            </p>
          </div>
          <Link
            href={`/${locale}/dashboard/attendance`}
            className="
              flex items-center gap-1 text-xs font-bold text-blue-600 transition
              hover:text-blue-800 hover:underline
            "
          >
            <span>{th('seeAttendance')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Weekly Day Bars */}
        <div className="my-5 grid grid-cols-6 gap-2">
          {days.map((d) => {
            const state = dayStateLabel(d, t);
            const hasData = d.completionState === 'complete' && d.studentRate !== null;
            const rate = d.studentRate ?? 0;
            const isGood = rate >= thresholdPercent;

            return (
              <div
                key={d.date}
                className={`
                  flex flex-col items-center justify-between rounded-xl border
                  p-2.5 transition
                  ${
              d.isToday
                ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-500/20'
                : `
                  border-slate-100 bg-slate-50/70
                  hover:bg-slate-50
                `
              }
                `}
              >
                <div className="text-center">
                  <span className="text-[11px] font-bold text-slate-500">{d.dayLabel}</span>
                  <p className="text-[10px] font-medium text-slate-400">{d.date}</p>
                </div>

                <div className="my-3 flex h-24 w-full items-end justify-center">
                  {hasData
                    ? (
                        <div
                          style={{ height: `${Math.max(10, rate)}%` }}
                          className={`
                            w-full max-w-[20px] rounded-t-sm transition-all
                            duration-300
                            ${
                        isGood ? 'bg-emerald-500' : 'bg-amber-500'
                        }
                          `}
                        />
                      )
                    : state.tone === 'warning'
                      ? (
                          <div className="flex size-full max-w-[20px] items-end">
                            <div className="
                              h-6 w-full rounded-t-sm bg-linear-to-t
                              from-amber-200 to-amber-100
                            "
                            />
                          </div>
                        )
                      : (
                          <div className="
                            h-1 w-full max-w-[20px] rounded-full bg-slate-200
                          "
                          />
                        )}
                </div>

                <div className="
                  flex min-h-5 items-center justify-center text-center
                "
                >
                  <span
                    className={`
                      ${
              state.tone === 'rate'
                ? `
                  text-xs font-extrabold
                  ${isGood
                ? 'text-emerald-700'
                : `text-amber-700`}
                `
                : state.tone === 'warning'
                  ? 'text-[9px] leading-tight font-bold text-amber-600'
                  : `text-[10px] leading-tight font-semibold text-slate-400`
              }
                    `}
                  >
                    {state.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operational footer: only facts the data backs */}
      {opsFacts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {opsFacts.map(f => (
            <span
              key={f.key}
              className={`
                inline-flex items-center gap-1 rounded-full px-2.5 py-1
                text-[11px] font-bold
                ${
            f.tone === 'warning'
              ? 'border border-amber-200 bg-amber-50 text-amber-800'
              : 'border border-slate-200 bg-slate-50 text-slate-600'
            }
              `}
            >
              <Clock className="size-3" />
              {f.key}
            </span>
          ))}
        </div>
      )}

      {/* Contextual Alert Banner (Clearly Scoped Invariants) */}
      <div className="border-t border-slate-100 pt-3">
        {classesBelowThresholdCount > 0
          ? (
              <div className="
                flex items-center justify-between gap-2 rounded-xl border
                border-amber-200 bg-amber-50 p-3 text-xs text-amber-800
              "
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                  <span>
                    <strong className="font-bold">{th('classesCount', { count: classesBelowThresholdCount })}</strong>
                    {' '}
                    {th('classesBelowThreshold', { count: classesBelowThresholdCount, threshold: thresholdPercent })}
                  </span>
                </div>
                <Link
                  href={`/${locale}/dashboard/academics/classes`}
                  className="
                    shrink-0 font-extrabold text-amber-900 underline
                    hover:text-amber-950
                  "
                >
                  {th('seeClasses')}
                </Link>
              </div>
            )
          : weeklyAverageRate !== null && weeklyAverageRate < thresholdPercent
            ? (
                <div className="
                  flex items-center justify-between gap-2 rounded-xl border
                  border-amber-200 bg-amber-50 p-3 text-xs text-amber-800
                "
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                    <span>
                      <strong className="font-bold">{th('weeklyAverage', { rate: formatPercentage(weeklyAverageRate) })}</strong>
                      {' '}
                      {th('belowAlertThreshold', { threshold: thresholdPercent })}
                    </span>
                  </div>
                  <Link
                    href={`/${locale}/dashboard/attendance`}
                    className="
                      shrink-0 font-extrabold text-amber-900 underline
                      hover:text-amber-950
                    "
                  >
                    {th('seeAttendance')}
                  </Link>
                </div>
              )
            : daysBelowThresholdCount > 0
              ? (
                  <div className="
                    flex items-center justify-between gap-2 rounded-xl border
                    border-amber-200 bg-amber-50 p-3 text-xs text-amber-800
                  "
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                      <span>
                        <strong className="font-bold">{th('daysCount', { count: daysBelowThresholdCount })}</strong>
                        {' '}
                        {th('daysBelowThreshold', { threshold: thresholdPercent })}
                      </span>
                    </div>
                    <Link
                      href={`/${locale}/dashboard/attendance`}
                      className="
                        shrink-0 font-extrabold text-amber-900 underline
                        hover:text-amber-950
                      "
                    >
                      {th('seeAttendance')}
                    </Link>
                  </div>
                )
              : weeklyAverageRate !== null
                ? (
                    <div className="
                      flex items-center gap-2 rounded-xl border
                      border-emerald-100 bg-emerald-50/50 p-3 text-xs
                      text-emerald-800
                    "
                    >
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      <span>{th('allClassesAboveThreshold', { threshold: thresholdPercent })}</span>
                    </div>
                  )
                : (
                    <div className="
                      flex items-center gap-2 rounded-xl border border-slate-100
                      bg-slate-50/50 p-3 text-xs text-slate-500
                    "
                    >
                      <span>{th('noSessionsThisWeek')}</span>
                    </div>
                  )}
      </div>
    </div>
  );
}
