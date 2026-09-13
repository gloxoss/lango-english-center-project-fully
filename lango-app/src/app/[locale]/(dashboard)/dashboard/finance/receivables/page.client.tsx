'use client';

import {
  AlertCircle,
  Download,
  MessageSquare,
  RefreshCw,
  Search,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { exportToCsv } from '@/libs/csv-export';

interface InvoiceReceivable {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate: string;
  issueDate: string;
  daysOverdue: number;
}

interface ReceivablesSummary {
  totalOutstanding: number;
  current030: number;
  overdue3160: number;
  overdue6190: number;
  overdue90Plus: number;
  totalCount: number;
}

export default function ReceivablesPage() {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const [data, setData] = useState<{ summary: ReceivablesSummary; invoices: InvoiceReceivable[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sendingSms, setSendingSms] = useState<string | null>(null);

  const fetchReceivables = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accountant/me/receivables');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || t('loadReceivablesError'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  const handleSendSms = async (inv: InvoiceReceivable) => {
    setSendingSms(inv.id);
    try {
      const res = await fetch('/api/finance/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || t('smsSendError'));
      } else {
        toast.success(json.message || t('smsSendSuccess', { name: inv.studentName || t('studentFallback') }));
      }
    } catch {
      toast.error(t('smsSendError'));
    } finally {
      setSendingSms(null);
    }
  };

  const filteredInvoices = data?.invoices.filter((inv) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(term) ||
      (inv.studentName && inv.studentName.toLowerCase().includes(term))
    );
  }) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('agingTitle')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('agingSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReceivables}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </button>
          <button
            onClick={() => exportToCsv(filteredInvoices, 'anciennete-creances')}
            className="flex items-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0052CC]"
          >
            <Download className="size-4" />
            {t('exportExcel')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Buckets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">{t('totalReceivablesCard')}</span>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {loading ? '...' : `${(data?.summary.totalOutstanding || 0).toLocaleString()} ${tCommon('currency')}`}
          </div>
          <span className="text-xs text-slate-500">{t('invoicesCount', { count: data?.summary.totalCount || 0 })}</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase">{t('bracket030')}</span>
          <div className="mt-2 text-xl font-extrabold text-emerald-800">
            {loading ? '...' : `${(data?.summary.current030 || 0).toLocaleString()} ${tCommon('currency')}`}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase">{t('bracket3160')}</span>
          <div className="mt-2 text-xl font-extrabold text-amber-800">
            {loading ? '...' : `${(data?.summary.overdue3160 || 0).toLocaleString()} ${tCommon('currency')}`}
          </div>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-orange-700 uppercase">{t('bracket6190')}</span>
          <div className="mt-2 text-xl font-extrabold text-orange-800">
            {loading ? '...' : `${(data?.summary.overdue6190 || 0).toLocaleString()} ${tCommon('currency')}`}
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-red-700 uppercase">{t('bracket90Plus')}</span>
          <div className="mt-2 text-xl font-extrabold text-red-800">
            {loading ? '...' : `${(data?.summary.overdue90Plus || 0).toLocaleString()} ${tCommon('currency')}`}
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3.5 top-3 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('filterReceivablesPlaceholder')}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 ps-10 pe-4 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-start text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-start">{t('tableInvoice')}</th>
              <th className="px-4 py-3 text-start">{t('tableStudent')}</th>
              <th className="px-4 py-3 text-start">{t('tableDueDate')}</th>
              <th className="px-4 py-3 text-start">{t('tableOverdueDays')}</th>
              <th className="px-4 py-3 text-start">{t('tableTotalAmount')}</th>
              <th className="px-4 py-3 text-start">{t('tableRemainingBalance')}</th>
              <th className="px-4 py-3 text-end">{tCommon('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">{t('loadingReceivables')}</td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">{t('noOverdueReceivables')}</td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{inv.studentName || t('studentFallback')}</div>
                    <div className="text-[11px] text-slate-400">{inv.studentEmail}</div>
                  </td>
                  <td className="px-4 py-3">{inv.dueDate}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${inv.daysOverdue > 60 ? 'bg-red-100 text-red-800' : inv.daysOverdue > 30 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                      {t('daysShort', { days: inv.daysOverdue })}
                    </span>
                  </td>
                  <td className="px-4 py-3">{inv.amount} {tCommon('currency')}</td>
                  <td className="px-4 py-3 font-extrabold text-red-700">{inv.balance} {tCommon('currency')}</td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => handleSendSms(inv)}
                      disabled={sendingSms === inv.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#0066FF] hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MessageSquare className="size-3" />
                      {sendingSms === inv.id ? t('sendingSmsBtn') : t('sendSmsBtn')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
