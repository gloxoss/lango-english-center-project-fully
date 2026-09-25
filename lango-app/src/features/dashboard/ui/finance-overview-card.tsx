'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, DollarSign } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FinanceOverviewData } from '../model/types';
import { formatMad } from '../model/formatters';

interface FinanceOverviewCardProps {
  data: FinanceOverviewData;
  locale: string;
}

const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function FinanceOverviewCard({ data, locale }: FinanceOverviewCardProps) {
  const { periodLabel, invoiced, collected, outstanding, collectionRate, monthlyBreakdown } = data;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const th = useTranslations('DashboardHome');
  const tDash = useTranslations('Dashboard');
  // The API labels months in French; translate from the month number instead.
  const monthName = (m: { monthNum: number; month: string }) => {
    const key = `month_${MONTH_KEYS[m.monthNum - 1]}`;
    return MONTH_KEYS[m.monthNum - 1] && tDash.has(key) ? tDash(key as 'month_Jan') : m.month;
  };

  const maxMonthValue = Math.max(
    ...monthlyBreakdown.map(m => Math.max(m.invoiced, m.collected)),
    1000
  );

  const hasChartData = monthlyBreakdown.some(m => m.invoiced > 0 || m.collected > 0);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              {th('financeTitle', { period: periodLabel })}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              {th('financeSubtitle')}
            </p>
          </div>
          <Link
            href={`/${locale}/dashboard/finance`}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
          >
            <span>{th('seeFinance')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* 3 Metric Pills */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {th('invoiced')}
            </span>
            <p className="mt-1 text-base font-extrabold text-slate-900">
              {formatMad(invoiced)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              {th('collected')}
            </span>
            <p className="mt-1 text-base font-extrabold text-emerald-700">
              {formatMad(collected)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
              {th('outstanding')}
            </span>
            <p className="mt-1 text-base font-extrabold text-rose-700">
              {formatMad(outstanding)}
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              {th('collectionRate')}
            </span>
            <p className="mt-1 text-base font-extrabold text-blue-700">
              {collectionRate}%
            </p>
          </div>
        </div>
      </div>

      {/* Reconciled Monthly Chart */}
      <div className="my-5">
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-slate-300" />
              <span>{th('invoiced')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-emerald-500" />
              <span>{th('collected')}</span>
            </div>
          </div>
          {hoveredIndex !== null && monthlyBreakdown[hoveredIndex] && (
            <div className="text-xs font-bold text-slate-700">
              {monthName(monthlyBreakdown[hoveredIndex]!)} :{' '}
              <span className="text-emerald-600">
                {formatMad(monthlyBreakdown[hoveredIndex]!.collected)}
              </span>{' '}
              / {formatMad(monthlyBreakdown[hoveredIndex]!.invoiced)}
            </div>
          )}
        </div>

        {!hasChartData ? (
          <div className="flex h-20 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
            {th('financeEmpty')}
          </div>
        ) : (
          <div className="flex h-44 items-end gap-2 pt-4">
            {monthlyBreakdown.map((m, idx) => {
              const invHeight = maxMonthValue > 0 ? (m.invoiced / maxMonthValue) * 100 : 0;
              const colHeight = maxMonthValue > 0 ? (m.collected / maxMonthValue) * 100 : 0;

              return (
                <div
                  key={`${m.yearNum}-${m.monthNum}`}
                  className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex w-full items-end justify-center gap-1 h-full pb-1">
                    {/* Invoiced Bar */}
                    <div
                      style={{ height: `${Math.max(4, invHeight)}%` }}
                      className="w-full max-w-[14px] rounded-t-xs bg-slate-200 transition-all duration-200 group-hover:bg-slate-300"
                    />
                    {/* Collected Bar */}
                    <div
                      style={{ height: `${Math.max(4, colHeight)}%` }}
                      className="w-full max-w-[14px] rounded-t-xs bg-emerald-500 transition-all duration-200 group-hover:bg-emerald-600"
                    />
                  </div>
                  <span className="mt-1 text-[11px] font-bold text-slate-500 group-hover:text-slate-900">
                    {monthName(m)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400 font-medium">
        <span>{th('financeFooter')}</span>
        <span className="font-bold text-slate-600">{th('currencyNote')}</span>
      </div>
    </div>
  );
}
