'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, CreditCard } from 'lucide-react';
import type { RecentPaymentItem } from '../model/types';
import { formatMad } from '../model/formatters';
import { useTranslations } from 'next-intl';

interface RecentPaymentsCardProps {
  payments: RecentPaymentItem[];
  locale: string;
}

export function RecentPaymentsCard({ payments, locale }: RecentPaymentsCardProps) {
  const t = useTranslations('Dashboard');
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CreditCard className="size-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{t('recentPaymentsTitle')}</h3>
          </div>
          <Link
            href={`/${locale}/dashboard/finance/collection-desk`}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
          >
            <span>{t('openCashDesk')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* List of 5 payments */}
        <div className="mt-3.5 space-y-2">
          {payments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              {t('noRecentPayments')}
            </div>
          ) : (
            payments.map(p => (
              <Link
                key={p.id}
                href={`/${locale}/dashboard/finance/invoices${p.invoiceId ? `/${p.invoiceId}` : ''}`}
                className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
                    {p.studentName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                      {p.studentName}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium truncate">
                      {p.className} · {p.paymentMethod}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-xs font-extrabold text-emerald-600">
                    +{formatMad(p.amount)}
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {p.paymentDate}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
        <Link
          href={`/${locale}/dashboard/finance/collection-desk`}
          className="text-xs font-bold text-blue-600 hover:underline"
        >
          {t('openCashDesk')} →
        </Link>
      </div>
    </div>
  );
}
