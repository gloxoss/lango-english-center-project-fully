'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, ShieldAlert } from 'lucide-react';
import type { WatchlistStudent } from '../model/types';

interface StudentWatchlistCardProps {
  students: WatchlistStudent[];
  totalWatchlistCount: number;
  locale: string;
}

export function StudentWatchlistCard({
  students,
  totalWatchlistCount,
  locale,
}: StudentWatchlistCardProps) {
  const th = useTranslations('DashboardHome');
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ShieldAlert className="size-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{th('watchlistTitle')}</h3>
          </div>
          <Link
            href={`/${locale}/dashboard/students`}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
          >
            <span>{th('seeDirectory')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Watchlist Items */}
        <div className="mt-3.5 space-y-2">
          {students.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              {th('watchlistEmpty')}
            </div>
          ) : (
            students.map(s => (
              <Link
                key={s.id}
                href={`/${locale}${s.destinationRoute}`}
                className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-amber-200 hover:bg-amber-50/30"
              >
                <div className="min-w-0 pr-3">
                  <p className="truncate text-xs font-bold text-slate-900 group-hover:text-amber-800">
                    {s.name}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {s.className} · {s.reason}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                    s.severity === 'critical'
                      ? 'border border-rose-200 bg-rose-100 text-rose-700'
                      : 'border border-amber-200 bg-amber-100 text-amber-800'
                  }`}
                >
                  {s.severity === 'critical' ? th('highRisk') : th('toWatch')}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
        <Link
          href={`/${locale}/dashboard/students`}
          className="text-xs font-bold text-blue-600 hover:underline"
        >
          {totalWatchlistCount > 5
            ? `${th('seeAllCases', { count: totalWatchlistCount })} →`
            : `${th('openDirectory')} →`}
        </Link>
      </div>
    </div>
  );
}
