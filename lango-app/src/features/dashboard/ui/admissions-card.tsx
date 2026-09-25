'use client';

import type { AdmissionsOverview } from '../model/types';
import { ArrowUpRight, CalendarClock, FolderOpen, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import React from 'react';

type AdmissionsCardProps = {
  data: AdmissionsOverview;
  locale: string;
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'admissionsStatusNew',
  applied: 'admissionsStatusNew',
  contacted: 'admissionsStatusContacted',
  qualified: 'admissionsStatusQualified',
};

export function AdmissionsCard({ data, locale }: AdmissionsCardProps) {
  const th = useTranslations('DashboardHome');

  const facts: string[] = [];
  if (data.toReview > 0) {
    facts.push(th('admissionsToReview', { count: data.toReview }));
  }
  if (data.interviewsToday > 0) {
    facts.push(th('admissionsInterviewsToday', { count: data.interviewsToday }));
  }
  if (data.convertedThisMonth > 0) {
    facts.push(th('admissionsConverted', { count: data.convertedThisMonth }));
  }

  return (
    <div className="
      flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4
      shadow-2xs
      sm:p-5
    "
    >
      <div>
        {/* Header */}
        <div className="
          flex items-center justify-between border-b border-slate-100 pb-3
        "
        >
          <div className="flex items-center gap-2">
            <div className="
              flex size-7 items-center justify-center rounded-lg bg-violet-50
              text-violet-600
            "
            >
              <UserPlus className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">{th('admissionsTitle')}</h3>
              <p className="text-[11px] font-medium text-slate-400">{th('admissionsSubtitle')}</p>
            </div>
          </div>
          <Link
            href={`/${locale}/dashboard/students/admissions`}
            className="
              flex items-center gap-1 text-xs font-bold text-blue-600 transition
              hover:text-blue-800 hover:underline
            "
          >
            <span>{th('seeAdmissions')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Actionable facts */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          {facts.length === 0
            ? (
                <div className="
                  flex w-full items-center gap-2 rounded-xl border
                  border-emerald-100 bg-emerald-50/50 p-3 text-xs font-semibold
                  text-emerald-800
                "
                >
                  <FolderOpen className="size-4 shrink-0 text-emerald-600" />
                  {th('admissionsEmpty')}
                </div>
              )
            : (
                facts.map((f, i) => (
                  <span
                    key={f}
                    className={`
                      inline-flex items-center gap-1.5 rounded-full px-3 py-1.5
                      text-[11px] font-extrabold
                      ${
                  i === 0
                    ? 'border border-violet-200 bg-violet-50 text-violet-800'
                    : 'border border-slate-200 bg-slate-50 text-slate-600'
                  }
                    `}
                  >
                    {i === 0
                      ? <FolderOpen className="size-3" />
                      : (
                          <CalendarClock className="size-3" />
                        )}
                    {f}
                  </span>
                ))
              )}
        </div>

        {/* Recent applications (real rows only) */}
        {data.recent.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {data.recent.map(a => (
              <Link
                key={a.id}
                href={`/${locale}/dashboard/students/admissions`}
                className="
                  group flex items-center justify-between rounded-lg px-2.5 py-2
                  transition
                  hover:bg-slate-50
                "
              >
                <div className="min-w-0 pr-2">
                  <p className="
                    truncate text-xs font-bold text-slate-800
                    group-hover:text-violet-800
                  "
                  >
                    {a.firstName}
                    {' '}
                    {a.lastName}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400">
                    {new Date(a.applicationDate).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className="
                  shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px]
                  font-bold text-slate-600
                "
                >
                  {th.has(STATUS_LABEL_KEYS[a.status] ?? '')
                    ? th(STATUS_LABEL_KEYS[a.status] as 'admissionsStatusNew')
                    : a.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
        <Link
          href={`/${locale}/dashboard/students/admissions`}
          className="
            text-xs font-bold text-blue-600
            hover:underline
          "
        >
          {th('seeAdmissions')}
          {' '}
          →
        </Link>
      </div>
    </div>
  );
}
