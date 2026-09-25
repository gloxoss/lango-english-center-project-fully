'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowUpRight, PieChart, Users } from 'lucide-react';
import type { StudentDistributionItem } from '../model/types';

interface StudentDistributionCardProps {
  items: StudentDistributionItem[];
  totalActiveStudents: number;
  locale: string;
}

const PALETTE = [
  '#2563EB', // blue-600
  '#0EA5E9', // sky-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // purple-500
  '#EC4899', // pink-500
  '#64748B', // slate-500 for 'Sans niveau'
];

export function StudentDistributionCard({
  items,
  totalActiveStudents,
  locale,
}: StudentDistributionCardProps) {
  const th = useTranslations('DashboardHome');
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <PieChart className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">{th('distributionTitle')}</h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {th('distributionSubtitle')}
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}/dashboard/academics/classes`}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
          >
            <span>{th('seeClasses')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Total Badge */}
        <div className="my-3 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
          <span className="font-semibold">{th('totalActiveLabel')}</span>
          <span className="rounded-md bg-white px-2 py-0.5 font-extrabold text-slate-900 shadow-2xs">
            {th('studentsCount', { count: totalActiveStudents })}
          </span>
        </div>

        {/* Stacked Proportional Bar */}
        {totalActiveStudents > 0 && (
          <div className="mb-4 flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
            {items.map((item, idx) => {
              const widthPct = (item.count / totalActiveStudents) * 100;
              const color = item.name === 'Sans niveau' ? '#94A3B8' : PALETTE[idx % PALETTE.length];
              return (
                <div
                  key={item.name}
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                  title={`${item.name}: ${item.count} élèves (${Math.round(widthPct)}%)`}
                  className="transition-all hover:opacity-80"
                />
              );
            })}
          </div>
        )}

        {/* Breakdown Items */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {th('noLevels')}
            </div>
          ) : (
            items.map((item, idx) => {
              const isUnassigned = item.name === 'Sans niveau';
              const color = isUnassigned ? '#94A3B8' : PALETTE[idx % PALETTE.length];
              const pct = totalActiveStudents > 0 ? Math.round((item.count / totalActiveStudents) * 100) : 0;

              return (
                <div
                  key={item.name}
                  className={`flex items-center justify-between rounded-xl p-2.5 text-xs transition ${
                    isUnassigned
                      ? 'border border-amber-200 bg-amber-50/50 text-amber-900'
                      : 'border border-slate-100 bg-slate-50/70 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      style={{ backgroundColor: color }}
                      className="size-2.5 shrink-0 rounded-full"
                    />
                    <span className="font-bold text-slate-900 truncate">
                      {isUnassigned ? th('noLevel') : item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-slate-800">
                      {item.count.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Invariant Footer */}
      <div className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400 font-medium text-center">
        {th('distributedTotal')} <strong className="font-bold text-slate-700">{items.reduce((s, i) => s + i.count, 0)}</strong> / {th('activeStudentsCount', { count: totalActiveStudents })}
      </div>
    </div>
  );
}
