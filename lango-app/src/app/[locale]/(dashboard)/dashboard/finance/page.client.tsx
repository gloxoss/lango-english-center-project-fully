'use client';

import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';

interface FinanceHomeData {
  cashCollectedToday: number;
  onlineCollectedToday: number;
  totalPaymentsTodayCount: number;
  pendingOverdueInvoicesCount: number;
  pendingOverdueTotalAmount: number;
  pendingApprovalsCount: number;
  activeCashierSession: {
    id: string;
    openedAt: string;
    startingFloat: number;
    status: string;
  } | null;
}

export default function AccountantDashboardPage({ params: initialParams }: { params?: { locale?: string } } = {}) {
  const routeParams = useParams<{ locale?: string }>();
  const locale = routeParams?.locale ?? initialParams?.locale ?? 'fr';

  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const [data, setData] = useState<FinanceHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accountant/me/home');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || t('loadingFinanceDashboardError'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('networkError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const totalCollectedToday = (data?.cashCollectedToday || 0) + (data?.onlineCollectedToday || 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('financeDashboardTitle')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('financeDashboardSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </button>
          <Link
            href={`/${locale}/dashboard/finance/collection-desk`}
            className="flex items-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0052CC]"
          >
            <Wallet className="size-4" />
            {t('cashierDeskBtn')}
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Encaissements du Jour */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">{t('collectionsToday')}</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Banknote className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">
              {loading ? '...' : `${totalCollectedToday.toLocaleString('fr-FR')} ${tCommon('currency')}`}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{data?.cashCollectedToday || 0} {tCommon('currency')}</span>
              <span>{t('cash')}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">{data?.onlineCollectedToday || 0} {tCommon('currency')}</span>
              <span>{t('other')}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Créances en Souffrance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">{t('overdueReceivables')}</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-amber-700">
              {loading ? '...' : `${(data?.pendingOverdueTotalAmount || 0).toLocaleString('fr-FR')} ${tCommon('currency')}`}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {t('unpaidInvoicesToFollowUp', { count: data?.pendingOverdueInvoicesCount || 0 })}
            </div>
          </div>
        </div>

        {/* Card 3: Session Caisse */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">{t('myCashierSession')}</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            {data?.activeCashierSession ? (
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  {t('sessionOpen')}
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  {t('startingFloatAmount', { amount: data.activeCashierSession.startingFloat })}
                </p>
              </div>
            ) : (
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                  {t('sessionClosed')}
                </span>
                <p className="mt-1 text-xs text-slate-500">{t('noActiveSession')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Approbations / Dépenses Bureau */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">{t('officeExpenses')}</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">
              {loading ? '...' : (data?.pendingApprovalsCount || 0)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {t('recordedExpenseLines')}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/${locale}/dashboard/finance/collection-desk`}
          className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-[#0066FF] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#0066FF] group-hover:bg-[#0066FF] group-hover:text-white">
              <Wallet className="size-5" />
            </div>
            <ArrowUpRight className="size-5 text-slate-400 group-hover:text-[#0066FF] rtl:rotate-[-90deg]" />
          </div>
          <h3 className="mt-4 font-bold text-slate-900">{t('navCashierDeskTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('navCashierDeskDesc')}
          </p>
        </Link>

        <Link
          href={`/${locale}/dashboard/finance/receivables`}
          className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-[#0066FF] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white">
              <Clock className="size-5" />
            </div>
            <ArrowUpRight className="size-5 text-slate-400 group-hover:text-amber-600 rtl:rotate-[-90deg]" />
          </div>
          <h3 className="mt-4 font-bold text-slate-900">{t('navStudentReceivablesTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('navStudentReceivablesDesc')}
          </p>
        </Link>

        <Link
          href={`/${locale}/dashboard/finance/office-accounting`}
          className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-[#0066FF] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white">
              <FileText className="size-5" />
            </div>
            <ArrowUpRight className="size-5 text-slate-400 group-hover:text-emerald-600 rtl:rotate-[-90deg]" />
          </div>
          <h3 className="mt-4 font-bold text-slate-900">{t('navOfficeAccountingTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('navOfficeAccountingDesc')}
          </p>
        </Link>

        <Link
          href={`/${locale}/dashboard/finance/invoices`}
          className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-[#0066FF] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white">
              <Receipt className="size-5" />
            </div>
            <ArrowUpRight className="size-5 text-slate-400 group-hover:text-indigo-600 rtl:rotate-[-90deg]" />
          </div>
          <h3 className="mt-4 font-bold text-slate-900">{t('navInvoicesTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('navInvoicesDesc')}
          </p>
        </Link>

        <Link
          href={`/${locale}/dashboard/finance/approvals`}
          className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-[#0066FF] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white">
              <ShieldAlert className="size-5" />
            </div>
            <ArrowUpRight className="size-5 text-slate-400 group-hover:text-purple-600 rtl:rotate-[-90deg]" />
          </div>
          <h3 className="mt-4 font-bold text-slate-900">{t('navApprovalsTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('navApprovalsDesc')}
          </p>
        </Link>

        <Link
          href={`/${locale}/dashboard/finance/reports`}
          className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-[#0066FF] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#16212B] text-white group-hover:bg-[#0066FF]">
              <DollarSign className="size-5" />
            </div>
            <ArrowUpRight className="size-5 text-slate-400 group-hover:text-[#0066FF] rtl:rotate-[-90deg]" />
          </div>
          <h3 className="mt-4 font-bold text-slate-900">{t('navReportsTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('navReportsDesc')}
          </p>
        </Link>
      </div>
    </div>
  );
}
