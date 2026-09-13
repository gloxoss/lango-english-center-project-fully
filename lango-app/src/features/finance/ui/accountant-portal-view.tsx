'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type HomeData = {
  cashCollectedToday: number;
  onlineCollectedToday: number;
  totalPaymentsTodayCount: number;
  pendingOverdueInvoicesCount: number;
  pendingOverdueTotalAmount: number;
  pendingApprovalsCount: number;
  activeCashierSession: { id: string; cashierId: string; status: string; openedAt: string } | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  amount: number;
  netAmount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-[#DDF5EC] text-[#17A673]',
  overdue: 'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json.data as T) : null;
  } catch {
    return null;
  }
}

function mad(value: number): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD`;
}

export function AccountantPortalView() {
  const tFinance = useTranslations('Finance');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');

  const [home, setHome] = useState<HomeData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getStatusLabel = (status: string) => {
    try {
      return tStatus(status.toLowerCase() as any);
    } catch {
      return status;
    }
  };

  const load = useCallback(async () => {
    setError(null);
    const [h, inv] = await Promise.all([
      getJson<HomeData>('/api/accountant/me/home'),
      getJson<Invoice[]>('/api/finance/invoices'),
    ]);
    if (!h) {
      setError(tCommon('error'));
      return;
    }
    setHome(h);
    setInvoices(inv ?? []);
  }, [tCommon]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> {tCommon('refresh')}
        </button>
      </div>
    );
  }

  if (!home) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const session = home.activeCashierSession;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{tFinance('portalTitle')}</h1>
          <p className="text-sm text-slate-500">{tFinance('portalSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          aria-label={tCommon('refresh')}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> {tCommon('refresh')}
        </button>
      </div>

      {/* Cashier session banner */}
      {session ? (
        <div className="p-4 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-[#17A673] flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{tFinance('openSessionBanner')}</p>
            <p className="text-xs text-slate-500">
              {tFinance('sessionOpenedAt', { date: session.openedAt ? new Date(session.openedAt).toLocaleString() : '—' })}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-slate-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">{tFinance('noOpenSession')}</p>
            <p className="text-xs text-slate-500">{tFinance('openSessionHint')}</p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{tFinance('cashCollectedToday')}</p>
            <p className="text-xl font-extrabold text-slate-900">{mad(home.cashCollectedToday)}</p>
            <p className="text-[11px] text-slate-400">{tFinance('paymentsCountSub', { count: home.totalPaymentsTodayCount })}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] text-[#17A673] flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{tFinance('onlineCollectedToday')}</p>
            <p className="text-xl font-extrabold text-slate-900">{mad(home.onlineCollectedToday)}</p>
            <p className="text-[11px] text-slate-400">{tFinance('todaySub')}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{tFinance('pendingInvoices')}</p>
            <p className="text-xl font-extrabold text-slate-900">{home.pendingOverdueInvoicesCount}</p>
            <p className="text-[11px] text-slate-400">{mad(home.pendingOverdueTotalAmount)}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E4EDFD] text-[#2487B8] flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{tFinance('recordedExpenses')}</p>
            <p className="text-xl font-extrabold text-slate-900">{home.pendingApprovalsCount}</p>
            <p className="text-[11px] text-slate-400">{tFinance('totalSub')}</p>
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#0066FF]" />
          <h2 className="font-semibold text-slate-900">{tFinance('recentInvoices')}</h2>
        </div>
        {invoices.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">{tFinance('noInvoicesRecorded')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-semibold">{tFinance('invoiceNumber')}</th>
                  <th className="px-5 py-3 font-semibold">{tFinance('student')}</th>
                  <th className="px-5 py-3 font-semibold">{tFinance('dueDateCol')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{tFinance('amount')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{tFinance('paidAmount')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{tFinance('statusCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.slice(0, 10).map((inv) => {
                  const balance = Number(inv.netAmount) - Number(inv.paidAmount);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-[#0066FF]">{inv.invoiceNumber}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{inv.studentName}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{inv.dueDate}</td>
                      <td className="px-5 py-3 text-end font-semibold text-slate-800">{mad(Number(inv.netAmount))}</td>
                      <td className="px-5 py-3 text-end text-slate-500">{mad(Number(inv.paidAmount))}</td>
                      <td className="px-5 py-3 text-end">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {getStatusLabel(inv.status)}
                        </span>
                        {balance > 0 && <span className="ms-1 text-[11px] text-slate-400">{tFinance('balanceSub', { amount: mad(balance) })}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> {tFinance('realFinanceFooter')}
      </p>
    </div>
  );
}
