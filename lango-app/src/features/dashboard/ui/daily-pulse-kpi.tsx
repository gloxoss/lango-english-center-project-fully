'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  GraduationCap,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DailyPulseData } from '../model/types';
import { formatMad } from '../model/formatters';

interface DailyPulseKpiProps {
  data: DailyPulseData;
  locale: string;
}

export function DailyPulseKpi({ data, locale }: DailyPulseKpiProps) {
  const t = useTranslations('Dashboard');
  const th = useTranslations('DashboardHome');
  const { activeStudents, attendanceToday, periodCollected, periodOverdue } = data;

  return (
    <section aria-label={th('kpiAria')} className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. ÉLÈVES ACTIFS */}
      <Link
        href={`/${locale}/dashboard/students`}
        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xs"
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-500">{th('kpiActiveStudents')}</span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
            <GraduationCap className="size-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold tracking-tight text-slate-900">
            {activeStudents.count.toLocaleString('fr-FR')}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <TrendingUp className="size-3.5" />
            <span>{th('kpiNewThisMonth', { count: activeStudents.newRegistrationsThisMonth })}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400 group-hover:text-blue-600">
          <span>{th('kpiViewRoster')}</span>
          <ArrowUpRight className="size-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </Link>

      {/* 2. PRÉSENCE AUJOURD'HUI */}
      <Link
        href={`/${locale}/dashboard/attendance`}
        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-xs"
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-500">{th('kpiAttendanceToday')}</span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
            <CalendarCheck className="size-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold tracking-tight text-slate-900">
            {attendanceToday.rate !== null ? `${attendanceToday.rate}%` : '—'}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            {attendanceToday.markedCount > 0 ? (
              <span>
                <strong className="font-bold text-slate-700">{attendanceToday.presentCount}</strong> {th('kpiPresentOfMarked', { marked: attendanceToday.markedCount })}
              </span>
            ) : attendanceToday.status === 'no_school' ? (
              <span className="text-slate-400">{th('kpiNoSchool')}</span>
            ) : (
              <span className="text-amber-600 font-semibold">{th('kpiMarkingPending')}</span>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400 group-hover:text-emerald-600">
          <span>{th('kpiFollowAttendance')}</span>
          <ArrowUpRight className="size-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </Link>

      {/* 3. ENCAISSÉ CE MOIS */}
      <Link
        href={`/${locale}/dashboard/finance/receipts`}
        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xs"
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-500">{th('kpiCollectedMonth')}</span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
            <Wallet className="size-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">
            {formatMad(periodCollected.amount)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700">
              {periodCollected.rate === null ? '—' : `${periodCollected.rate}%`}
            </span>
            <span>{th('kpiOfExpected')}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400 group-hover:text-blue-600">
          <span>{th('kpiCollectionsJournal')}</span>
          <ArrowUpRight className="size-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </Link>

      {/* 4. IMPAYÉS ÉCHUS */}
      <Link
        href={`/${locale}/dashboard/finance/invoices`}
        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-xs"
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-500">{t('kpiOverdueTitle')}</span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white">
            <AlertTriangle className="size-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">
            {formatMad(periodOverdue.amount)}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            <strong className="font-bold text-slate-700">{periodOverdue.invoiceCount}</strong>{' '}
            {t('kpiOverdueInvoices', { count: periodOverdue.invoiceCount })}{' · '}
            <strong className="font-bold text-slate-700">{periodOverdue.familiesCount}</strong>{' '}
            {t('kpiOverdueFamilies', { count: periodOverdue.familiesCount })}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400 group-hover:text-rose-600">
          <span>{t('kpiOverdueCta')}</span>
          <ArrowUpRight className="size-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </Link>
    </section>
  );
}
