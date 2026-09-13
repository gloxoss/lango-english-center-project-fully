'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Expense = {
  id: string;
  documentDate: string;
  reference: string | null;
  counterparty: string | null;
  description: string;
  totalAmount: string;
  status: string;
  createdById: string;
  approvedById: string | null;
  journalEntryId: string | null;
};

export function ExpenseWorkflowView({ locale = 'fr' }: { locale?: string }) {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');

  const [rows, setRows] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [posting, setPosting] = useState({ journalCode: '', voucherTypeCode: '' });
  const [journals, setJournals] = useState<{ id: string; code: string; name: string }[]>([]);
  const [vouchers, setVouchers] = useState<{ id: string; code: string; name: string; journalCode: string }[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/finance/accounting/expenses');
      const json = await response.json();
      if (response.ok) {
        setRows(json.data);
      } else {
        setError(json.error?.message ?? t('loadingFailed'));
      }
    } catch {
      setError(t('loadingFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch('/api/finance/accounting/journals')
      .then(r => r.json())
      .then((j) => {
        if (j.success) setJournals(j.data);
      })
      .catch(() => {});
    fetch('/api/finance/accounting/voucher-types')
      .then(r => r.json())
      .then((j) => {
        if (j.success) setVouchers(j.data);
      })
      .catch(() => {});
  }, []);

  const action = async (row: Expense, name: 'submit' | 'approve' | 'reject' | 'post') => {
    setWorking(row.id);
    setError(null);
    let reason: string | null = null;
    if (name === 'reject') {
      reason = window.prompt(t('rejectionReasonPrompt')) ?? '';
      if (!reason.trim()) {
        setWorking(null);
        return;
      }
    }
    const body =
      name === 'reject'
        ? { reason }
        : name === 'post'
          ? { ...posting, idempotencyKey: `expense:${row.id}:v1` }
          : undefined;
    try {
      const response = await fetch(`/api/finance/accounting/expenses/${row.id}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? t('actionFailed'));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('actionFailed'));
    } finally {
      setWorking(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge className="bg-slate-100 text-slate-600 font-semibold">{tStatus('draft') || status}</Badge>;
      case 'pending_approval':
        return <Badge className="bg-amber-100 text-amber-700 font-semibold">{tStatus('pending') || status}</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-700 font-semibold">{tStatus('approved') || status}</Badge>;
      case 'posted':
        return <Badge className="bg-[#DDF5EC] text-[#17A673] font-semibold">{t('statePosted') || status}</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-100 text-rose-600 font-semibold">{tStatus('rejected') || status}</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-500">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B]">{t('pendingExpensesTitle')}</h1>
        <p className="mt-1 text-xs text-slate-500">{t('pendingExpensesDesc')}</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="grid gap-3 rounded-2xl p-4 sm:grid-cols-2 text-start">
        <label className="text-xs font-bold">
          {t('journalCodeLabel')}
          <select
            required
            value={posting.journalCode}
            onChange={event => setPosting({ ...posting, journalCode: event.target.value })}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
          >
            <option value="">{tCommon('select')}</option>
            {journals.map(j => (
              <option key={j.id} value={j.code}>
                {j.code} — {j.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          {t('expenseVoucherTypeLabel')}
          <select
            required
            value={posting.voucherTypeCode}
            onChange={event => setPosting({ ...posting, voucherTypeCode: event.target.value })}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
          >
            <option value="">{tCommon('select')}</option>
            {vouchers.map(v => (
              <option key={v.id} value={v.code}>
                {v.code} — {v.name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card className="overflow-x-auto rounded-2xl border-slate-200/80">
        <table className="w-full text-start text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
            <tr>
              <th className="p-3 text-start">{tCommon('date')}</th>
              <th className="p-3 text-start">{t('referenceLabel')}</th>
              <th className="p-3 text-start">{t('counterpartyLabel')}</th>
              <th className="p-3 text-start">{tCommon('amount')}</th>
              <th className="p-3 text-start">{tCommon('status')}</th>
              <th className="p-3 text-start">{tCommon('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="p-3 text-slate-600">{row.documentDate}</td>
                <td className="p-3 font-mono font-bold text-slate-700">{row.reference}</td>
                <td className="p-3 font-medium text-[#16212B]">{row.counterparty}</td>
                <td className="p-3 font-extrabold text-[#16212B]">{row.totalAmount} MAD</td>
                <td className="p-3">{getStatusBadge(row.status)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'draft' && (
                      <Button
                        size="sm"
                        disabled={working === row.id}
                        onClick={() => void action(row, 'submit')}
                        className="bg-[#2487B8] text-white hover:bg-[#1B6C93] text-xs h-8"
                      >
                        {t('submitForApprovalBtn')}
                      </Button>
                    )}
                    {row.status === 'pending_approval' && (
                      <>
                        <Button
                          size="sm"
                          disabled={working === row.id}
                          onClick={() => void action(row, 'approve')}
                          className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs h-8"
                        >
                          {t('approveExpenseBtn')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={working === row.id}
                          onClick={() => void action(row, 'reject')}
                          className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8"
                        >
                          {t('rejectExpenseBtn')}
                        </Button>
                      </>
                    )}
                    {row.status === 'approved' && (
                      <Button
                        size="sm"
                        disabled={
                          working === row.id ||
                          !posting.journalCode ||
                          !posting.voucherTypeCode
                        }
                        onClick={() => void action(row, 'post')}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs h-8"
                      >
                        {t('postToLedgerBtn')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  {tCommon('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
