'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileWarning,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ActionCenterData } from '../model/types';

interface ActionCenterProps {
  data: ActionCenterData;
  locale: string;
}

export function ActionCenter({ data, locale }: ActionCenterProps) {
  const { attendance, overdueInvoices, unjustifiedAbsences } = data;

  return (
    <section aria-labelledby="action-center-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
            <Sparkles className="size-3.5" />
          </div>
          <h2
            id="action-center-heading"
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Centre d’actions prioritaires
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-3">
        {/* 1. ATTENDANCE ACTION CARD */}
        <div
          className={`relative flex flex-col justify-between rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 ${
            attendance.status === 'warning'
              ? 'border-amber-200 bg-amber-50/50 shadow-xs hover:border-amber-300 hover:bg-amber-50'
              : attendance.status === 'no_school'
                ? 'border-slate-200 bg-slate-50/60 shadow-2xs'
                : 'border-emerald-200/80 bg-emerald-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                attendance.status === 'warning'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : attendance.status === 'no_school'
                    ? 'bg-slate-200 text-slate-600'
                    : 'bg-emerald-600 text-white shadow-xs'
              }`}
            >
              {attendance.status === 'warning' ? (
                <Clock className="size-4" />
              ) : attendance.status === 'no_school' ? (
                <Clock className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Présences
                </span>
                {attendance.status === 'warning' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                    Action requise
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                {attendance.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 font-medium">
                {attendance.sub}
              </p>
            </div>
          </div>

          {attendance.status === 'warning' && (
            <div className="mt-3.5 border-t border-amber-200/60 pt-2.5">
              <Link
                href={`/${locale}/dashboard/attendance`}
                className="inline-flex min-h-[44px] w-full items-center justify-between rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 active:scale-[0.99]"
              >
                <span>Voir les classes</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* 2. OVERDUE INVOICES ACTION CARD */}
        <div
          className={`relative flex flex-col justify-between rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 ${
            overdueInvoices.status === 'warning'
              ? 'border-rose-200 bg-rose-50/40 shadow-xs hover:border-rose-300 hover:bg-rose-50/70'
              : 'border-emerald-200/80 bg-emerald-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                overdueInvoices.status === 'warning'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-emerald-600 text-white shadow-xs'
              }`}
            >
              {overdueInvoices.status === 'warning' ? (
                <FileWarning className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Recouvrement
                </span>
                {overdueInvoices.status === 'warning' && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-800">
                    {overdueInvoices.overdueCount} retards
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                {overdueInvoices.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 font-medium">
                {overdueInvoices.sub}
              </p>
            </div>
          </div>

          {overdueInvoices.status === 'warning' && (
            <div className="mt-3.5 border-t border-rose-200/60 pt-2.5">
              <Link
                href={`/${locale}/dashboard/finance/invoices`}
                className="inline-flex min-h-[44px] w-full items-center justify-between rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 active:scale-[0.99]"
              >
                <span>Voir les factures</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* 3. UNJUSTIFIED ABSENCES ACTION CARD */}
        <div
          className={`relative flex flex-col justify-between rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 ${
            unjustifiedAbsences.status === 'warning'
              ? 'border-amber-200 bg-amber-50/50 shadow-xs hover:border-amber-300 hover:bg-amber-50'
              : 'border-emerald-200/80 bg-emerald-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                unjustifiedAbsences.status === 'warning'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-emerald-600 text-white shadow-xs'
              }`}
            >
              {unjustifiedAbsences.status === 'warning' ? (
                <AlertTriangle className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Assiduité
                </span>
                {unjustifiedAbsences.status === 'warning' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                    Non justifiées
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                {unjustifiedAbsences.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 font-medium">
                {unjustifiedAbsences.sub}
              </p>
            </div>
          </div>

          {unjustifiedAbsences.status === 'warning' && (
            <div className="mt-3.5 border-t border-amber-200/60 pt-2.5">
              <Link
                href={`/${locale}/dashboard/attendance`}
                className="inline-flex min-h-[44px] w-full items-center justify-between rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 active:scale-[0.99]"
              >
                <span>Voir les présences</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
