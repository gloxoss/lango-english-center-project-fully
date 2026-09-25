'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AttendanceTrendData } from '../model/types';
import { formatPercentage } from '../model/formatters';

interface AttendanceTrendCardProps {
  data: AttendanceTrendData;
  locale: string;
}

export function AttendanceTrendCard({ data, locale }: AttendanceTrendCardProps) {
  const t = useTranslations('Dashboard');
  const th = useTranslations('DashboardHome');
  const { weeklyAverageRate, days, classesBelowThresholdCount, daysBelowThresholdCount, thresholdPercent } = data;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                {th('attendanceTitle')}
              </h3>
              {weeklyAverageRate !== null && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                  weeklyAverageRate >= thresholdPercent
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  {th('attendanceAverage', { rate: formatPercentage(weeklyAverageRate) })}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              {th('attendanceSubtitle')}
            </p>
          </div>
          <Link
            href={`/${locale}/dashboard/attendance`}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
          >
            <span>{th('seeAttendance')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Weekly Day Bars */}
        <div className="my-5 grid grid-cols-6 gap-2">
          {days.map(d => {
            const hasData = d.studentRate !== null;
            const rate = d.studentRate ?? 0;
            const isGood = rate >= thresholdPercent;

            return (
              <div
                key={d.date}
                className={`flex flex-col items-center justify-between rounded-xl border p-2.5 transition ${
                  d.isToday
                    ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-500/20'
                    : 'border-slate-100 bg-slate-50/70 hover:bg-slate-50'
                }`}
              >
                <div className="text-center">
                  <span className="text-[11px] font-bold text-slate-500">{d.dayLabel}</span>
                  <p className="text-[10px] text-slate-400 font-medium">{d.date}</p>
                </div>

                <div className="my-3 flex h-24 w-full items-end justify-center">
                  {hasData ? (
                    <div
                      style={{ height: `${Math.max(10, rate)}%` }}
                      className={`w-full max-w-[20px] rounded-t-sm transition-all duration-300 ${
                        isGood ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  ) : (
                    <div className="h-1 w-full max-w-[20px] rounded-full bg-slate-200" />
                  )}
                </div>

                <div className="text-center min-h-[1.25rem] flex items-center justify-center">
                  <span
                    className={`text-xs font-extrabold ${
                      hasData
                        ? isGood
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                        : d.isNonInstructional
                          ? 'text-[10px] font-semibold text-slate-400 leading-tight'
                          : 'text-slate-400'
                    }`}
                  >
                    {hasData
                      ? formatPercentage(d.studentRate)
                      : d.isNonInstructional
                        ? t('noClassDay')
                        : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contextual Alert Banner (Clearly Scoped Invariants) */}
      <div className="border-t border-slate-100 pt-3">
        {classesBelowThresholdCount > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <span>
                <strong className="font-bold">{th('classesCount', { count: classesBelowThresholdCount })}</strong> {th('classesBelowThreshold', { count: classesBelowThresholdCount, threshold: thresholdPercent })}
              </span>
            </div>
            <Link
              href={`/${locale}/dashboard/academics/classes`}
              className="shrink-0 font-extrabold text-amber-900 underline hover:text-amber-950"
            >
              {th('seeClasses')}
            </Link>
          </div>
        ) : weeklyAverageRate !== null && weeklyAverageRate < thresholdPercent ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <span>
                <strong className="font-bold">{th('weeklyAverage', { rate: formatPercentage(weeklyAverageRate) })}</strong> {th('belowAlertThreshold', { threshold: thresholdPercent })}
              </span>
            </div>
            <Link
              href={`/${locale}/dashboard/attendance`}
              className="shrink-0 font-extrabold text-amber-900 underline hover:text-amber-950"
            >
              {th('seeAttendance')}
            </Link>
          </div>
        ) : daysBelowThresholdCount > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <span>
                <strong className="font-bold">{th('daysCount', { count: daysBelowThresholdCount })}</strong> {th('daysBelowThreshold', { threshold: thresholdPercent })}
              </span>
            </div>
            <Link
              href={`/${locale}/dashboard/attendance`}
              className="shrink-0 font-extrabold text-amber-900 underline hover:text-amber-950"
            >
              {th('seeAttendance')}
            </Link>
          </div>
        ) : weeklyAverageRate !== null ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{th('allClassesAboveThreshold', { threshold: thresholdPercent })}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-500">
            <span>{th('noSessionsThisWeek')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
