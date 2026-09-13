'use client';

import {
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  expenseDate: string;
  description: string;
  receiptUrl: string | null;
  createdAt: string;
  recordedByName: string | null;
}

export default function OfficeAccountingPage() {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const [data, setData] = useState<{ summary: { totalAmount: number; count: number }; expenses: ExpenseItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New expense form modal
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'salary' | 'rent' | 'utilities' | 'supplies' | 'marketing' | 'other'>('supplies');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'supplies':
        return t('catSupplies');
      case 'utilities':
        return t('catUtilities');
      case 'rent':
        return t('catRent');
      case 'salary':
        return t('catSalary');
      case 'marketing':
        return t('catMarketing');
      case 'other':
        return t('catOther');
      default:
        return cat;
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/expenses?pageSize=200');
      const json = await res.json();
      if (json.success) {
        const rows = (json.data || []).map((row: any) => ({ ...row, amount: Number(row.amount), recordedByName: null }));
        setData({ summary: { totalAmount: rows.reduce((sum: number, row: ExpenseItem) => sum + row.amount, 0), count: rows.length }, expenses: rows });
      } else {
        setError(json.error?.message || t('exportExpensesError'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      let receiptUrl: string | undefined;
      if (receiptFile) {
        const upload = new FormData();
        upload.append('file', receiptFile);
        const uploadRes = await fetch('/api/finance/expenses/receipt', { method: 'POST', body: upload });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.success) throw new Error(uploadJson.error?.message || t('uploadReceiptFailed'));
        receiptUrl = uploadJson.data.url;
      }
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          category,
          expenseDate,
          description,
          receiptUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(json.glPosted ? t('expenseCreatedGl') : t('expenseCreatedNoGl'));
        setShowModal(false);
        setAmount('');
        setDescription('');
        setReceiptFile(null);
        fetchExpenses();
      } else {
        setError(json.error?.message || t('recordExpenseError'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('officeExpensesTitle')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('officeExpensesSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchExpenses}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0052CC]"
          >
            <PlusCircle className="size-4" />
            {t('recordExpenseBtn')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('totalRecordedExpenses')}</span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {loading ? '...' : `${(data?.summary.totalAmount || 0).toLocaleString()} ${tCommon('currency')}`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('entriesCount')}</span>
          <div className="mt-2 text-2xl font-extrabold text-[#0066FF]">
            {loading ? '...' : (data?.summary.count || 0)}
          </div>
        </div>
      </div>

      {/* Expense Journal Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-start text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-start">{tCommon('date')}</th>
              <th className="px-4 py-3 text-start">{t('tableCategory')}</th>
              <th className="px-4 py-3 text-start">{tCommon('description')}</th>
              <th className="px-4 py-3 text-start">{tCommon('amount')}</th>
              <th className="px-4 py-3 text-start">{t('tableRecordedBy')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">{t('loadingExpenses')}</td>
              </tr>
            ) : data?.expenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">{t('noExpensesRecorded')}</td>
              </tr>
            ) : (
              data?.expenses.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-bold text-slate-900">{item.expenseDate}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 uppercase">
                      {getCategoryLabel(item.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 font-extrabold text-red-700">-{item.amount} {tCommon('currency')}</td>
                  <td className="px-4 py-3 text-slate-500">{item.recordedByName || tCommon('system')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{t('newOfficeExpenseTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500">{t('newOfficeExpenseSubtitle')}</p>

            <form onSubmit={handleCreateExpense} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">{t('tableCategory')}</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                >
                  <option value="supplies">{t('catSupplies')}</option>
                  <option value="utilities">{t('catUtilities')}</option>
                  <option value="rent">{t('catRent')}</option>
                  <option value="salary">{t('catSalary')}</option>
                  <option value="marketing">{t('catMarketing')}</option>
                  <option value="other">{t('catOther')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">{tCommon('amount')} ({tCommon('currency')})</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-semibold text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">{t('operationDateLabel')}</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">{t('descriptionOrLabel')}</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">{t('receiptFileLabel')}</label>
                <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="mt-1 w-full text-xs text-slate-600" />
              </div>

              <p className="text-[11px] text-slate-500">{t('glNotice')}</p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-[#0066FF] px-5 py-2 text-xs font-bold text-white hover:bg-[#0052CC]"
                >
                  {actionLoading ? t('savingBtn') : t('saveBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
