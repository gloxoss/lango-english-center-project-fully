'use client';

import type { DailyPulseData } from '../model/types';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  GraduationCap,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import React from 'react';
import { formatMad } from '../model/formatters';

type DailyPulseKpiProps = {
  data: DailyPulseData;
  locale: string;
};

export function DailyPulseKpi({ data, locale }: DailyPulseKpiProps) {
  const t = useTranslations('Dashboard');
  const th = useTranslations('DashboardHome');
  const { activeStudents, attendanceToday, periodCollected, periodOverdue } = data;

  // Enrollment-date-backed delta only: a count equal to the whole roster
  // (e.g. seeded yesterday) is technically true but operationally meaningless,
  // so the comparison is omitted instead of shouting "+200 inscriptions".
  const newStudentsMeaningful
    = activeStudents.newRegistrationsThisMonth > 0
      && activeStudents.newRegistrationsThisMonth < activeStudents.count;

  // Honest month-over-month cash delta; omitted when there is no prior-month
  // baseline (never a recovery percentage against unrelated invoicing).
  const prev = periodCollected.previousMonthCollected;
  const cashDeltaPercent = prev !== null && prev > 0
    ? Math.round(((periodCollected.amount - prev) / prev) * 100)
    : null;

  const markingIncomplete
    = attendanceToday.status === 'warning'
      && attendanceToday.rate === null;
  const markedSections = Math.max(0, attendanceToday.expectedClasses - attendanceToday.missingClasses);

  return (
    <section
      aria-label={th('kpiAria')}
      className="
        grid grid-cols-1 gap-3
        sm:grid-cols-2 sm:gap-4
        lg:grid-cols-4
      "
    >
      {/* 1. ÉLÈVES ACTIFS */}
      <Link
        href={`/${locale}/dashboard/students`}
        className="
          group relative flex flex-col justify-between rounded-2xl border
          border-slate-200/80 bg-white p-4 shadow-2xs transition-all
          duration-200
          hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xs
          sm:p-5
        "
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-500">{th('kpiActiveStudents')}</span>
          <div className="
            flex size-9 items-center justify-center rounded-xl bg-blue-50
            text-blue-600 transition
            group-hover:bg-blue-600 group-hover:text-white
          "
          >
            <GraduationCap className="size-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold tracking-tight text-slate-900">
            {activeStudents.count.toLocaleString('fr-FR')}
          </div>
          {newStudentsMeaningful
            ? (
                <div className="
                  mt-1 flex items-center gap-1.5 text-xs font-semibold
                  text-emerald-600
                "
                >
                  <TrendingUp className="size-3.5" />
                  <span>{th('kpiNewSinceMonthStart', { count: activeStudents.newRegistrationsThisMonth })}</span>
                </div>
              )
            : (
                <div className="mt-1 h-4" />
              )}
        </div>
        <div className="
          mt-3 flex items-center justify-between border-t border-slate-100 pt-2
          text-[11px] font-bold text-slate-400
          group-hover:text-blue-600
        "
        >
          <span>{th('kpiViewRoster')}</span>
          <ArrowUpRight className="
            size-3 transition
            group-hover:translate-x-0.5 group-hover:-translate-y-0.5
          "
          />
        </div>
      </Link>

      {/* 2. PRÉSENCE AUJOURD'HUI */}
      <Link
        href={`/${locale}/dashboard/attendance`}
        className="
          group relative flex flex-col justify-between rounded-2xl border
          border-slate-200/80 bg-white p-4 shadow-2xs transition-all
          duration-200
          hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-xs
          sm:p-5
        "
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-500">{th('kpiAttendanceToday')}</span>
          <div className="
            flex size-9 items-center justify-center rounded-xl bg-emerald-50
            text-emerald-600 transition
            group-hover:bg-emerald-600 group-hover:text-white
          "
          >
            <CalendarCheck className="size-4.5" />
          </div>
        </div>
        <div className="mt-3">
          {markingIncomplete
            ? (
                <>
                  <div className="
                    text-xl font-extrabold tracking-tight text-amber-600
                  "
                  >
                    {th('kpiMarkingIncomplete')}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {th('kpiSectionsMarkedOf', { done: markedSections, total: attendanceToday.expectedClasses })}
                  </div>
                </>
              )
            : (
                <>
                  <div className="
                    text-3xl font-extrabold tracking-tight text-slate-900
                  "
                  >
                    {attendanceToday.rate !== null ? `${attendanceToday.rate}%` : '—'}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-500">
                    {attendanceToday.markedCount > 0
                      ? (
                          <span>
                            <strong className="font-bold text-slate-700">{attendanceToday.presentCount}</strong>
                            {' '}
                            {th('kpiPresentOfMarked', { marked: attendanceToday.markedCount })}
                          </span>
                        )
                      : attendanceToday.status === 'no_school'
                        ? (
                            <span className="text-slate-400">{th('kpiNoSchool')}</span>
                          )
                        : (
                            <span className="font-semibold text-amber-600">{th('kpiMarkingPending')}</span>
                          )}
                  </div>
                </>
              )}
        </div>
        <div className="
          mt-3 flex items-center justify-between border-t border-slate-100 pt-2
          text-[11px] font-bold text-slate-400
          group-hover:text-emerald-600
        "
        >
          <span>{th('kpiFollowAttendance')}</span>
          <ArrowUpRight className="
            size-3 transition
            group-hover:translate-x-0.5 group-hover:-translate-y-0.5
          "
          />
        </div>
      </Link>

      {/* 3. ENCAISSEMENTS REÇUS CE MOIS */}
      <Link
        href={`/${locale}/dashboard/finance/receipts`}
        className="
          group relative flex flex-col justify-between rounded-2xl border
          border-slate-200/80 bg-white p-4 shadow-2xs transition-all
          duration-200
          hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xs
          sm:p-5
        "
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-500">{th('kpiCashReceivedMonth')}</span>
          <div className="
            flex size-9 items-center justify-center rounded-xl bg-blue-50
            text-blue-600 transition
            group-hover:bg-blue-600 group-hover:text-white
          "
          >
            <Wallet className="size-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">
            {formatMad(periodCollected.amount)}
          </div>
          {cashDeltaPercent !== null
            ? (
                <div className={`
                  mt-1 flex items-center gap-1.5 text-xs font-semibold
                  ${cashDeltaPercent >= 0
                  ? `text-emerald-600`
                  : `text-slate-500`}
                `}
                >
                  {cashDeltaPercent >= 0
                    ? <TrendingUp className="size-3.5" />
                    : (
                        <TrendingDown className="size-3.5" />
                      )}
                  <span>{th('kpiVsPrevMonth', { percent: Math.abs(cashDeltaPercent) })}</span>
                </div>
              )
            : (
                <div className="mt-1 h-4" />
              )}
        </div>
        <div className="
          mt-3 flex items-center justify-between border-t border-slate-100 pt-2
          text-[11px] font-bold text-slate-400
          group-hover:text-blue-600
        "
        >
          <span>{th('kpiCollectionsJournal')}</span>
          <ArrowUpRight className="
            size-3 transition
            group-hover:translate-x-0.5 group-hover:-translate-y-0.5
          "
          />
        </div>
      </Link>

      {/* 4. IMPAYÉS ÉCHUS */}
      <Link
        href={`/${locale}/dashboard/finance/invoices`}
        className="
          group relative flex flex-col justify-between rounded-2xl border
          border-slate-200/80 bg-white p-4 shadow-2xs transition-all
          duration-200
          hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-xs
          sm:p-5
        "
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-500">{t('kpiOverdueTitle')}</span>
          <div className="
            flex size-9 items-center justify-center rounded-xl bg-rose-50
            text-rose-600 transition
            group-hover:bg-rose-600 group-hover:text-white
          "
          >
            <AlertTriangle className="size-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">
            {formatMad(periodOverdue.amount)}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            <strong className="font-bold text-slate-700">{periodOverdue.invoiceCount}</strong>
            {' '}
            {t('kpiOverdueInvoices', { count: periodOverdue.invoiceCount })}
            {' '}
            ·
            {' '}
            <strong className="font-bold text-slate-700">{periodOverdue.familiesCount}</strong>
            {' '}
            {t('kpiOverdueFamilies', { count: periodOverdue.familiesCount })}
          </div>
        </div>
        <div className="
          mt-3 flex items-center justify-between border-t border-slate-100 pt-2
          text-[11px] font-bold text-slate-400
          group-hover:text-rose-600
        "
        >
          <span>{t('kpiOverdueCta')}</span>
          <ArrowUpRight className="
            size-3 transition
            group-hover:translate-x-0.5 group-hover:-translate-y-0.5
          "
          />
        </div>
      </Link>
    </section>
  );
}
