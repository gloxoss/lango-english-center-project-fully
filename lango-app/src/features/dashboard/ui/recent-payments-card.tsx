'use client';

import type { RecentPaymentItem } from '../model/types';
import { ArrowUpRight, CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import React from 'react';
import { formatMad, formatPaymentDateTime } from '../model/formatters';

type RecentPaymentsCardProps = {
  payments: RecentPaymentItem[];
  locale: string;
};

export function RecentPaymentsCard({ payments, locale }: RecentPaymentsCardProps) {
  const t = useTranslations('Dashboard');
  const th = useTranslations('DashboardHome');
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
              flex size-7 items-center justify-center rounded-lg bg-emerald-50
              text-emerald-600
            "
            >
              <CreditCard className="size-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{t('recentPaymentsTitle')}</h3>
          </div>
          <Link
            href={`/${locale}/dashboard/finance/collection-desk`}
            className="
              flex items-center gap-1 text-xs font-bold text-blue-600 transition
              hover:text-blue-800 hover:underline
            "
          >
            <span>{t('openCashDesk')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* List of 5 payments */}
        <div className="mt-3.5 space-y-2">
          {payments.length === 0
            ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {t('noRecentPayments')}
                </div>
              )
            : (
                payments.map(p => (
                  <Link
                    key={p.id}
                    href={p.invoiceId
                      ? `/${locale}/dashboard/finance/invoices/${p.invoiceId}`
                      : `/${locale}/dashboard/students/${p.studentId}`}
                    className="
                      group flex items-center justify-between rounded-xl border
                      border-slate-100 bg-slate-50/70 p-3 transition
                      hover:border-emerald-200 hover:bg-emerald-50/30
                    "
                  >
                    <div className="flex min-w-0 items-center gap-3 pr-2">
                      <div className="
                        flex size-8 shrink-0 items-center justify-center
                        rounded-lg bg-emerald-100 text-xs font-bold
                        text-emerald-800
                      "
                      >
                        {p.studentName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="
                          truncate text-xs font-bold text-slate-900
                          group-hover:text-emerald-700
                        "
                        >
                          {p.studentName}
                        </p>
                        <p className="
                          truncate text-[11px] font-medium text-slate-400
                        "
                        >
                          {p.className}
                          {' '}
                          ·
                          {th.has(`method_${p.paymentMethod}`) ? th(`method_${p.paymentMethod}` as 'method_cash') : p.paymentMethod}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-xs font-extrabold text-emerald-600">
                        +
                        {formatMad(p.amount)}
                      </span>
                      <p className="text-[10px] font-medium text-slate-400">
                        {formatPaymentDateTime(p.paymentDate, locale)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
        </div>
      </div>

      {/* Footer CTA: each cash-desk collection issues one receipt (payment-create.ts), so the receipts list is the payment history (audit S-30). */}
      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
        <Link
          href={`/${locale}/dashboard/finance/receipts`}
          className="
            text-xs font-bold text-blue-600
            hover:underline
          "
        >
          {t('viewPaymentHistory')}
          {' '}
          →
        </Link>
      </div>
    </div>
  );
}
